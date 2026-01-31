import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { createServer } from 'http';
import { setupSocketIO } from './socket/index.js';

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

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

async function start() {
  // Create Fastify instance
  const fastify = Fastify({
    logger: {
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

      // Allow localhost and local network
      const allowedPatterns = [
        /^http:\/\/localhost(:\d+)?$/,
        /^http:\/\/127\.0\.0\.1(:\d+)?$/,
        /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
        /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
      ];

      if (allowedPatterns.some(pattern => pattern.test(origin))) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Register JWT
  await fastify.register(jwt, {
    secret: JWT_SECRET,
    sign: {
      expiresIn: '24h',
    },
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

  // Create HTTP server and setup Socket.io
  const httpServer = createServer(fastify.server);
  setupSocketIO(httpServer);

  // Start the server
  try {
    await fastify.listen({ port: PORT, host: HOST });

    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     🍽️  Bill & Serve Pro - POS Server Started              ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  API:        http://${HOST}:${PORT}                            ║`);
    console.log(`║  Socket.io:  ws://${HOST}:${PORT}                             ║`);
    console.log(`║  Frontend:   ${FRONTEND_URL}                       ║`);
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
