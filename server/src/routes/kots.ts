import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { kots, kotLines, orders, tables } from '../db/schema.js';
import { eq, and, ne, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { emitKOTUpdated } from '../socket/index.js';
import { recordDomainEvent, resolveDeviceId, touchDeviceSession } from '../services/sync.service.js';

const updateStatusSchema = z.object({
  status: z.enum(['new', 'preparing', 'ready']),
});

export default async function kotsRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all routes
  fastify.addHook('preHandler', authMiddleware);

  // List all KOTs (with optional status filter)
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { status?: string };

    let kotsQuery;

    if (query.status) {
      kotsQuery = db
        .select()
        .from(kots)
        .where(eq(kots.status, query.status as any))
        .orderBy(desc(kots.createdAt))
        .all();
    } else {
      kotsQuery = db
        .select()
        .from(kots)
        .orderBy(desc(kots.createdAt))
        .all();
    }

    // Enrich with lines and order info
    const enriched = kotsQuery.map(kot => {
      const lines = db.select().from(kotLines).where(eq(kotLines.kotId, kot.id)).all();
      const order = db.select().from(orders).where(eq(orders.id, kot.orderId)).get();
      const table = order?.tableId
        ? db.select().from(tables).where(eq(tables.id, order.tableId)).get()
        : null;

      return {
        ...kot,
        lines,
        orderNumber: order?.orderNumber,
        orderType: order?.orderType,
        tableName: table?.name || null,
      };
    });

    return enriched;
  });

  // List active KOTs (not ready)
  fastify.get('/active', async (request: FastifyRequest, reply: FastifyReply) => {
    const activeKots = db
      .select()
      .from(kots)
      .where(ne(kots.status, 'ready'))
      .orderBy(kots.createdAt)
      .all();

    // Enrich with lines and order info
    const enriched = activeKots.map(kot => {
      const lines = db.select().from(kotLines).where(eq(kotLines.kotId, kot.id)).all();
      const order = db.select().from(orders).where(eq(orders.id, kot.orderId)).get();
      const table = order?.tableId
        ? db.select().from(tables).where(eq(tables.id, order.tableId)).get()
        : null;

      return {
        ...kot,
        lines,
        orderNumber: order?.orderNumber,
        orderType: order?.orderType,
        tableName: table?.name || null,
      };
    });

    return enriched;
  });

  // Get KOT by ID
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const kot = db.select().from(kots).where(eq(kots.id, id)).get();

    if (!kot) {
      return reply.status(404).send({ error: 'KOT not found' });
    }

    const lines = db.select().from(kotLines).where(eq(kotLines.kotId, id)).all();
    const order = db.select().from(orders).where(eq(orders.id, kot.orderId)).get();
    const table = order?.tableId
      ? db.select().from(tables).where(eq(tables.id, order.tableId)).get()
      : null;

    return {
      ...kot,
      lines,
      orderNumber: order?.orderNumber,
      orderType: order?.orderType,
      tableName: table?.name || null,
    };
  });

  // Update KOT status
  fastify.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      touchDeviceSession(request);
      const deviceId = resolveDeviceId(request);
      const { id } = request.params as { id: string };
      const body = updateStatusSchema.parse(request.body);

      const kot = db.select().from(kots).where(eq(kots.id, id)).get();

      if (!kot) {
        return reply.status(404).send({ error: 'KOT not found' });
      }

      const now = new Date();

      db.update(kots)
        .set({
          status: body.status,
          updatedAt: now,
        })
        .where(eq(kots.id, id))
        .run();

      // Emit Socket.io event
      emitKOTUpdated({
        id,
        status: body.status,
        sourceDeviceId: deviceId,
        serverTime: now.toISOString(),
        updatedAt: now,
      });

      const updatedKot = db.select().from(kots).where(eq(kots.id, id)).get();

      const lines = db.select().from(kotLines).where(eq(kotLines.kotId, id)).all();
      const order = db.select().from(orders).where(eq(orders.id, kot.orderId)).get();
      const table = order?.tableId
        ? db.select().from(tables).where(eq(tables.id, order.tableId)).get()
        : null;

      recordDomainEvent({
        entityType: 'kot',
        entityId: id,
        eventType: 'kot.updated',
        payload: { status: body.status, updatedAt: now.toISOString() },
        sourceDeviceId: deviceId,
        actorUserId: request.user!.userId,
      });

      return {
        ...updatedKot,
        lines,
        orderNumber: order?.orderNumber,
        orderType: order?.orderType,
        tableName: table?.name || null,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      throw error;
    }
  });

  // Update KOT status (alternative endpoint)
  fastify.patch('/:id/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      touchDeviceSession(request);
      const deviceId = resolveDeviceId(request);
      const { id } = request.params as { id: string };
      const body = updateStatusSchema.parse(request.body);

      const kot = db.select().from(kots).where(eq(kots.id, id)).get();

      if (!kot) {
        return reply.status(404).send({ error: 'KOT not found' });
      }

      const now = new Date();

      db.update(kots)
        .set({
          status: body.status,
          updatedAt: now,
        })
        .where(eq(kots.id, id))
        .run();

      // Emit Socket.io event
      emitKOTUpdated({
        id,
        status: body.status,
        sourceDeviceId: deviceId,
        serverTime: now.toISOString(),
        updatedAt: now,
      });

      const updatedKot = db.select().from(kots).where(eq(kots.id, id)).get();

      recordDomainEvent({
        entityType: 'kot',
        entityId: id,
        eventType: 'kot.updated',
        payload: updatedKot,
        sourceDeviceId: deviceId,
        actorUserId: request.user!.userId,
      });

      return updatedKot;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: error.errors });
      }
      throw error;
    }
  });
}
