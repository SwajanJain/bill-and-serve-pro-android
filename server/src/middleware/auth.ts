import { FastifyRequest, FastifyReply } from 'fastify';

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'owner' | 'manager' | 'cashier' | 'kitchen';
  name: string;
  deviceId?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JWTPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload;
    user: JWTPayload;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch (error) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}

// Role-based access control middleware
type Role = 'owner' | 'manager' | 'cashier' | 'kitchen';

const roleHierarchy: Record<Role, number> = {
  owner: 4,
  manager: 3,
  cashier: 2,
  kitchen: 1,
};

export function requireRole(...allowedRoles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const userRole = request.user.role as Role;

    // Owner can access everything
    if (userRole === 'owner') {
      return;
    }

    // Check if user's role is in allowed roles
    if (!allowedRoles.includes(userRole)) {
      return reply.status(403).send({ error: 'Forbidden: insufficient permissions' });
    }
  };
}

// Specific permission checks
export const permissions = {
  canManageUsers: requireRole('owner'),
  canManageSettings: requireRole('owner', 'manager'),
  canApplyDiscount: requireRole('owner', 'manager', 'cashier'),
  canCancelOrder: requireRole('owner', 'manager'),
  canProcessPayment: requireRole('owner', 'manager', 'cashier'),
  canManageMenu: requireRole('owner', 'manager'),
  canManageInventory: requireRole('owner', 'manager'),
  canViewReports: requireRole('owner', 'manager'),
  canUpdateKOT: requireRole('owner', 'manager', 'cashier', 'kitchen'),
};
