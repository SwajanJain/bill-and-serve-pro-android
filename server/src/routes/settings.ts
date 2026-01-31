import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { settings, auditEvents } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth.js';

// Validation schema
const updateSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  gstin: z.string().max(20).optional(),
  defaultTaxRate: z.number().min(0).max(100).optional(),
  serviceCharge: z.number().min(0).max(100).optional(),
  showTaxBreakdown: z.boolean().optional(),
  cashierDiscountLimit: z.number().min(0).max(100).optional(),
  requireCancelReason: z.boolean().optional(),
  lowStockAlerts: z.boolean().optional(),
  newOrderSound: z.boolean().optional(),
  invoicePrefix: z.string().max(10).optional(),
  kotPrefix: z.string().max(10).optional(),
});

export default async function settingsRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all routes
  fastify.addHook('preHandler', authMiddleware);

  // Get settings
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    let currentSettings = db.select().from(settings).where(eq(settings.id, 1)).get();

    // Create default settings if not exists
    if (!currentSettings) {
      db.insert(settings).values({
        id: 1,
        name: 'My Restaurant',
        phone: '',
        address: '',
        gstin: '',
        defaultTaxRate: 5,
        serviceCharge: 0,
        showTaxBreakdown: true,
        cashierDiscountLimit: 10,
        requireCancelReason: true,
        lowStockAlerts: true,
        newOrderSound: true,
        invoicePrefix: 'INV',
        kotPrefix: 'KOT',
        updatedAt: new Date(),
      }).run();

      currentSettings = db.select().from(settings).where(eq(settings.id, 1)).get();
    }

    return currentSettings;
  });

  // Update settings
  fastify.patch(
    '/',
    { preHandler: [requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = updateSettingsSchema.parse(request.body);

        // Ensure settings exist
        let currentSettings = db.select().from(settings).where(eq(settings.id, 1)).get();

        if (!currentSettings) {
          db.insert(settings).values({
            id: 1,
            name: 'My Restaurant',
            updatedAt: new Date(),
          }).run();
        }

        db.update(settings)
          .set({
            ...body,
            updatedAt: new Date(),
          })
          .where(eq(settings.id, 1))
          .run();

        const updated = db.select().from(settings).where(eq(settings.id, 1)).get();

        return updated;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        throw error;
      }
    }
  );

  // Get audit log
  fastify.get(
    '/audit',
    { preHandler: [requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as {
        limit?: string;
        eventType?: string;
        entityType?: string;
      };

      let events;

      if (query.eventType) {
        events = db
          .select()
          .from(auditEvents)
          .where(eq(auditEvents.eventType, query.eventType))
          .orderBy(desc(auditEvents.createdAt))
          .limit(parseInt(query.limit || '100'))
          .all();
      } else if (query.entityType) {
        events = db
          .select()
          .from(auditEvents)
          .where(eq(auditEvents.entityType, query.entityType))
          .orderBy(desc(auditEvents.createdAt))
          .limit(parseInt(query.limit || '100'))
          .all();
      } else {
        events = db
          .select()
          .from(auditEvents)
          .orderBy(desc(auditEvents.createdAt))
          .limit(parseInt(query.limit || '100'))
          .all();
      }

      return events;
    }
  );
}
