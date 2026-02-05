import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { orders, orderLines, tables, menuItems, kots, kotLines, payments } from '../db/schema.js';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { generateId, generateOrderNumber, generateKOTNumber } from '../utils/id-generator.js';
import {
  emitKOTCreated,
  emitOrderClosed,
  emitOrderCreated,
  emitOrderLineChanged,
  emitOrderUpdated,
  emitTableUpdated,
} from '../socket/index.js';
import {
  acquireOrderLock,
  getCachedIdempotencyResponse,
  incrementOrderVersion,
  recordDomainEvent,
  releaseOrderLock,
  storeIdempotencyResponse,
  touchDeviceSession,
  validateOrderLock,
} from '../services/sync.service.js';

// Validation schemas
const createOrderSchema = z.object({
  orderType: z.enum(['dine-in', 'takeaway']),
  tableId: z.string().optional(),
  clientOrderId: z.string().optional(),
});

const addLineSchema = z.object({
  menuItemId: z.string(),
  qty: z.number().int().min(1).max(99),
  notes: z.string().optional(),
});

const updateLineSchema = z.object({
  qty: z.number().int().min(1).max(99),
  notes: z.string().optional(),
});

const applyDiscountSchema = z.object({
  discountType: z.enum(['percentage', 'flat']),
  discountValue: z.number().positive(),
  discountReason: z.string().min(1),
});

const cancelOrderSchema = z.object({
  reason: z.string().min(1),
});

const lockOrderSchema = z.object({
  ttlSeconds: z.number().int().min(30).max(900).optional(),
});

function getIdempotencyKey(request: FastifyRequest): string | undefined {
  const value = request.headers['x-idempotency-key'];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Helper function to recalculate order totals
function recalculateOrderTotals(orderId: string) {
  const lines = db.select().from(orderLines).where(eq(orderLines.orderId, orderId)).all();

  let subtotal = 0;
  let taxTotal = 0;

  for (const line of lines) {
    const baseAmount = line.unitPrice * line.qty;
    const lineTax = baseAmount * (line.taxRate / 100);
    subtotal += baseAmount;
    taxTotal += lineTax;
  }

  // Get current order for discount
  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();

  let discountAmount = 0;
  if (order?.discountType && order?.discountValue) {
    if (order.discountType === 'percentage') {
      discountAmount = subtotal * (order.discountValue / 100);
    } else {
      discountAmount = order.discountValue;
    }
  }

  const grandTotal = subtotal + taxTotal - discountAmount;

  db.update(orders)
    .set({
      subtotal: Math.round(subtotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      grandTotal: Math.max(0, Math.round(grandTotal * 100) / 100),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
    .run();

  return { subtotal, taxTotal, grandTotal };
}

export default async function ordersRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all routes
  fastify.addHook('preHandler', authMiddleware);

  // Create new order
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const deviceId = touchDeviceSession(request);
      const idempotencyKey = getIdempotencyKey(request);
      const cachedResponse = getCachedIdempotencyResponse(idempotencyKey, 'orders:create', request.user!.userId);
      if (cachedResponse) {
        return cachedResponse;
      }

      const body = createOrderSchema.parse(request.body);
      const requestedOrderId = body.clientOrderId?.trim() || null;

      if (requestedOrderId) {
        const existingOrder = db.select().from(orders).where(eq(orders.id, requestedOrderId)).get();
        if (existingOrder) {
          storeIdempotencyResponse(idempotencyKey, 'orders:create', request.user!.userId, existingOrder);
          return existingOrder;
        }
      }

      if (body.orderType === 'dine-in' && !body.tableId) {
        return reply.status(400).send({ error: 'Table ID is required for dine-in orders' });
      }

      // Check if table exists and is not already occupied
      if (body.tableId) {
        const table = db.select().from(tables).where(eq(tables.id, body.tableId)).get();
        if (!table) {
          return reply.status(404).send({ error: 'Table not found' });
        }
        if (table.currentOrderId && table.currentOrderId !== requestedOrderId) {
          return reply.status(400).send({ error: 'Table is already occupied' });
        }
      }

      const orderId = requestedOrderId || generateId();
      const orderNumber = generateOrderNumber();
      const now = new Date();

      db.insert(orders).values({
        id: orderId,
        orderNumber,
        orderType: body.orderType,
        tableId: body.tableId || null,
        ownerUserId: request.user!.userId,
        status: 'open',
        version: 1,
        subtotal: 0,
        taxTotal: 0,
        grandTotal: 0,
        paymentStatus: 'pending',
        createdBy: request.user!.userId,
        createdAt: now,
        updatedAt: now,
      }).run();

      // Update table with current order
      if (body.tableId) {
        db.update(tables)
          .set({ currentOrderId: orderId, updatedAt: now })
          .where(eq(tables.id, body.tableId))
          .run();

        acquireOrderLock(orderId, deviceId, 120);

        const table = db.select().from(tables).where(eq(tables.id, body.tableId)).get();
        if (table) {
          emitTableUpdated({
            id: table.id,
            name: table.name,
            currentOrderId: orderId,
            version: table.version,
            lockOwnerDeviceId: table.lockOwnerDeviceId,
            lockExpiresAt: table.lockExpiresAt,
            sourceDeviceId: deviceId,
            serverTime: now.toISOString(),
          });

          recordDomainEvent({
            entityType: 'table',
            entityId: table.id,
            eventType: 'table.updated',
            payload: {
              id: table.id,
              currentOrderId: table.currentOrderId,
              lockOwnerDeviceId: table.lockOwnerDeviceId,
              lockExpiresAt: table.lockExpiresAt,
              version: table.version,
            },
            sourceDeviceId: deviceId,
            actorUserId: request.user!.userId,
          });
        }
      }

      const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
      if (order) {
        emitOrderCreated({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          subtotal: order.subtotal,
          taxTotal: order.taxTotal,
          grandTotal: order.grandTotal,
          version: order.version,
          sourceDeviceId: deviceId,
          serverTime: now.toISOString(),
        });
        recordDomainEvent({
          entityType: 'order',
          entityId: order.id,
          eventType: 'order.created',
          payload: order,
          sourceDeviceId: deviceId,
          actorUserId: request.user!.userId,
        });
      }
      storeIdempotencyResponse(idempotencyKey, 'orders:create', request.user!.userId, order);

      return reply.status(201).send(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      throw error;
    }
  });

  // Acquire or renew order lock
  fastify.post('/:id/lock', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = lockOrderSchema.parse(request.body ?? {});
      const deviceId = touchDeviceSession(request);
      const lockResult = acquireOrderLock(id, deviceId, body.ttlSeconds ?? 120);

      if (!lockResult.success) {
        return reply.status(409).send({
          error: lockResult.reason || 'Unable to acquire lock',
          lockOwner: lockResult.lockOwner || null,
          lockExpiresAt: lockResult.lockExpiresAt || null,
        });
      }

      const order = db.select().from(orders).where(eq(orders.id, id)).get();
      const response = {
        success: true,
        orderId: id,
        tableId: order?.tableId || null,
        lockOwner: lockResult.lockOwner || deviceId,
        lockExpiresAt: lockResult.lockExpiresAt || null,
      };

      recordDomainEvent({
        entityType: 'order',
        entityId: id,
        eventType: 'order.locked',
        payload: response,
        sourceDeviceId: deviceId,
        actorUserId: request.user!.userId,
      });

      return response;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      throw error;
    }
  });

  // Release order lock
  fastify.delete('/:id/lock', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deviceId = touchDeviceSession(request);
    const force = request.user!.role === 'owner' || request.user!.role === 'manager';
    const result = releaseOrderLock(id, deviceId, force);
    if (!result.success) {
      return reply.status(409).send({ error: result.reason || 'Unable to release lock' });
    }

    recordDomainEvent({
      entityType: 'order',
      entityId: id,
      eventType: 'order.unlocked',
      payload: { orderId: id },
      sourceDeviceId: deviceId,
      actorUserId: request.user!.userId,
    });

    return { success: true, orderId: id };
  });

  // List orders
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      status?: string;
      date?: string;
      limit?: string;
    };

    const conditions: ReturnType<typeof eq>[] = [];

    if (query.status) {
      conditions.push(eq(orders.status, query.status as any));
    }

    if (query.date) {
      const startOfDay = new Date(query.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(query.date);
      endOfDay.setHours(23, 59, 59, 999);

      conditions.push(gte(orders.createdAt, startOfDay));
      conditions.push(lte(orders.createdAt, endOfDay));
    }

    let result;
    if (conditions.length > 0) {
      result = db
        .select()
        .from(orders)
        .where(and(...conditions))
        .orderBy(desc(orders.createdAt))
        .limit(parseInt(query.limit || '100'))
        .all();
    } else {
      result = db
        .select()
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(parseInt(query.limit || '100'))
        .all();
    }

    return result;
  });

  // Get active/open orders
  fastify.get('/active', async (request: FastifyRequest, reply: FastifyReply) => {
    const activeOrders = db
      .select()
      .from(orders)
      .where(eq(orders.status, 'open'))
      .orderBy(desc(orders.createdAt))
      .all();

    // Enrich with lines
    const enriched = activeOrders.map(order => {
      const lines = db
        .select({
          id: orderLines.id,
          menuItemId: orderLines.menuItemId,
          menuItemName: menuItems.name,
          qty: orderLines.qty,
          unitPrice: orderLines.unitPrice,
          taxRate: orderLines.taxRate,
          lineTotal: orderLines.lineTotal,
          notes: orderLines.notes,
          kotSent: orderLines.kotSent,
        })
        .from(orderLines)
        .leftJoin(menuItems, eq(orderLines.menuItemId, menuItems.id))
        .where(eq(orderLines.orderId, order.id))
        .all();

      const table = order.tableId
        ? db.select().from(tables).where(eq(tables.id, order.tableId)).get()
        : null;

      return {
        ...order,
        lines,
        table,
      };
    });

    return enriched;
  });

  // Get order by ID
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const order = db.select().from(orders).where(eq(orders.id, id)).get();

    if (!order) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    const lines = db
      .select({
        id: orderLines.id,
        menuItemId: orderLines.menuItemId,
        menuItemName: menuItems.name,
        isVeg: menuItems.isVeg,
        qty: orderLines.qty,
        unitPrice: orderLines.unitPrice,
        taxRate: orderLines.taxRate,
        lineTotal: orderLines.lineTotal,
        notes: orderLines.notes,
        kotSent: orderLines.kotSent,
      })
      .from(orderLines)
      .leftJoin(menuItems, eq(orderLines.menuItemId, menuItems.id))
      .where(eq(orderLines.orderId, id))
      .all();

    const orderKots = db.select().from(kots).where(eq(kots.orderId, id)).all();
    const orderPayments = db.select().from(payments).where(eq(payments.orderId, id)).all();

    const table = order.tableId
      ? db.select().from(tables).where(eq(tables.id, order.tableId)).get()
      : null;

    return {
      ...order,
      lines,
      kots: orderKots,
      payments: orderPayments,
      table,
    };
  });

  // Add line to order
  fastify.post('/:id/lines', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const deviceId = touchDeviceSession(request);
      const idempotencyKey = getIdempotencyKey(request);
      const cacheKey = `orders:add-line:${(request.params as { id: string }).id}`;
      const cachedResponse = getCachedIdempotencyResponse(idempotencyKey, cacheKey, request.user!.userId);
      if (cachedResponse) {
        return cachedResponse;
      }

      const { id } = request.params as { id: string };
      const body = addLineSchema.parse(request.body);

      const lockState = validateOrderLock(id, deviceId);
      if (!lockState.allowed) {
        return reply.status(409).send({
          error: lockState.reason || 'Order is locked',
          lockOwner: lockState.lockOwner || null,
          lockExpiresAt: lockState.lockExpiresAt || null,
        });
      }

      const order = db.select().from(orders).where(eq(orders.id, id)).get();
      if (!order) {
        return reply.status(404).send({ error: 'Order not found' });
      }

      if (order.status !== 'open') {
        return reply.status(400).send({ error: 'Cannot add items to a closed order' });
      }

      const menuItem = db.select().from(menuItems).where(eq(menuItems.id, body.menuItemId)).get();
      if (!menuItem) {
        return reply.status(404).send({ error: 'Menu item not found' });
      }

      const lineTotal = menuItem.basePrice * body.qty;
      const now = new Date();

      const lineId = generateId();

      db.insert(orderLines).values({
        id: lineId,
        orderId: id,
        menuItemId: body.menuItemId,
        qty: body.qty,
        unitPrice: menuItem.basePrice,
        taxRate: menuItem.taxRatePercent,
        lineTotal,
        notes: body.notes || null,
        kotSent: false,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }).run();

      recalculateOrderTotals(id);
      const version = incrementOrderVersion(id);

      const updatedOrder = db.select().from(orders).where(eq(orders.id, id)).get();
      if (updatedOrder) {
        emitOrderUpdated({
          id: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          status: updatedOrder.status,
          subtotal: updatedOrder.subtotal,
          taxTotal: updatedOrder.taxTotal,
          grandTotal: updatedOrder.grandTotal,
          version,
          sourceDeviceId: deviceId,
          serverTime: now.toISOString(),
        });
      }

      const line = db.select().from(orderLines).where(eq(orderLines.id, lineId)).get();
      const response = {
        ...line,
        menuItemName: menuItem.name,
        isVeg: menuItem.isVeg,
      };

      emitOrderLineChanged('order.line.added', {
        orderId: id,
        lineId,
        version,
        sourceDeviceId: deviceId,
        serverTime: now.toISOString(),
      });

      recordDomainEvent({
        entityType: 'order',
        entityId: id,
        eventType: 'order.line.added',
        payload: response,
        sourceDeviceId: deviceId,
        actorUserId: request.user!.userId,
      });

      storeIdempotencyResponse(idempotencyKey, cacheKey, request.user!.userId, response);

      return reply.status(201).send(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      throw error;
    }
  });

  // Update line quantity
  fastify.patch('/:id/lines/:lineId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const deviceId = touchDeviceSession(request);
      const { id, lineId } = request.params as { id: string; lineId: string };
      const body = updateLineSchema.parse(request.body);

      const lockState = validateOrderLock(id, deviceId);
      if (!lockState.allowed) {
        return reply.status(409).send({
          error: lockState.reason || 'Order is locked',
          lockOwner: lockState.lockOwner || null,
          lockExpiresAt: lockState.lockExpiresAt || null,
        });
      }

      const order = db.select().from(orders).where(eq(orders.id, id)).get();
      if (!order || order.status !== 'open') {
        return reply.status(400).send({ error: 'Cannot modify a closed order' });
      }

      const line = db.select().from(orderLines).where(eq(orderLines.id, lineId)).get();
      if (!line) {
        return reply.status(404).send({ error: 'Line not found' });
      }

      const lineTotal = line.unitPrice * body.qty;

      db.update(orderLines)
        .set({
          qty: body.qty,
          lineTotal,
          notes: body.notes !== undefined ? body.notes : line.notes,
          version: (line.version ?? 1) + 1,
          updatedAt: new Date(),
        })
        .where(eq(orderLines.id, lineId))
        .run();

      recalculateOrderTotals(id);
      const version = incrementOrderVersion(id);

      const updatedLine = db.select().from(orderLines).where(eq(orderLines.id, lineId)).get();
      const updatedOrder = db.select().from(orders).where(eq(orders.id, id)).get();
      if (updatedOrder) {
        emitOrderUpdated({
          id: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          status: updatedOrder.status,
          subtotal: updatedOrder.subtotal,
          taxTotal: updatedOrder.taxTotal,
          grandTotal: updatedOrder.grandTotal,
          version,
          sourceDeviceId: deviceId,
          serverTime: new Date().toISOString(),
        });
      }
      emitOrderLineChanged('order.line.updated', {
        orderId: id,
        lineId,
        version,
        sourceDeviceId: deviceId,
        serverTime: new Date().toISOString(),
      });
      recordDomainEvent({
        entityType: 'order',
        entityId: id,
        eventType: 'order.line.updated',
        payload: updatedLine,
        sourceDeviceId: deviceId,
        actorUserId: request.user!.userId,
      });

      return updatedLine;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      throw error;
    }
  });

  // Remove line from order
  fastify.delete('/:id/lines/:lineId', async (request: FastifyRequest, reply: FastifyReply) => {
    const deviceId = touchDeviceSession(request);
    const { id, lineId } = request.params as { id: string; lineId: string };

    const lockState = validateOrderLock(id, deviceId);
    if (!lockState.allowed) {
      return reply.status(409).send({
        error: lockState.reason || 'Order is locked',
        lockOwner: lockState.lockOwner || null,
        lockExpiresAt: lockState.lockExpiresAt || null,
      });
    }

    const order = db.select().from(orders).where(eq(orders.id, id)).get();
    if (!order || order.status !== 'open') {
      return reply.status(400).send({ error: 'Cannot modify a closed order' });
    }

    const line = db.select().from(orderLines).where(eq(orderLines.id, lineId)).get();
    if (!line) {
      return reply.status(404).send({ error: 'Line not found' });
    }

    if (line.kotSent) {
      return reply.status(400).send({ error: 'Cannot remove items that have been sent to kitchen' });
    }

    db.delete(orderLines).where(eq(orderLines.id, lineId)).run();

    recalculateOrderTotals(id);
    const version = incrementOrderVersion(id);
    const updatedOrder = db.select().from(orders).where(eq(orders.id, id)).get();
    if (updatedOrder) {
      emitOrderUpdated({
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        subtotal: updatedOrder.subtotal,
        taxTotal: updatedOrder.taxTotal,
        grandTotal: updatedOrder.grandTotal,
        version,
        sourceDeviceId: deviceId,
        serverTime: new Date().toISOString(),
      });
    }

    emitOrderLineChanged('order.line.removed', {
      orderId: id,
      lineId,
      version,
      sourceDeviceId: deviceId,
      serverTime: new Date().toISOString(),
    });
    recordDomainEvent({
      entityType: 'order',
      entityId: id,
      eventType: 'order.line.removed',
      payload: { orderId: id, lineId, version },
      sourceDeviceId: deviceId,
      actorUserId: request.user!.userId,
    });

    return { success: true };
  });

  // Send KOT to kitchen
  fastify.post('/:id/kots', async (request: FastifyRequest, reply: FastifyReply) => {
    const deviceId = touchDeviceSession(request);
    const { id } = request.params as { id: string };
    const idempotencyKey = getIdempotencyKey(request);
    const cacheKey = `orders:create-kot:${id}`;
    const cachedResponse = getCachedIdempotencyResponse(idempotencyKey, cacheKey, request.user!.userId);
    if (cachedResponse) {
      return cachedResponse;
    }

    const lockState = validateOrderLock(id, deviceId);
    if (!lockState.allowed) {
      return reply.status(409).send({
        error: lockState.reason || 'Order is locked',
        lockOwner: lockState.lockOwner || null,
        lockExpiresAt: lockState.lockExpiresAt || null,
      });
    }

    const order = db.select().from(orders).where(eq(orders.id, id)).get();
    if (!order) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    if (order.status !== 'open') {
      return reply.status(400).send({ error: 'Cannot create KOT for a closed order' });
    }

    // Get lines that haven't been sent to kitchen yet
    const unsent = db
      .select({
        id: orderLines.id,
        menuItemId: orderLines.menuItemId,
        menuItemName: menuItems.name,
        qty: orderLines.qty,
        notes: orderLines.notes,
      })
      .from(orderLines)
      .leftJoin(menuItems, eq(orderLines.menuItemId, menuItems.id))
      .where(and(eq(orderLines.orderId, id), eq(orderLines.kotSent, false)))
      .all();

    if (unsent.length === 0) {
      return reply.status(400).send({ error: 'No items to send to kitchen' });
    }

    const kotId = generateId();
    const kotNumber = generateKOTNumber();
    const now = new Date();

    // Create KOT
    db.insert(kots).values({
      id: kotId,
      orderId: id,
      kotNumber,
      status: 'new',
      createdAt: now,
      updatedAt: now,
    }).run();

    // Create KOT lines and mark order lines as sent
    for (const line of unsent) {
      db.insert(kotLines).values({
        id: generateId(),
        kotId,
        orderLineId: line.id,
        menuItemName: line.menuItemName || 'Unknown',
        qty: line.qty,
        notes: line.notes,
      }).run();

      db.update(orderLines)
        .set({ kotSent: true, updatedAt: now })
        .where(eq(orderLines.id, line.id))
        .run();
    }

    const table = order.tableId
      ? db.select().from(tables).where(eq(tables.id, order.tableId)).get()
      : null;

    // Emit Socket.io event
    emitKOTCreated({
      id: kotId,
      orderId: id,
      kotNumber,
      tableName: table?.name || null,
      orderType: order.orderType,
      sourceDeviceId: deviceId,
      serverTime: now.toISOString(),
      lines: unsent.map(l => ({
        id: l.id,
        menuItemName: l.menuItemName || 'Unknown',
        qty: l.qty,
        notes: l.notes,
      })),
      createdAt: now,
    });

    const kot = db.select().from(kots).where(eq(kots.id, kotId)).get();
    const kotLinesList = db.select().from(kotLines).where(eq(kotLines.kotId, kotId)).all();
    const version = incrementOrderVersion(id);

    recordDomainEvent({
      entityType: 'kot',
      entityId: kotId,
      eventType: 'kot.created',
      payload: {
        ...kot,
        lines: kotLinesList,
        orderId: id,
      },
      sourceDeviceId: deviceId,
      actorUserId: request.user!.userId,
    });

    const response = {
      ...kot,
      lines: kotLinesList,
      tableName: table?.name,
      orderVersion: version,
    };
    storeIdempotencyResponse(idempotencyKey, cacheKey, request.user!.userId, response);

    return reply.status(201).send(response);
  });

  // Apply discount
  fastify.post(
    '/:id/discount',
    { preHandler: [requireRole('owner', 'manager', 'cashier')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const deviceId = touchDeviceSession(request);
        const { id } = request.params as { id: string };
        const body = applyDiscountSchema.parse(request.body);

        const lockState = validateOrderLock(id, deviceId);
        if (!lockState.allowed) {
          return reply.status(409).send({
            error: lockState.reason || 'Order is locked',
            lockOwner: lockState.lockOwner || null,
            lockExpiresAt: lockState.lockExpiresAt || null,
          });
        }

        const order = db.select().from(orders).where(eq(orders.id, id)).get();
        if (!order) {
          return reply.status(404).send({ error: 'Order not found' });
        }

        if (order.status !== 'open' && order.status !== 'billed') {
          return reply.status(400).send({ error: 'Cannot apply discount to this order' });
        }

        // Check discount limits for cashiers
        if (request.user!.role === 'cashier') {
          const settings = db.query.settings?.findFirst();
          const limit = (settings as any)?.cashierDiscountLimit || 10;

          if (body.discountType === 'percentage' && body.discountValue > limit) {
            return reply.status(403).send({
              error: `Cashiers can only apply up to ${limit}% discount`,
            });
          }
        }

        db.update(orders)
          .set({
            discountType: body.discountType,
            discountValue: body.discountValue,
            discountReason: body.discountReason,
          })
          .where(eq(orders.id, id))
          .run();

        recalculateOrderTotals(id);
        const version = incrementOrderVersion(id);

        const updatedOrder = db.select().from(orders).where(eq(orders.id, id)).get();
        if (updatedOrder) {
          emitOrderUpdated({
            id: updatedOrder.id,
            orderNumber: updatedOrder.orderNumber,
            status: updatedOrder.status,
            subtotal: updatedOrder.subtotal,
            taxTotal: updatedOrder.taxTotal,
            grandTotal: updatedOrder.grandTotal,
            version,
            sourceDeviceId: deviceId,
            serverTime: new Date().toISOString(),
          });
          recordDomainEvent({
            entityType: 'order',
            entityId: updatedOrder.id,
            eventType: 'order.updated',
            payload: updatedOrder,
            sourceDeviceId: deviceId,
            actorUserId: request.user!.userId,
          });
        }

        return updatedOrder;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        throw error;
      }
    }
  );

  // Remove discount
  fastify.delete('/:id/discount', async (request: FastifyRequest, reply: FastifyReply) => {
    const deviceId = touchDeviceSession(request);
    const { id } = request.params as { id: string };

    const lockState = validateOrderLock(id, deviceId);
    if (!lockState.allowed) {
      return reply.status(409).send({
        error: lockState.reason || 'Order is locked',
        lockOwner: lockState.lockOwner || null,
        lockExpiresAt: lockState.lockExpiresAt || null,
      });
    }

    const order = db.select().from(orders).where(eq(orders.id, id)).get();
    if (!order) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    db.update(orders)
      .set({
        discountType: null,
        discountValue: null,
        discountReason: null,
      })
      .where(eq(orders.id, id))
      .run();

    recalculateOrderTotals(id);
    const version = incrementOrderVersion(id);

    const updatedOrder = db.select().from(orders).where(eq(orders.id, id)).get();
    if (updatedOrder) {
      emitOrderUpdated({
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        subtotal: updatedOrder.subtotal,
        taxTotal: updatedOrder.taxTotal,
        grandTotal: updatedOrder.grandTotal,
        version,
        sourceDeviceId: deviceId,
        serverTime: new Date().toISOString(),
      });
      recordDomainEvent({
        entityType: 'order',
        entityId: updatedOrder.id,
        eventType: 'order.updated',
        payload: updatedOrder,
        sourceDeviceId: deviceId,
        actorUserId: request.user!.userId,
      });
    }

    return updatedOrder;
  });

  // Generate bill (change status to billed)
  fastify.post('/:id/bill', async (request: FastifyRequest, reply: FastifyReply) => {
    const deviceId = touchDeviceSession(request);
    const { id } = request.params as { id: string };

    const lockState = validateOrderLock(id, deviceId);
    if (!lockState.allowed) {
      return reply.status(409).send({
        error: lockState.reason || 'Order is locked',
        lockOwner: lockState.lockOwner || null,
        lockExpiresAt: lockState.lockExpiresAt || null,
      });
    }

    const order = db.select().from(orders).where(eq(orders.id, id)).get();
    if (!order) {
      return reply.status(404).send({ error: 'Order not found' });
    }

    if (order.status !== 'open') {
      return reply.status(400).send({ error: 'Order is not open' });
    }

    db.update(orders)
      .set({ status: 'billed', updatedAt: new Date() })
      .where(eq(orders.id, id))
      .run();
    const version = incrementOrderVersion(id);

    const updatedOrder = db.select().from(orders).where(eq(orders.id, id)).get();
    if (updatedOrder) {
      emitOrderUpdated({
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        subtotal: updatedOrder.subtotal,
        taxTotal: updatedOrder.taxTotal,
        grandTotal: updatedOrder.grandTotal,
        version,
        sourceDeviceId: deviceId,
        serverTime: new Date().toISOString(),
      });
      recordDomainEvent({
        entityType: 'order',
        entityId: updatedOrder.id,
        eventType: 'order.updated',
        payload: updatedOrder,
        sourceDeviceId: deviceId,
        actorUserId: request.user!.userId,
      });
    }

    return updatedOrder;
  });

  // Process payment
  fastify.post(
    '/:id/payments',
    { preHandler: [requireRole('owner', 'manager', 'cashier')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const deviceId = touchDeviceSession(request);
      const { id } = request.params as { id: string };
      const idempotencyKey = getIdempotencyKey(request);
      const cacheKey = `orders:add-payment:${id}`;
      const cachedResponse = getCachedIdempotencyResponse(idempotencyKey, cacheKey, request.user!.userId);
      if (cachedResponse) {
        return cachedResponse;
      }

      const body = z.object({
        method: z.enum(['cash', 'upi', 'card']),
        amount: z.number().positive(),
        reference: z.string().optional(),
      }).parse(request.body);

      const order = db.select().from(orders).where(eq(orders.id, id)).get();
      if (!order) {
        return reply.status(404).send({ error: 'Order not found' });
      }

      if (order.status === 'cancelled' || order.status === 'paid') {
        return reply.status(400).send({ error: 'Cannot process payment for this order' });
      }

      const paymentId = generateId();
      const now = new Date();

      db.insert(payments).values({
        id: paymentId,
        orderId: id,
        method: body.method,
        amount: body.amount,
        reference: body.reference || null,
        receivedAt: now,
        receivedBy: request.user!.userId,
      }).run();

      // Calculate total paid
      const allPayments = db.select().from(payments).where(eq(payments.orderId, id)).all();
      const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

      // Update order status
      let newStatus: 'open' | 'billed' | 'paid' = order.status as any;
      let paymentStatus: 'pending' | 'partial' | 'paid' = 'pending';

      if (totalPaid >= order.grandTotal) {
        newStatus = 'paid';
        paymentStatus = 'paid';

        // Free up the table
        if (order.tableId) {
          db.update(tables)
            .set({ currentOrderId: null, lockOwnerDeviceId: null, lockExpiresAt: null, updatedAt: now })
            .where(eq(tables.id, order.tableId))
            .run();

          const table = db.select().from(tables).where(eq(tables.id, order.tableId)).get();
          if (table) {
            emitTableUpdated({
              id: table.id,
              name: table.name,
              currentOrderId: null,
              version: table.version,
              lockOwnerDeviceId: table.lockOwnerDeviceId,
              lockExpiresAt: table.lockExpiresAt,
              sourceDeviceId: deviceId,
              serverTime: now.toISOString(),
            });
          }
        }
      } else if (totalPaid > 0) {
        paymentStatus = 'partial';
      }

      db.update(orders)
        .set({
          status: newStatus,
          paymentStatus,
          updatedAt: now,
          closedAt: newStatus === 'paid' ? now : null,
        })
        .where(eq(orders.id, id))
        .run();
      const version = incrementOrderVersion(id);

      const payment = db.select().from(payments).where(eq(payments.id, paymentId)).get();
      const updatedOrder = db.select().from(orders).where(eq(orders.id, id)).get();
      if (updatedOrder) {
        const eventPayload = {
          id: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          status: updatedOrder.status,
          subtotal: updatedOrder.subtotal,
          taxTotal: updatedOrder.taxTotal,
          grandTotal: updatedOrder.grandTotal,
          version,
          sourceDeviceId: deviceId,
          serverTime: now.toISOString(),
        };
        emitOrderUpdated(eventPayload);
        if (updatedOrder.status === 'paid') {
          emitOrderClosed(eventPayload);
        }
      }

      const response = {
        payment,
        order: updatedOrder,
        totalPaid,
        remaining: Math.max(0, order.grandTotal - totalPaid),
      };

      recordDomainEvent({
        entityType: 'order',
        entityId: id,
        eventType: newStatus === 'paid' ? 'order.closed' : 'order.updated',
        payload: response,
        sourceDeviceId: deviceId,
        actorUserId: request.user!.userId,
      });
      storeIdempotencyResponse(idempotencyKey, cacheKey, request.user!.userId, response);

      return response;
    }
  );

  // Cancel order
  fastify.post(
    '/:id/cancel',
    { preHandler: [requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const deviceId = touchDeviceSession(request);
        const { id } = request.params as { id: string };
        const body = cancelOrderSchema.parse(request.body);

        const order = db.select().from(orders).where(eq(orders.id, id)).get();
        if (!order) {
          return reply.status(404).send({ error: 'Order not found' });
        }

        if (order.status === 'paid' || order.status === 'cancelled') {
          return reply.status(400).send({ error: 'Cannot cancel this order' });
        }

        const now = new Date();

        db.update(orders)
          .set({
            status: 'cancelled',
            updatedAt: now,
            cancelledAt: now,
            cancelReason: body.reason,
          })
          .where(eq(orders.id, id))
          .run();

        // Free up the table
        if (order.tableId) {
          db.update(tables)
            .set({ currentOrderId: null, lockOwnerDeviceId: null, lockExpiresAt: null, updatedAt: now })
            .where(eq(tables.id, order.tableId))
            .run();

          const table = db.select().from(tables).where(eq(tables.id, order.tableId)).get();
          if (table) {
            emitTableUpdated({
              id: table.id,
              name: table.name,
              currentOrderId: null,
              version: table.version,
              lockOwnerDeviceId: table.lockOwnerDeviceId,
              lockExpiresAt: table.lockExpiresAt,
              sourceDeviceId: deviceId,
              serverTime: now.toISOString(),
            });
          }
        }
        const version = incrementOrderVersion(id);

        const updatedOrder = db.select().from(orders).where(eq(orders.id, id)).get();
        if (updatedOrder) {
          emitOrderClosed({
            id: updatedOrder.id,
            orderNumber: updatedOrder.orderNumber,
            status: updatedOrder.status,
            subtotal: updatedOrder.subtotal,
            taxTotal: updatedOrder.taxTotal,
            grandTotal: updatedOrder.grandTotal,
            version,
            sourceDeviceId: deviceId,
            serverTime: now.toISOString(),
          });
          recordDomainEvent({
            entityType: 'order',
            entityId: updatedOrder.id,
            eventType: 'order.closed',
            payload: updatedOrder,
            sourceDeviceId: deviceId,
            actorUserId: request.user!.userId,
          });
        }

        return updatedOrder;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        throw error;
      }
    }
  );
}
