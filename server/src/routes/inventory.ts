import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { rawMaterials, stockTransactions } from '../db/schema.js';
import { eq, lt, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { generateId } from '../utils/id-generator.js';

// Validation schemas
const createMaterialSchema = z.object({
  name: z.string().min(1).max(100),
  unit: z.string().min(1).max(20),
  currentStock: z.number().min(0).optional(),
  lowStockThreshold: z.number().min(0).optional(),
});

const updateMaterialSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  unit: z.string().min(1).max(20).optional(),
  lowStockThreshold: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

const adjustStockSchema = z.object({
  direction: z.enum(['in', 'out']),
  qty: z.number().positive(),
  reason: z.string().min(1).max(200),
});

export default async function inventoryRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all routes
  fastify.addHook('preHandler', authMiddleware);

  // List all materials
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const materials = db.select().from(rawMaterials).all();

    return materials.map(m => ({
      ...m,
      isLowStock: m.currentStock < m.lowStockThreshold,
    }));
  });

  // Get low stock items
  fastify.get('/low-stock', async (request: FastifyRequest, reply: FastifyReply) => {
    // Get all materials where currentStock < lowStockThreshold
    const allMaterials = db.select().from(rawMaterials).where(eq(rawMaterials.isActive, true)).all();

    const lowStock = allMaterials.filter(m => m.currentStock < m.lowStockThreshold);

    return lowStock.map(m => ({
      ...m,
      shortage: m.lowStockThreshold - m.currentStock,
    }));
  });

  // Get material by ID
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const material = db.select().from(rawMaterials).where(eq(rawMaterials.id, id)).get();

    if (!material) {
      return reply.status(404).send({ error: 'Material not found' });
    }

    // Get recent transactions
    const transactions = db
      .select()
      .from(stockTransactions)
      .where(eq(stockTransactions.rawMaterialId, id))
      .orderBy(desc(stockTransactions.createdAt))
      .limit(20)
      .all();

    return {
      ...material,
      isLowStock: material.currentStock < material.lowStockThreshold,
      transactions,
    };
  });

  // Create material
  fastify.post(
    '/',
    { preHandler: [requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createMaterialSchema.parse(request.body);

        const now = new Date();
        const id = generateId();

        db.insert(rawMaterials).values({
          id,
          name: body.name,
          unit: body.unit,
          currentStock: body.currentStock ?? 0,
          lowStockThreshold: body.lowStockThreshold ?? 10,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }).run();

        const material = db.select().from(rawMaterials).where(eq(rawMaterials.id, id)).get();

        return reply.status(201).send(material);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        throw error;
      }
    }
  );

  // Update material
  fastify.patch(
    '/:id',
    { preHandler: [requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updateMaterialSchema.parse(request.body);

        const material = db.select().from(rawMaterials).where(eq(rawMaterials.id, id)).get();

        if (!material) {
          return reply.status(404).send({ error: 'Material not found' });
        }

        db.update(rawMaterials)
          .set({
            ...body,
            updatedAt: new Date(),
          })
          .where(eq(rawMaterials.id, id))
          .run();

        const updated = db.select().from(rawMaterials).where(eq(rawMaterials.id, id)).get();

        return updated;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        throw error;
      }
    }
  );

  // Adjust stock (in/out)
  fastify.post(
    '/:id/adjust',
    { preHandler: [requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = adjustStockSchema.parse(request.body);

        const material = db.select().from(rawMaterials).where(eq(rawMaterials.id, id)).get();

        if (!material) {
          return reply.status(404).send({ error: 'Material not found' });
        }

        const newStock = body.direction === 'in'
          ? material.currentStock + body.qty
          : material.currentStock - body.qty;

        if (newStock < 0) {
          return reply.status(400).send({ error: 'Insufficient stock' });
        }

        const now = new Date();

        // Update stock
        db.update(rawMaterials)
          .set({
            currentStock: newStock,
            updatedAt: now,
          })
          .where(eq(rawMaterials.id, id))
          .run();

        // Record transaction
        const txId = generateId();
        db.insert(stockTransactions).values({
          id: txId,
          rawMaterialId: id,
          direction: body.direction,
          qty: body.qty,
          reason: body.reason,
          createdBy: request.user!.userId,
          createdAt: now,
        }).run();

        const updated = db.select().from(rawMaterials).where(eq(rawMaterials.id, id)).get();

        return {
          material: updated,
          transaction: {
            id: txId,
            direction: body.direction,
            qty: body.qty,
            reason: body.reason,
            createdAt: now,
          },
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        throw error;
      }
    }
  );

  // Delete material
  fastify.delete(
    '/:id',
    { preHandler: [requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const material = db.select().from(rawMaterials).where(eq(rawMaterials.id, id)).get();

      if (!material) {
        return reply.status(404).send({ error: 'Material not found' });
      }

      // Soft delete
      db.update(rawMaterials)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(rawMaterials.id, id))
        .run();

      return { success: true };
    }
  );

  // Get stock transactions
  fastify.get('/transactions', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { limit?: string; materialId?: string };

    let transactions;

    if (query.materialId) {
      transactions = db
        .select()
        .from(stockTransactions)
        .where(eq(stockTransactions.rawMaterialId, query.materialId))
        .orderBy(desc(stockTransactions.createdAt))
        .limit(parseInt(query.limit || '50'))
        .all();
    } else {
      transactions = db
        .select()
        .from(stockTransactions)
        .orderBy(desc(stockTransactions.createdAt))
        .limit(parseInt(query.limit || '50'))
        .all();
    }

    // Enrich with material name
    const enriched = transactions.map(tx => {
      const material = db.select().from(rawMaterials).where(eq(rawMaterials.id, tx.rawMaterialId)).get();
      return {
        ...tx,
        materialName: material?.name,
        unit: material?.unit,
      };
    });

    return enriched;
  });
}
