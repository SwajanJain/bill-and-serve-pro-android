import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq, ne } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { generateId } from '../utils/id-generator.js';

const SALT_ROUNDS = 10;

// Validation schemas
const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  role: z.enum(['owner', 'manager', 'cashier', 'kitchen']),
  pin: z.string().length(4).regex(/^\d+$/).optional(),
  password: z.string().min(6).optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  role: z.enum(['owner', 'manager', 'cashier', 'kitchen']).optional(),
  isActive: z.boolean().optional(),
});

const resetPinSchema = z.object({
  newPin: z.string().length(4).regex(/^\d+$/),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6),
});

export default async function usersRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all routes
  fastify.addHook('preHandler', authMiddleware);

  // List all users
  fastify.get(
    '/',
    { preHandler: [requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const allUsers = db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      }).from(users).all();

      return allUsers;
    }
  );

  // Get user by ID
  fastify.get(
    '/:id',
    { preHandler: [requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const user = db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.id, id)).get();

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return user;
    }
  );

  // Create user
  fastify.post(
    '/',
    { preHandler: [requireRole('owner')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = createUserSchema.parse(request.body);

        // Check if email already exists
        const existing = db.select().from(users).where(eq(users.email, body.email)).get();
        if (existing) {
          return reply.status(400).send({ error: 'Email already in use' });
        }

        const now = new Date();
        const id = generateId();

        let pinHash = null;
        let passwordHash = null;

        if (body.pin) {
          pinHash = await bcrypt.hash(body.pin, SALT_ROUNDS);
        }

        if (body.password) {
          passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);
        }

        db.insert(users).values({
          id,
          name: body.name,
          email: body.email,
          phone: body.phone || null,
          role: body.role,
          pin: pinHash,
          passwordHash,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }).run();

        const user = db.select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
        }).from(users).where(eq(users.id, id)).get();

        return reply.status(201).send(user);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        throw error;
      }
    }
  );

  // Update user
  fastify.patch(
    '/:id',
    { preHandler: [requireRole('owner', 'manager')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updateUserSchema.parse(request.body);

        const user = db.select().from(users).where(eq(users.id, id)).get();

        if (!user) {
          return reply.status(404).send({ error: 'User not found' });
        }

        // Only owner can change roles
        if (body.role && request.user!.role !== 'owner') {
          return reply.status(403).send({ error: 'Only owner can change roles' });
        }

        // Check email uniqueness if changing
        if (body.email && body.email !== user.email) {
          const existing = db.select().from(users).where(eq(users.email, body.email)).get();
          if (existing) {
            return reply.status(400).send({ error: 'Email already in use' });
          }
        }

        db.update(users)
          .set({
            ...body,
            updatedAt: new Date(),
          })
          .where(eq(users.id, id))
          .run();

        const updated = db.select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
        }).from(users).where(eq(users.id, id)).get();

        return updated;
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        throw error;
      }
    }
  );

  // Reset user PIN
  fastify.post(
    '/:id/reset-pin',
    { preHandler: [requireRole('owner')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = resetPinSchema.parse(request.body);

        const user = db.select().from(users).where(eq(users.id, id)).get();

        if (!user) {
          return reply.status(404).send({ error: 'User not found' });
        }

        const pinHash = await bcrypt.hash(body.newPin, SALT_ROUNDS);

        db.update(users)
          .set({
            pin: pinHash,
            updatedAt: new Date(),
          })
          .where(eq(users.id, id))
          .run();

        return { success: true, message: 'PIN reset successfully' };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        throw error;
      }
    }
  );

  // Reset user password
  fastify.post(
    '/:id/reset-password',
    { preHandler: [requireRole('owner')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as { id: string };
        const body = resetPasswordSchema.parse(request.body);

        const user = db.select().from(users).where(eq(users.id, id)).get();

        if (!user) {
          return reply.status(404).send({ error: 'User not found' });
        }

        const passwordHash = await bcrypt.hash(body.newPassword, SALT_ROUNDS);

        db.update(users)
          .set({
            passwordHash,
            updatedAt: new Date(),
          })
          .where(eq(users.id, id))
          .run();

        return { success: true, message: 'Password reset successfully' };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'Validation failed', details: error.errors });
        }
        throw error;
      }
    }
  );

  // Delete user (soft delete)
  fastify.delete(
    '/:id',
    { preHandler: [requireRole('owner')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const user = db.select().from(users).where(eq(users.id, id)).get();

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Cannot delete self
      if (id === request.user!.userId) {
        return reply.status(400).send({ error: 'Cannot delete yourself' });
      }

      // Soft delete
      db.update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(users.id, id))
        .run();

      return { success: true };
    }
  );
}
