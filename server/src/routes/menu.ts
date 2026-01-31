import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { menuItems, categories } from '../db/schema.js';
import { eq, asc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { generateId } from '../utils/id-generator.js';

// Validation schemas
const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const createMenuItemSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  basePrice: z.number().positive(),
  taxRatePercent: z.number().min(0).max(100).optional(),
  isVeg: z.boolean().optional(),
  imageUrl: z.string().url().optional(),
});

const updateMenuItemSchema = z.object({
  categoryId: z.string().optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  basePrice: z.number().positive().optional(),
  taxRatePercent: z.number().min(0).max(100).optional(),
  isVeg: z.boolean().optional(),
  isActive: z.boolean().optional(),
  imageUrl: z.string().url().nullable().optional(),
});

export default async function menuRoutes(fastify: FastifyInstance) {
  // ==================== CATEGORIES ====================

  // List categories (public)
  fastify.get('/categories', async (request: FastifyRequest, reply: FastifyReply) => {
    const allCategories = db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder))
      .all();

    return allCategories;
  });

  // Get category by ID
  fastify.get('/categories/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const category = db.select().from(categories).where(eq(categories.id, id)).get();

    if (!category) {
      return reply.status(404).send({ error: 'Category not found' });
    }

    // Get items in this category
    const items = db.select().from(menuItems).where(eq(menuItems.categoryId, id)).all();

    return {
      ...category,
      items,
    };
  });

  // Create category (owner/manager only)
  fastify.post(
    '/categories',
    { preHandler: [authMiddleware, requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createCategorySchema.parse(request.body);

        const now = new Date();
        const id = generateId();

        // Get max sort order
        const maxSort = db
          .select({ maxOrder: categories.sortOrder })
          .from(categories)
          .orderBy(asc(categories.sortOrder))
          .all();
        const nextSort = body.sortOrder ?? (maxSort.length > 0 ? Math.max(...maxSort.map(m => m.maxOrder)) + 1 : 1);

        db.insert(categories).values({
          id,
          name: body.name,
          sortOrder: nextSort,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }).run();

        const category = db.select().from(categories).where(eq(categories.id, id)).get();

        return reply.status(201).send(category);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        throw error;
      }
    }
  );

  // Update category
  fastify.patch(
    '/categories/:id',
    { preHandler: [authMiddleware, requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updateCategorySchema.parse(request.body);

        const category = db.select().from(categories).where(eq(categories.id, id)).get();

        if (!category) {
          return reply.status(404).send({ error: 'Category not found' });
        }

        db.update(categories)
          .set({
            ...body,
            updatedAt: new Date(),
          })
          .where(eq(categories.id, id))
          .run();

        const updated = db.select().from(categories).where(eq(categories.id, id)).get();

        return updated;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        throw error;
      }
    }
  );

  // Delete category
  fastify.delete(
    '/categories/:id',
    { preHandler: [authMiddleware, requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const category = db.select().from(categories).where(eq(categories.id, id)).get();

      if (!category) {
        return reply.status(404).send({ error: 'Category not found' });
      }

      // Check if category has items
      const items = db.select().from(menuItems).where(eq(menuItems.categoryId, id)).all();

      if (items.length > 0) {
        // Soft delete - mark as inactive
        db.update(categories)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(categories.id, id))
          .run();

        return { success: true, message: 'Category deactivated (has items)' };
      }

      // Hard delete if no items
      db.delete(categories).where(eq(categories.id, id)).run();

      return { success: true };
    }
  );

  // ==================== MENU ITEMS ====================

  // List menu items (public)
  fastify.get('/menu-items', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { categoryId?: string; active?: string };

    let items;

    if (query.categoryId) {
      items = db
        .select()
        .from(menuItems)
        .where(eq(menuItems.categoryId, query.categoryId))
        .all();
    } else {
      items = db.select().from(menuItems).all();
    }

    // Filter active if specified
    if (query.active === 'true') {
      items = items.filter(i => i.isActive);
    }

    // Enrich with category name
    const enriched = items.map(item => {
      const category = db.select().from(categories).where(eq(categories.id, item.categoryId)).get();
      return {
        ...item,
        categoryName: category?.name,
      };
    });

    return enriched;
  });

  // Get menu item by ID
  fastify.get('/menu-items/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const item = db.select().from(menuItems).where(eq(menuItems.id, id)).get();

    if (!item) {
      return reply.status(404).send({ error: 'Menu item not found' });
    }

    const category = db.select().from(categories).where(eq(categories.id, item.categoryId)).get();

    return {
      ...item,
      categoryName: category?.name,
    };
  });

  // Create menu item
  fastify.post(
    '/menu-items',
    { preHandler: [authMiddleware, requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createMenuItemSchema.parse(request.body);

        // Verify category exists
        const category = db.select().from(categories).where(eq(categories.id, body.categoryId)).get();
        if (!category) {
          return reply.status(400).send({ error: 'Category not found' });
        }

        const now = new Date();
        const id = generateId();

        db.insert(menuItems).values({
          id,
          categoryId: body.categoryId,
          name: body.name,
          description: body.description || null,
          basePrice: body.basePrice,
          taxRatePercent: body.taxRatePercent ?? 5,
          isVeg: body.isVeg ?? true,
          isActive: true,
          imageUrl: body.imageUrl || null,
          createdAt: now,
          updatedAt: now,
        }).run();

        const item = db.select().from(menuItems).where(eq(menuItems.id, id)).get();

        return reply.status(201).send({
          ...item,
          categoryName: category.name,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        throw error;
      }
    }
  );

  // Update menu item
  fastify.patch(
    '/menu-items/:id',
    { preHandler: [authMiddleware, requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updateMenuItemSchema.parse(request.body);

        const item = db.select().from(menuItems).where(eq(menuItems.id, id)).get();

        if (!item) {
          return reply.status(404).send({ error: 'Menu item not found' });
        }

        // Verify category if changing
        if (body.categoryId) {
          const category = db.select().from(categories).where(eq(categories.id, body.categoryId)).get();
          if (!category) {
            return reply.status(400).send({ error: 'Category not found' });
          }
        }

        db.update(menuItems)
          .set({
            ...body,
            updatedAt: new Date(),
          })
          .where(eq(menuItems.id, id))
          .run();

        const updated = db.select().from(menuItems).where(eq(menuItems.id, id)).get();
        const category = db.select().from(categories).where(eq(categories.id, updated!.categoryId)).get();

        return {
          ...updated,
          categoryName: category?.name,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        throw error;
      }
    }
  );

  // Delete menu item
  fastify.delete(
    '/menu-items/:id',
    { preHandler: [authMiddleware, requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const item = db.select().from(menuItems).where(eq(menuItems.id, id)).get();

      if (!item) {
        return reply.status(404).send({ error: 'Menu item not found' });
      }

      // Soft delete - mark as inactive
      db.update(menuItems)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(menuItems.id, id))
        .run();

      return { success: true };
    }
  );
}
