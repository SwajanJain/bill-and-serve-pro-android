import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  kots,
  kotLines,
  menuItems,
  orderLines,
  orders,
  payments,
  syncActions,
  tables,
} from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { generateId, generateKOTNumber, generateOrderNumber } from '../utils/id-generator.js';
import {
  acquireOrderLock,
  incrementOrderVersion,
  pullDomainEventsSince,
  recordDomainEvent,
  touchDeviceSession,
  updateSyncCursor,
  validateOrderLock,
} from '../services/sync.service.js';
import {
  emitKOTCreated,
  emitOrderClosed,
  emitOrderCreated,
  emitOrderLineChanged,
  emitOrderUpdated,
  emitTableUpdated,
} from '../socket/index.js';

const syncActionSchema = z.object({
  actionId: z.string().min(1),
  type: z.enum([
    'ORDER_CREATE',
    'ORDER_LINE_ADD',
    'ORDER_LINE_UPDATE',
    'ORDER_LINE_DELETE',
    'ORDER_DISCOUNT_APPLY',
    'ORDER_DISCOUNT_REMOVE',
    'KOT_CREATE',
    'ORDER_BILL',
    'ORDER_PAYMENT_ADD',
    'ORDER_CANCEL',
  ]),
  payload: z.record(z.any()),
  baseVersion: z.number().int().optional(),
  createdAt: z.string().optional(),
});

const pushSchema = z.object({
  actions: z.array(syncActionSchema).min(1).max(200),
});

const pullSchema = z.object({
  cursor: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const ackSchema = z.object({
  cursor: z.number().int().min(0),
});

class SyncConflictError extends Error {
  code: string;
  details: Record<string, unknown>;

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function recalculateOrderTotals(orderId: string) {
  const lines = db.select().from(orderLines).where(eq(orderLines.orderId, orderId)).all();

  let subtotal = 0;
  let taxTotal = 0;
  for (const line of lines) {
    const baseAmount = line.unitPrice * line.qty;
    subtotal += baseAmount;
    taxTotal += baseAmount * (line.taxRate / 100);
  }

  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  let discountAmount = 0;
  if (order?.discountType && order?.discountValue) {
    discountAmount = order.discountType === 'percentage'
      ? subtotal * (order.discountValue / 100)
      : order.discountValue;
  }

  const grandTotal = Math.max(0, subtotal + taxTotal - discountAmount);
  db.update(orders)
    .set({
      subtotal: Math.round(subtotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
    .run();
}

function assertOrderVersion(orderId: string, baseVersion?: number) {
  if (baseVersion === undefined) {
    return;
  }

  const order = db.select({ version: orders.version }).from(orders).where(eq(orders.id, orderId)).get();
  if (!order) {
    throw new SyncConflictError('ORDER_NOT_FOUND', 'Order not found', { orderId });
  }
  if (order.version !== baseVersion) {
    throw new SyncConflictError('VERSION_MISMATCH', 'Order version mismatch', {
      orderId,
      serverVersion: order.version,
      localVersion: baseVersion,
    });
  }
}

function ensureOrderWritable(orderId: string, deviceId: string) {
  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) {
    throw new SyncConflictError('ORDER_NOT_FOUND', 'Order not found', { orderId });
  }
  if (order.status !== 'open') {
    throw new SyncConflictError('ORDER_CLOSED', 'Order is not open', {
      orderId,
      tableId: order.tableId,
      status: order.status,
    });
  }

  const lockState = validateOrderLock(orderId, deviceId);
  if (!lockState.allowed) {
    throw new SyncConflictError(lockState.reason || 'LOCKED', 'Order is locked', {
      orderId,
      tableId: order.tableId,
      lockOwner: lockState.lockOwner,
      lockExpiresAt: lockState.lockExpiresAt?.toISOString(),
    });
  }
}

function processSyncAction(
  action: z.infer<typeof syncActionSchema>,
  actorUserId: string,
  deviceId: string
) {
  const now = new Date();

  if (action.type === 'ORDER_CREATE') {
    const orderType = action.payload.orderType as 'dine-in' | 'takeaway';
    const tableId = (action.payload.tableId as string | undefined) ?? null;

    if (!orderType) {
      throw new SyncConflictError('INVALID_PAYLOAD', 'Missing order type');
    }
    if (orderType === 'dine-in' && !tableId) {
      throw new SyncConflictError('INVALID_PAYLOAD', 'Table is required for dine-in order');
    }
    if (tableId) {
      const table = db.select().from(tables).where(eq(tables.id, tableId)).get();
      if (!table) {
        throw new SyncConflictError('TABLE_NOT_FOUND', 'Table not found');
      }
      if (table.currentOrderId) {
        throw new SyncConflictError('TABLE_OCCUPIED', 'Table is occupied', {
          tableId,
          currentOrderId: table.currentOrderId,
        });
      }
    }

    const orderId = (action.payload.orderId as string | undefined) ?? generateId();
    db.insert(orders).values({
      id: orderId,
      orderNumber: generateOrderNumber(),
      orderType,
      tableId,
      ownerUserId: actorUserId,
      status: 'open',
      version: 1,
      subtotal: 0,
      taxTotal: 0,
      grandTotal: 0,
      paymentStatus: 'pending',
      createdBy: actorUserId,
      createdAt: now,
      updatedAt: now,
    }).run();

    if (tableId) {
      db.update(tables)
        .set({ currentOrderId: orderId, updatedAt: now })
        .where(eq(tables.id, tableId))
        .run();
      acquireOrderLock(orderId, deviceId, 120);
      const table = db.select().from(tables).where(eq(tables.id, tableId)).get();
      if (table) {
        emitTableUpdated({
          id: table.id,
          name: table.name,
          currentOrderId: table.currentOrderId,
          version: table.version,
          lockOwnerDeviceId: table.lockOwnerDeviceId,
          lockExpiresAt: table.lockExpiresAt,
          sourceDeviceId: deviceId,
          serverTime: now.toISOString(),
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
        actorUserId,
      });
    }

    return { orderId, status: 'created' };
  }

  if (action.type === 'ORDER_LINE_ADD') {
    const orderId = action.payload.orderId as string;
    const menuItemId = action.payload.menuItemId as string;
    const qty = Number(action.payload.qty ?? 1);
    const notes = (action.payload.notes as string | undefined) ?? null;
    assertOrderVersion(orderId, action.baseVersion);
    ensureOrderWritable(orderId, deviceId);

    const menuItem = db.select().from(menuItems).where(eq(menuItems.id, menuItemId)).get();
    if (!menuItem) {
      throw new SyncConflictError('MENU_ITEM_NOT_FOUND', 'Menu item not found');
    }

    const lineId = (action.payload.lineId as string | undefined) ?? generateId();
    db.insert(orderLines).values({
      id: lineId,
      orderId,
      menuItemId,
      qty,
      unitPrice: menuItem.basePrice,
      taxRate: menuItem.taxRatePercent,
      lineTotal: menuItem.basePrice * qty,
      notes,
      kotSent: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    }).run();

    recalculateOrderTotals(orderId);
    const orderVersion = incrementOrderVersion(orderId);
    emitOrderLineChanged('order.line.added', {
      orderId,
      lineId,
      version: orderVersion,
      sourceDeviceId: deviceId,
      serverTime: now.toISOString(),
    });
    recordDomainEvent({
      entityType: 'order',
      entityId: orderId,
      eventType: 'order.line.added',
      payload: { orderId, lineId, qty, notes, version: orderVersion },
      sourceDeviceId: deviceId,
      actorUserId,
    });
    return { orderId, lineId, version: orderVersion };
  }

  if (action.type === 'ORDER_LINE_UPDATE') {
    const orderId = action.payload.orderId as string;
    const lineId = action.payload.lineId as string;
    const qty = Number(action.payload.qty);
    const notes = (action.payload.notes as string | undefined) ?? null;
    assertOrderVersion(orderId, action.baseVersion);
    ensureOrderWritable(orderId, deviceId);

    const line = db.select().from(orderLines).where(eq(orderLines.id, lineId)).get();
    if (!line) {
      throw new SyncConflictError('LINE_NOT_FOUND', 'Order line not found');
    }
    db.update(orderLines)
      .set({
        qty,
        lineTotal: line.unitPrice * qty,
        notes,
        version: (line.version ?? 1) + 1,
        updatedAt: now,
      })
      .where(eq(orderLines.id, lineId))
      .run();

    recalculateOrderTotals(orderId);
    const orderVersion = incrementOrderVersion(orderId);
    emitOrderLineChanged('order.line.updated', {
      orderId,
      lineId,
      version: orderVersion,
      sourceDeviceId: deviceId,
      serverTime: now.toISOString(),
    });
    recordDomainEvent({
      entityType: 'order',
      entityId: orderId,
      eventType: 'order.line.updated',
      payload: { orderId, lineId, qty, notes, version: orderVersion },
      sourceDeviceId: deviceId,
      actorUserId,
    });
    return { orderId, lineId, version: orderVersion };
  }

  if (action.type === 'ORDER_LINE_DELETE') {
    const orderId = action.payload.orderId as string;
    const lineId = action.payload.lineId as string;
    assertOrderVersion(orderId, action.baseVersion);
    ensureOrderWritable(orderId, deviceId);

    const line = db.select().from(orderLines).where(eq(orderLines.id, lineId)).get();
    if (!line) {
      throw new SyncConflictError('LINE_NOT_FOUND', 'Order line not found');
    }
    if (line.kotSent) {
      throw new SyncConflictError('LINE_ALREADY_SENT', 'Cannot delete line already sent to kitchen');
    }
    db.delete(orderLines).where(eq(orderLines.id, lineId)).run();
    recalculateOrderTotals(orderId);
    const orderVersion = incrementOrderVersion(orderId);
    emitOrderLineChanged('order.line.removed', {
      orderId,
      lineId,
      version: orderVersion,
      sourceDeviceId: deviceId,
      serverTime: now.toISOString(),
    });
    recordDomainEvent({
      entityType: 'order',
      entityId: orderId,
      eventType: 'order.line.removed',
      payload: { orderId, lineId, version: orderVersion },
      sourceDeviceId: deviceId,
      actorUserId,
    });
    return { orderId, lineId, version: orderVersion };
  }

  if (action.type === 'ORDER_DISCOUNT_APPLY') {
    const orderId = action.payload.orderId as string;
    assertOrderVersion(orderId, action.baseVersion);
    ensureOrderWritable(orderId, deviceId);

    db.update(orders)
      .set({
        discountType: action.payload.discountType as 'percentage' | 'flat',
        discountValue: Number(action.payload.discountValue),
        discountReason: (action.payload.discountReason as string | undefined) ?? null,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId))
      .run();
    recalculateOrderTotals(orderId);
    const version = incrementOrderVersion(orderId);
    recordDomainEvent({
      entityType: 'order',
      entityId: orderId,
      eventType: 'order.updated',
      payload: { orderId, version },
      sourceDeviceId: deviceId,
      actorUserId,
    });
    return { orderId, version };
  }

  if (action.type === 'ORDER_DISCOUNT_REMOVE') {
    const orderId = action.payload.orderId as string;
    assertOrderVersion(orderId, action.baseVersion);
    ensureOrderWritable(orderId, deviceId);

    db.update(orders)
      .set({
        discountType: null,
        discountValue: null,
        discountReason: null,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId))
      .run();
    recalculateOrderTotals(orderId);
    const version = incrementOrderVersion(orderId);
    recordDomainEvent({
      entityType: 'order',
      entityId: orderId,
      eventType: 'order.updated',
      payload: { orderId, version },
      sourceDeviceId: deviceId,
      actorUserId,
    });
    return { orderId, version };
  }

  if (action.type === 'KOT_CREATE') {
    const orderId = action.payload.orderId as string;
    assertOrderVersion(orderId, action.baseVersion);
    ensureOrderWritable(orderId, deviceId);
    const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
    if (!order) {
      throw new SyncConflictError('ORDER_NOT_FOUND', 'Order not found');
    }

    const unsent = db.select().from(orderLines).where(and(eq(orderLines.orderId, orderId), eq(orderLines.kotSent, false))).all();
    if (unsent.length === 0) {
      throw new SyncConflictError('NO_UNSENT_LINES', 'No lines pending for KOT');
    }

    const kotId = (action.payload.kotId as string | undefined) ?? generateId();
    db.insert(kots).values({
      id: kotId,
      orderId,
      kotNumber: generateKOTNumber(),
      status: 'new',
      createdAt: now,
      updatedAt: now,
    }).run();

    for (const line of unsent) {
      db.insert(kotLines).values({
        id: generateId(),
        kotId,
        orderLineId: line.id,
        menuItemName: action.payload.menuItemNameMap?.[line.id] || 'Item',
        qty: line.qty,
        notes: line.notes,
      }).run();
      db.update(orderLines).set({ kotSent: true, updatedAt: now }).where(eq(orderLines.id, line.id)).run();
    }

    const version = incrementOrderVersion(orderId);
    emitKOTCreated({
      id: kotId,
      orderId,
      kotNumber: db.select().from(kots).where(eq(kots.id, kotId)).get()!.kotNumber,
      tableName: null,
      orderType: order.orderType,
      lines: unsent.map(line => ({
        id: line.id,
        menuItemName: action.payload.menuItemNameMap?.[line.id] || 'Item',
        qty: line.qty,
        notes: line.notes,
      })),
      version,
      sourceDeviceId: deviceId,
      serverTime: now.toISOString(),
      createdAt: now,
    });
    recordDomainEvent({
      entityType: 'kot',
      entityId: kotId,
      eventType: 'kot.created',
      payload: { orderId, kotId, version },
      sourceDeviceId: deviceId,
      actorUserId,
    });
    return { orderId, kotId, version };
  }

  if (action.type === 'ORDER_BILL') {
    const orderId = action.payload.orderId as string;
    assertOrderVersion(orderId, action.baseVersion);
    ensureOrderWritable(orderId, deviceId);

    db.update(orders).set({ status: 'billed', updatedAt: now }).where(eq(orders.id, orderId)).run();
    const version = incrementOrderVersion(orderId);
    recordDomainEvent({
      entityType: 'order',
      entityId: orderId,
      eventType: 'order.updated',
      payload: { orderId, status: 'billed', version },
      sourceDeviceId: deviceId,
      actorUserId,
    });
    return { orderId, version, status: 'billed' };
  }

  if (action.type === 'ORDER_PAYMENT_ADD') {
    const orderId = action.payload.orderId as string;
    const method = action.payload.method as 'cash' | 'upi' | 'card';
    const amount = Number(action.payload.amount);
    const reference = (action.payload.reference as string | undefined) ?? null;
    assertOrderVersion(orderId, action.baseVersion);

    const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
    if (!order) {
      throw new SyncConflictError('ORDER_NOT_FOUND', 'Order not found');
    }
    if (order.status === 'cancelled' || order.status === 'paid') {
      throw new SyncConflictError('ORDER_CLOSED', 'Order cannot be paid');
    }

    const paymentId = (action.payload.paymentId as string | undefined) ?? generateId();
    db.insert(payments).values({
      id: paymentId,
      orderId,
      method,
      amount,
      reference,
      receivedAt: now,
      receivedBy: actorUserId,
    }).run();

    const allPayments = db.select().from(payments).where(eq(payments.orderId, orderId)).all();
    const totalPaid = allPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const status = totalPaid >= order.grandTotal ? 'paid' : totalPaid > 0 ? 'billed' : 'open';
    const paymentStatus = totalPaid >= order.grandTotal ? 'paid' : totalPaid > 0 ? 'partial' : 'pending';

    db.update(orders)
      .set({
        status: status as 'open' | 'billed' | 'paid',
        paymentStatus: paymentStatus as 'pending' | 'partial' | 'paid',
        closedAt: status === 'paid' ? now : null,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId))
      .run();
    const version = incrementOrderVersion(orderId);

    const updatedOrder = db.select().from(orders).where(eq(orders.id, orderId)).get();
    if (updatedOrder) {
      const payload = {
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
      emitOrderUpdated(payload);
      if (updatedOrder.status === 'paid') {
        emitOrderClosed(payload);
      }
    }
    recordDomainEvent({
      entityType: 'order',
      entityId: orderId,
      eventType: status === 'paid' ? 'order.closed' : 'order.updated',
      payload: { orderId, paymentId, status, version },
      sourceDeviceId: deviceId,
      actorUserId,
    });
    return { orderId, paymentId, version };
  }

  if (action.type === 'ORDER_CANCEL') {
    const orderId = action.payload.orderId as string;
    assertOrderVersion(orderId, action.baseVersion);

    const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
    if (!order) {
      throw new SyncConflictError('ORDER_NOT_FOUND', 'Order not found');
    }
    if (order.status === 'paid' || order.status === 'cancelled') {
      throw new SyncConflictError('ORDER_CLOSED', 'Order cannot be cancelled');
    }

    db.update(orders)
      .set({
        status: 'cancelled',
        cancelReason: (action.payload.reason as string | undefined) ?? 'Cancelled from sync',
        cancelledAt: now,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId))
      .run();
    if (order.tableId) {
      db.update(tables)
        .set({ currentOrderId: null, lockOwnerDeviceId: null, lockExpiresAt: null, updatedAt: now })
        .where(eq(tables.id, order.tableId))
        .run();
    }
    const version = incrementOrderVersion(orderId);
    recordDomainEvent({
      entityType: 'order',
      entityId: orderId,
      eventType: 'order.closed',
      payload: { orderId, status: 'cancelled', version },
      sourceDeviceId: deviceId,
      actorUserId,
    });
    return { orderId, version, status: 'cancelled' };
  }

  throw new SyncConflictError('UNSUPPORTED_ACTION', `Unsupported action type ${action.type}`);
}

export default async function syncRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  fastify.post('/push', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { actions } = pushSchema.parse(request.body);
      const deviceId = touchDeviceSession(request);
      const now = new Date();
      const results: Array<{
        actionId: string;
        status: 'processed' | 'conflict' | 'failed';
        result?: unknown;
        errorCode?: string;
        errorMessage?: string;
        details?: Record<string, unknown>;
      }> = [];

      for (const action of actions) {
        const existing = db.select().from(syncActions).where(eq(syncActions.actionId, action.actionId)).get();
        if (existing && existing.status !== 'pending') {
          results.push({
            actionId: action.actionId,
            status: existing.status as 'processed' | 'conflict' | 'failed',
            result: existing.resultJson ? JSON.parse(existing.resultJson) : undefined,
            errorCode: existing.errorCode || undefined,
            errorMessage: existing.errorMessage || undefined,
            details: existing.resultJson ? undefined : undefined,
          });
          continue;
        }

        if (!existing) {
          db.insert(syncActions).values({
            actionId: action.actionId,
            deviceId,
            actorUserId: request.user!.userId,
            type: action.type,
            payloadJson: JSON.stringify(action.payload),
            baseVersion: action.baseVersion,
            status: 'pending',
            createdAt: now,
          }).run();
        }

        try {
          const result = processSyncAction(action, request.user!.userId, deviceId);
          db.update(syncActions)
            .set({
              status: 'processed',
              resultJson: JSON.stringify(result),
              processedAt: new Date(),
              errorCode: null,
              errorMessage: null,
            })
            .where(eq(syncActions.actionId, action.actionId))
            .run();

          recordDomainEvent({
            entityType: 'sync_action',
            entityId: action.actionId,
            eventType: 'sync.action.processed',
            payload: { actionId: action.actionId, type: action.type, result },
            sourceDeviceId: deviceId,
            actorUserId: request.user!.userId,
          });

          results.push({
            actionId: action.actionId,
            status: 'processed',
            result,
          });
        } catch (error) {
          if (error instanceof SyncConflictError) {
            db.update(syncActions)
              .set({
                status: 'conflict',
                errorCode: error.code,
                errorMessage: error.message,
                processedAt: new Date(),
              })
              .where(eq(syncActions.actionId, action.actionId))
              .run();
            results.push({
              actionId: action.actionId,
              status: 'conflict',
              errorCode: error.code,
              errorMessage: error.message,
              details: {
                actionId: action.actionId,
                orderId: (action.payload.orderId as string | undefined) || undefined,
                tableId: (action.payload.tableId as string | undefined) || undefined,
                ...error.details,
              },
            });
            continue;
          }

          const message = error instanceof Error ? error.message : 'Unknown sync error';
          db.update(syncActions)
            .set({
              status: 'failed',
              errorCode: 'INTERNAL_ERROR',
              errorMessage: message,
              processedAt: new Date(),
            })
            .where(eq(syncActions.actionId, action.actionId))
            .run();
          results.push({
            actionId: action.actionId,
            status: 'failed',
            errorCode: 'INTERNAL_ERROR',
            errorMessage: message,
          });
        }
      }

      return { deviceId, results };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      throw error;
    }
  });

  fastify.get('/pull', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = pullSchema.parse(request.query);
      const deviceId = touchDeviceSession(request);
      const cursor = query.cursor ?? 0;
      const events = pullDomainEventsSince(cursor, query.limit ?? 200);

      const normalizedEvents = events.map((event) => ({
        seq: event.seq,
        entityType: event.entityType,
        entityId: event.entityId,
        eventType: event.eventType,
        sourceDeviceId: event.sourceDeviceId,
        actorUserId: event.actorUserId,
        createdAt: event.createdAt,
        payload: JSON.parse(event.payloadJson),
      }));

      const lastSeq = normalizedEvents.length > 0
        ? normalizedEvents[normalizedEvents.length - 1].seq
        : cursor;
      updateSyncCursor(deviceId, lastSeq);

      return {
        cursor: lastSeq,
        events: normalizedEvents,
        hasMore: normalizedEvents.length >= (query.limit ?? 200),
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      throw error;
    }
  });

  fastify.post('/ack', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = ackSchema.parse(request.body);
      const deviceId = touchDeviceSession(request);
      updateSyncCursor(deviceId, body.cursor);
      return { success: true, deviceId, cursor: body.cursor };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      throw error;
    }
  });
}
