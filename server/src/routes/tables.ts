import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { tables, areas, orders } from '../db/schema.js';
import { eq, asc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { generateId } from '../utils/id-generator.js';

// Validation schemas
const createAreaSchema = z.object({
  name: z.string().min(1).max(50),
  sortOrder: z.number().int().optional(),
});

const updateAreaSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const createTableSchema = z.object({
  areaId: z.string(),
  name: z.string().min(1).max(20),
  capacity: z.number().int().positive().optional(),
});

const updateTableSchema = z.object({
  areaId: z.string().optional(),
  name: z.string().min(1).max(20).optional(),
  capacity: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export default async function tablesRoutes(fastify: FastifyInstance) {
  // ==================== AREAS ====================

  // List areas with tables
  fastify.get('/areas', async (request: FastifyRequest, reply: FastifyReply) => {
    const allAreas = db
      .select()
      .from(areas)
      .orderBy(asc(areas.sortOrder))
      .all();

    // Enrich with tables
    const enriched = allAreas.map(area => {
      const areaTables = db
        .select()
        .from(tables)
        .where(eq(tables.areaId, area.id))
        .all();

      // Enrich tables with order info
      const tablesWithStatus = areaTables.map(table => {
        let currentOrder = null;
        if (table.currentOrderId) {
          currentOrder = db.select().from(orders).where(eq(orders.id, table.currentOrderId)).get();
        }
        return {
          ...table,
          currentOrder,
          isOccupied: !!table.currentOrderId,
        };
      });

      return {
        ...area,
        tables: tablesWithStatus,
      };
    });

    return enriched;
  });

  // Get area by ID
  fastify.get('/areas/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const area = db.select().from(areas).where(eq(areas.id, id)).get();

    if (!area) {
      return reply.status(404).send({ error: 'Area not found' });
    }

    const areaTables = db.select().from(tables).where(eq(tables.areaId, id)).all();

    return {
      ...area,
      tables: areaTables,
    };
  });

  // Create area
  fastify.post(
    '/areas',
    { preHandler: [authMiddleware, requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createAreaSchema.parse(request.body);

        const now = new Date();
        const id = generateId();

        // Get max sort order
        const allAreas = db.select().from(areas).all();
        const nextSort = body.sortOrder ?? (allAreas.length > 0 ? Math.max(...allAreas.map(a => a.sortOrder)) + 1 : 1);

        db.insert(areas).values({
          id,
          name: body.name,
          sortOrder: nextSort,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }).run();

        const area = db.select().from(areas).where(eq(areas.id, id)).get();

        return reply.status(201).send(area);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        throw error;
      }
    }
  );

  // Update area
  fastify.patch(
    '/areas/:id',
    { preHandler: [authMiddleware, requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updateAreaSchema.parse(request.body);

        const area = db.select().from(areas).where(eq(areas.id, id)).get();

        if (!area) {
          return reply.status(404).send({ error: 'Area not found' });
        }

        db.update(areas)
          .set({
            ...body,
            updatedAt: new Date(),
          })
          .where(eq(areas.id, id))
          .run();

        const updated = db.select().from(areas).where(eq(areas.id, id)).get();

        return updated;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        throw error;
      }
    }
  );

  // Delete area
  fastify.delete(
    '/areas/:id',
    { preHandler: [authMiddleware, requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const area = db.select().from(areas).where(eq(areas.id, id)).get();

      if (!area) {
        return reply.status(404).send({ error: 'Area not found' });
      }

      // Check if area has tables
      const areaTables = db.select().from(tables).where(eq(tables.areaId, id)).all();

      if (areaTables.length > 0) {
        // Soft delete
        db.update(areas)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(areas.id, id))
          .run();

        return { success: true, message: 'Area deactivated (has tables)' };
      }

      // Hard delete
      db.delete(areas).where(eq(areas.id, id)).run();

      return { success: true };
    }
  );

  // ==================== TABLES ====================

  // List all tables
  fastify.get('/tables', async (request: FastifyRequest, reply: FastifyReply) => {
    const allTables = db.select().from(tables).all();

    // Enrich with area name and order info
    const enriched = allTables.map(table => {
      const area = db.select().from(areas).where(eq(areas.id, table.areaId)).get();
      let currentOrder = null;
      if (table.currentOrderId) {
        currentOrder = db.select().from(orders).where(eq(orders.id, table.currentOrderId)).get();
      }

      return {
        ...table,
        areaName: area?.name,
        currentOrder,
        isOccupied: !!table.currentOrderId,
      };
    });

    return enriched;
  });

  // Get table by ID
  fastify.get('/tables/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const table = db.select().from(tables).where(eq(tables.id, id)).get();

    if (!table) {
      return reply.status(404).send({ error: 'Table not found' });
    }

    const area = db.select().from(areas).where(eq(areas.id, table.areaId)).get();
    let currentOrder = null;
    if (table.currentOrderId) {
      currentOrder = db.select().from(orders).where(eq(orders.id, table.currentOrderId)).get();
    }

    return {
      ...table,
      areaName: area?.name,
      currentOrder,
      isOccupied: !!table.currentOrderId,
    };
  });

  // Create table
  fastify.post(
    '/tables',
    { preHandler: [authMiddleware, requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createTableSchema.parse(request.body);

        // Verify area exists
        const area = db.select().from(areas).where(eq(areas.id, body.areaId)).get();
        if (!area) {
          return reply.status(400).send({ error: 'Area not found' });
        }

        const now = new Date();
        const id = generateId();

        db.insert(tables).values({
          id,
          areaId: body.areaId,
          name: body.name,
          capacity: body.capacity ?? 4,
          isActive: true,
          currentOrderId: null,
          createdAt: now,
          updatedAt: now,
        }).run();

        const table = db.select().from(tables).where(eq(tables.id, id)).get();

        return reply.status(201).send({
          ...table,
          areaName: area.name,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        throw error;
      }
    }
  );

  // Update table
  fastify.patch(
    '/tables/:id',
    { preHandler: [authMiddleware, requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updateTableSchema.parse(request.body);

        const table = db.select().from(tables).where(eq(tables.id, id)).get();

        if (!table) {
          return reply.status(404).send({ error: 'Table not found' });
        }

        // Verify new area if changing
        if (body.areaId) {
          const area = db.select().from(areas).where(eq(areas.id, body.areaId)).get();
          if (!area) {
            return reply.status(400).send({ error: 'Area not found' });
          }
        }

        db.update(tables)
          .set({
            ...body,
            updatedAt: new Date(),
          })
          .where(eq(tables.id, id))
          .run();

        const updated = db.select().from(tables).where(eq(tables.id, id)).get();
        const area = db.select().from(areas).where(eq(areas.id, updated!.areaId)).get();

        return {
          ...updated,
          areaName: area?.name,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        throw error;
      }
    }
  );

  // Delete table
  fastify.delete(
    '/tables/:id',
    { preHandler: [authMiddleware, requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const table = db.select().from(tables).where(eq(tables.id, id)).get();

      if (!table) {
        return reply.status(404).send({ error: 'Table not found' });
      }

      if (table.currentOrderId) {
        return reply.status(400).send({ error: 'Cannot delete table with active order' });
      }

      // Soft delete
      db.update(tables)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(tables.id, id))
        .run();

      return { success: true };
    }
  );
}
