import { FastifyRequest } from 'fastify';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  deviceSessions,
  domainEvents,
  idempotencyKeys,
  orders,
  syncCursors,
  tables,
} from '../db/schema.js';

const DEFAULT_LOCK_TTL_SECONDS = 120;

export function resolveDeviceId(request: FastifyRequest): string {
  const headerDeviceId = request.headers['x-device-id'];
  if (typeof headerDeviceId === 'string' && headerDeviceId.trim().length > 0) {
    return headerDeviceId.trim();
  }
  return `web-${request.user?.userId || 'anonymous'}`;
}

export function touchDeviceSession(request: FastifyRequest): string {
  const now = new Date();
  const deviceId = resolveDeviceId(request);
  const existing = db.select().from(deviceSessions).where(eq(deviceSessions.deviceId, deviceId)).get();
  const appVersion = typeof request.headers['x-app-version'] === 'string'
    ? request.headers['x-app-version']
    : null;

  if (existing) {
    db.update(deviceSessions)
      .set({
        userId: request.user!.userId,
        appVersion,
        lastSeenAt: now,
      })
      .where(eq(deviceSessions.deviceId, deviceId))
      .run();
  } else {
    db.insert(deviceSessions).values({
      deviceId,
      userId: request.user!.userId,
      appVersion,
      lastSeenAt: now,
      createdAt: now,
    }).run();
  }

  return deviceId;
}

export function recordDomainEvent(input: {
  entityType: string;
  entityId: string;
  eventType: string;
  payload: unknown;
  sourceDeviceId?: string | null;
  actorUserId?: string | null;
}): number {
  const now = new Date();
  const row = db.insert(domainEvents).values({
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: input.eventType,
    payloadJson: JSON.stringify(input.payload ?? {}),
    sourceDeviceId: input.sourceDeviceId || null,
    actorUserId: input.actorUserId || null,
    createdAt: now,
  }).run();
  return Number(row.lastInsertRowid);
}

export function getCachedIdempotencyResponse(
  key: string | undefined,
  endpoint: string,
  actorUserId: string
): unknown | null {
  if (!key) {
    return null;
  }

  const cached = db
    .select()
    .from(idempotencyKeys)
    .where(and(
      eq(idempotencyKeys.key, key),
      eq(idempotencyKeys.endpoint, endpoint),
      eq(idempotencyKeys.actorUserId, actorUserId),
    ))
    .get();

  if (!cached) {
    return null;
  }

  try {
    return JSON.parse(cached.responseJson);
  } catch {
    return null;
  }
}

export function storeIdempotencyResponse(
  key: string | undefined,
  endpoint: string,
  actorUserId: string,
  response: unknown
): void {
  if (!key) {
    return;
  }

  const now = new Date();
  const payload = JSON.stringify(response);

  const existing = db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, key)).get();
  if (existing) {
    db.update(idempotencyKeys)
      .set({
        endpoint,
        actorUserId,
        responseJson: payload,
        createdAt: now,
      })
      .where(eq(idempotencyKeys.key, key))
      .run();
    return;
  }

  db.insert(idempotencyKeys).values({
    key,
    endpoint,
    actorUserId,
    responseJson: payload,
    createdAt: now,
  }).run();
}

function clearExpiredTableLock(tableId: string): void {
  const table = db.select().from(tables).where(eq(tables.id, tableId)).get();
  if (!table?.lockExpiresAt || !table.lockOwnerDeviceId) {
    return;
  }

  const now = new Date();
  if (table.lockExpiresAt < now) {
    db.update(tables)
      .set({
        lockOwnerDeviceId: null,
        lockExpiresAt: null,
        version: (table.version ?? 1) + 1,
        updatedAt: now,
      })
      .where(eq(tables.id, tableId))
      .run();
  }
}

export function validateOrderLock(orderId: string, deviceId: string): {
  allowed: boolean;
  reason?: 'ORDER_NOT_FOUND' | 'ORDER_CLOSED' | 'LOCKED';
  lockOwner?: string | null;
  lockExpiresAt?: Date | null;
} {
  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) {
    return { allowed: false, reason: 'ORDER_NOT_FOUND' };
  }

  if (order.status !== 'open') {
    return { allowed: false, reason: 'ORDER_CLOSED' };
  }

  if (!order.tableId) {
    return { allowed: true };
  }

  clearExpiredTableLock(order.tableId);
  const table = db.select().from(tables).where(eq(tables.id, order.tableId)).get();
  if (!table) {
    return { allowed: true };
  }

  if (!table.lockOwnerDeviceId || !table.lockExpiresAt) {
    return { allowed: true };
  }

  if (table.lockOwnerDeviceId === deviceId) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'LOCKED',
    lockOwner: table.lockOwnerDeviceId,
    lockExpiresAt: table.lockExpiresAt,
  };
}

export function acquireOrderLock(orderId: string, deviceId: string, ttlSeconds = DEFAULT_LOCK_TTL_SECONDS): {
  success: boolean;
  lockOwner?: string | null;
  lockExpiresAt?: Date | null;
  reason?: 'ORDER_NOT_FOUND' | 'ORDER_CLOSED' | 'LOCKED';
} {
  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) {
    return { success: false, reason: 'ORDER_NOT_FOUND' };
  }
  if (order.status !== 'open') {
    return { success: false, reason: 'ORDER_CLOSED' };
  }
  if (!order.tableId) {
    return { success: true };
  }

  clearExpiredTableLock(order.tableId);
  const table = db.select().from(tables).where(eq(tables.id, order.tableId)).get();
  if (!table) {
    return { success: true };
  }

  if (table.lockOwnerDeviceId && table.lockOwnerDeviceId !== deviceId && table.lockExpiresAt && table.lockExpiresAt > new Date()) {
    return {
      success: false,
      reason: 'LOCKED',
      lockOwner: table.lockOwnerDeviceId,
      lockExpiresAt: table.lockExpiresAt,
    };
  }

  const now = new Date();
  const lockExpiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  db.update(tables)
    .set({
      lockOwnerDeviceId: deviceId,
      lockExpiresAt,
      version: (table.version ?? 1) + 1,
      updatedAt: now,
    })
    .where(eq(tables.id, table.id))
    .run();

  return { success: true, lockOwner: deviceId, lockExpiresAt };
}

export function releaseOrderLock(orderId: string, deviceId: string, force = false): {
  success: boolean;
  reason?: 'ORDER_NOT_FOUND' | 'TABLE_NOT_FOUND' | 'LOCK_NOT_OWNED';
} {
  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) {
    return { success: false, reason: 'ORDER_NOT_FOUND' };
  }
  if (!order.tableId) {
    return { success: true };
  }

  const table = db.select().from(tables).where(eq(tables.id, order.tableId)).get();
  if (!table) {
    return { success: false, reason: 'TABLE_NOT_FOUND' };
  }

  if (!force && table.lockOwnerDeviceId && table.lockOwnerDeviceId !== deviceId) {
    return { success: false, reason: 'LOCK_NOT_OWNED' };
  }

  db.update(tables)
    .set({
      lockOwnerDeviceId: null,
      lockExpiresAt: null,
      version: (table.version ?? 1) + 1,
      updatedAt: new Date(),
    })
    .where(eq(tables.id, table.id))
    .run();

  return { success: true };
}

export function incrementOrderVersion(orderId: string): number {
  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) {
    return 0;
  }
  const nextVersion = (order.version ?? 1) + 1;
  db.update(orders)
    .set({
      version: nextVersion,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId))
    .run();

  return nextVersion;
}

export function pullDomainEventsSince(cursor: number, limit: number) {
  const safeLimit = Math.max(1, Math.min(500, limit));
  return db.select().from(domainEvents).where(gt(domainEvents.seq, cursor)).limit(safeLimit).all();
}

export function updateSyncCursor(deviceId: string, lastEventSeq: number) {
  const now = new Date();
  const existing = db.select().from(syncCursors).where(eq(syncCursors.deviceId, deviceId)).get();
  if (existing) {
    db.update(syncCursors)
      .set({
        lastEventSeq,
        updatedAt: now,
      })
      .where(eq(syncCursors.deviceId, deviceId))
      .run();
  } else {
    db.insert(syncCursors).values({
      deviceId,
      lastEventSeq,
      updatedAt: now,
    }).run();
  }
}
