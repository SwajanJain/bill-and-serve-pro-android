import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { createServer } from 'http';
import { setupSocketIO } from './socket/index.js';
import { isAllowedOrigin } from './utils/origin.js';
import { registerWebStaticRoutes } from './services/web-static.service.js';
import { scheduleBackups } from './services/backup.service.js';
import { createMemoryRateLimiter } from './middleware/rate-limit.js';

// Import routes
import authRoutes from './routes/auth.js';
import ordersRoutes from './routes/orders.js';
import kotsRoutes from './routes/kots.js';
import menuRoutes from './routes/menu.js';
import tablesRoutes from './routes/tables.js';
import inventoryRoutes from './routes/inventory.js';
import usersRoutes from './routes/users.js';
import settingsRoutes from './routes/settings.js';
import reportsRoutes from './routes/reports.js';
import syncRoutes from './routes/sync.js';
import adminRoutes from './routes/admin.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const DB_CLIENT = process.env.DB_CLIENT || 'sqlite';
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

async function start() {
  if (NODE_ENV === 'production') {
    const defaultJwtSecret = 'your-super-secret-jwt-key-change-in-production';
    if (!JWT_SECRET || JWT_SECRET === defaultJwtSecret || JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be set to a secure 32+ char value in production');
    }
  }

  // Create Fastify instance
  const fastify = Fastify({
    logger: NODE_ENV === 'production'
      ? { level: process.env.LOG_LEVEL || 'info' }
      : {
          level: 'info',
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        },
  });

  // Register CORS
  await fastify.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (isAllowedOrigin(origin, FRONTEND_URL)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key', 'X-Device-Id', 'X-App-Version'],
  });

  // Register JWT
  await fastify.register(jwt, {
    secret: JWT_SECRET,
    sign: {
      expiresIn: '24h',
    },
  });

  const authRateLimiter = createMemoryRateLimiter({
    name: 'auth',
    max: NODE_ENV === 'production' ? 30 : 120,
    windowMs: 60_000,
    match: (request) => request.url.startsWith('/api/auth'),
    keyBuilder: (request) => request.ip,
  });

  const syncRateLimiter = createMemoryRateLimiter({
    name: 'sync',
    max: NODE_ENV === 'production' ? 300 : 1000,
    windowMs: 60_000,
    match: (request) => request.url.startsWith('/api/sync'),
    keyBuilder: (request) => {
      const deviceId = typeof request.headers['x-device-id'] === 'string'
        ? request.headers['x-device-id']
        : 'unknown-device';
      return `${request.ip}:${deviceId}`;
    },
  });

  fastify.addHook('onRequest', async (request, reply) => {
    await authRateLimiter(request, reply);
    if (reply.sent) return;
    await syncRateLimiter(request, reply);
  });

  // Health check endpoint
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(ordersRoutes, { prefix: '/api/orders' });
  await fastify.register(kotsRoutes, { prefix: '/api/kots' });
  await fastify.register(menuRoutes, { prefix: '/api' });
  await fastify.register(tablesRoutes, { prefix: '/api' });
  await fastify.register(inventoryRoutes, { prefix: '/api/inventory' });
  await fastify.register(usersRoutes, { prefix: '/api/users' });
  await fastify.register(settingsRoutes, { prefix: '/api/settings' });
  await fastify.register(reportsRoutes, { prefix: '/api/reports' });
  await fastify.register(syncRoutes, { prefix: '/api/sync' });
  await fastify.register(adminRoutes, { prefix: '/api/admin' });
  await registerWebStaticRoutes(fastify);

  // Create HTTP server and setup Socket.io
  const httpServer = createServer(fastify.server);
  setupSocketIO(httpServer);

  if (NODE_ENV === 'production' || process.env.ENABLE_BACKUP_SCHEDULER === 'true') {
    scheduleBackups();
  }

  // Start the server
  try {
    await fastify.listen({ port: PORT, host: HOST });

    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     🍽️  Bill & Serve Pro - POS Server Started              ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  API:        http://${HOST}:${PORT}                            ║`);
    console.log(`║  Socket.io:  ws://${HOST}:${PORT}                             ║`);
      console.log(`║  DB Client:  ${DB_CLIENT}                                      ║`);
      console.log(`║  Frontend:   http://${HOST}:${PORT}                       ║`);
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('');

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
