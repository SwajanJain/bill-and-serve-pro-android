import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { createBackup, listBackups, restoreFromBackup } from '../services/backup.service.js';
import { recordDomainEvent, resolveDeviceId, touchDeviceSession } from '../services/sync.service.js';

const restoreSchema = z.object({
  filename: z.string().min(1),
});

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);
  fastify.addHook('preHandler', requireRole('owner'));

  fastify.get('/backups', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const backups = listBackups();
    return backups.map((backup) => ({
      filename: backup.filename,
      size: backup.size,
      checksum: backup.checksum,
      createdAt: backup.createdAt,
    }));
  });

  fastify.post('/backups', async (request: FastifyRequest, reply: FastifyReply) => {
    touchDeviceSession(request);
    const deviceId = resolveDeviceId(request);
    const backup = await createBackup();

    recordDomainEvent({
      entityType: 'backup',
      entityId: backup.filename,
      eventType: 'backup.created',
      payload: {
        filename: backup.filename,
        size: backup.size,
        checksum: backup.checksum,
      },
      sourceDeviceId: deviceId,
      actorUserId: request.user!.userId,
    });

    return reply.status(201).send({
      filename: backup.filename,
      size: backup.size,
      checksum: backup.checksum,
      createdAt: backup.createdAt,
    });
  });

  fastify.post('/restore', async (request: FastifyRequest, reply: FastifyReply) => {
    touchDeviceSession(request);
    const deviceId = resolveDeviceId(request);
    const body = restoreSchema.parse(request.body);

    await restoreFromBackup(body.filename);

    recordDomainEvent({
      entityType: 'backup',
      entityId: body.filename,
      eventType: 'backup.restored',
      payload: { filename: body.filename },
      sourceDeviceId: deviceId,
      actorUserId: request.user!.userId,
    });

    return reply.send({
      success: true,
      restoredFrom: body.filename,
      message: 'Backup restored successfully',
    });
  });
}
