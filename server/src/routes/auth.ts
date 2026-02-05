import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { authMiddleware, type JWTPayload } from '../middleware/auth.js';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const pinLoginSchema = z.object({
  pin: z.string().length(4),
});

export default async function authRoutes(fastify: FastifyInstance) {
  // Login with email/password
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = loginSchema.parse(request.body);

      const user = db
        .select()
        .from(users)
        .where(eq(users.email, body.email))
        .get();

      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      if (!user.isActive) {
        return reply.status(401).send({ error: 'Account is deactivated' });
      }

      if (!user.passwordHash) {
        return reply.status(401).send({ error: 'Password not set for this user' });
      }

      const isValid = await bcrypt.compare(body.password, user.passwordHash);
      if (!isValid) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const payload: JWTPayload = {
        userId: user.id,
        email: user.email,
        role: user.role as JWTPayload['role'],
        name: user.name,
        deviceId: typeof request.headers['x-device-id'] === 'string' ? request.headers['x-device-id'] : undefined,
      };

      const token = fastify.jwt.sign(payload);

      return {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.errors,
        });
      }
      throw error;
    }
  });

  // Login with PIN
  fastify.post('/pin-login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = pinLoginSchema.parse(request.body);

      // Find all active users and check PIN
      const allUsers = db
        .select()
        .from(users)
        .where(eq(users.isActive, true))
        .all();

      let matchedUser = null;

      for (const user of allUsers) {
        if (user.pin) {
          const isValid = await bcrypt.compare(body.pin, user.pin);
          if (isValid) {
            matchedUser = user;
            break;
          }
        }
      }

      if (!matchedUser) {
        return reply.status(401).send({ error: 'Invalid PIN' });
      }

      const payload: JWTPayload = {
        userId: matchedUser.id,
        email: matchedUser.email,
        role: matchedUser.role as JWTPayload['role'],
        name: matchedUser.name,
        deviceId: typeof request.headers['x-device-id'] === 'string' ? request.headers['x-device-id'] : undefined,
      };

      const token = fastify.jwt.sign(payload);

      return {
        token,
        user: {
          id: matchedUser.id,
          name: matchedUser.name,
          email: matchedUser.email,
          role: matchedUser.role,
          phone: matchedUser.phone,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.errors,
        });
      }
      throw error;
    }
  });

  // Get current user
  fastify.get(
    '/me',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = db
        .select()
        .from(users)
        .where(eq(users.id, request.user!.userId))
        .get();

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
      };
    }
  );

  // Logout (client-side token removal, but we log it)
  fastify.post(
    '/logout',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest) => {
      // In a more complex setup, we'd invalidate the token server-side
      // For now, we just acknowledge the logout
      return { success: true, message: 'Logged out successfully' };
    }
  );

  // Change password
  fastify.post(
    '/change-password',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const schema = z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6),
      });

      try {
        const body = schema.parse(request.body);

        const user = db
          .select()
          .from(users)
          .where(eq(users.id, request.user!.userId))
          .get();

        if (!user || !user.passwordHash) {
          return reply.status(400).send({ error: 'Cannot change password' });
        }

        const isValid = await bcrypt.compare(body.currentPassword, user.passwordHash);
        if (!isValid) {
          return reply.status(400).send({ error: 'Current password is incorrect' });
        }

        const newHash = await bcrypt.hash(body.newPassword, 10);

        db.update(users)
          .set({ passwordHash: newHash, updatedAt: new Date() })
          .where(eq(users.id, user.id))
          .run();

        return { success: true, message: 'Password changed successfully' };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation failed',
            details: error.errors,
          });
        }
        throw error;
      }
    }
  );

  // Change PIN
  fastify.post(
    '/change-pin',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const schema = z.object({
        newPin: z.string().length(4).regex(/^\d+$/),
      });

      try {
        const body = schema.parse(request.body);

        const newPinHash = await bcrypt.hash(body.newPin, 10);

        db.update(users)
          .set({ pin: newPinHash, updatedAt: new Date() })
          .where(eq(users.id, request.user!.userId))
          .run();

        return { success: true, message: 'PIN changed successfully' };
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            error: 'Validation failed',
            details: error.errors,
          });
        }
        throw error;
      }
    }
  );
}
