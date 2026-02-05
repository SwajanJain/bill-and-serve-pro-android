import { FastifyInstance, FastifyReply } from 'fastify';
import { existsSync } from 'fs';
import { readFile, stat } from 'fs/promises';
import { extname, normalize, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(new URL('.', import.meta.url)));
const defaultWebDistPath = resolve(__dirname, '../../../dist');

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function getContentType(filePath: string): string {
  return contentTypes[extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolveWebDistPath(): string {
  return resolve(process.env.WEB_DIST_PATH || defaultWebDistPath);
}

function isPathWithin(base: string, target: string): boolean {
  const normalizedBase = normalize(base.endsWith('/') ? base : `${base}/`);
  const normalizedTarget = normalize(target);
  return normalizedTarget.startsWith(normalizedBase);
}

async function sendFile(reply: FastifyReply, filePath: string, cacheAssets = false) {
  try {
    const body = await readFile(filePath);
    const stats = await stat(filePath);
    reply
      .header('Content-Type', getContentType(filePath))
      .header('Content-Length', String(stats.size))
      .header('Cache-Control', cacheAssets ? 'public, max-age=604800, immutable' : 'no-cache')
      .send(body);
  } catch {
    reply.status(404).send({ error: 'Not found' });
  }
}

export async function registerWebStaticRoutes(fastify: FastifyInstance): Promise<void> {
  const webDistPath = resolveWebDistPath();
  const indexPath = resolve(webDistPath, 'index.html');
  const enabled = process.env.ENABLE_WEB_STATIC !== 'false';

  if (!enabled || !existsSync(indexPath)) {
    fastify.log.info({ webDistPath }, 'Static web hosting is disabled or dist not found');
    return;
  }

  fastify.get('/', async (_request, reply) => {
    await sendFile(reply, indexPath);
  });

  fastify.get('/assets/*', async (request, reply) => {
    const wildcard = (request.params as { '*': string })['*'] || '';
    const resolvedPath = resolve(webDistPath, 'assets', wildcard);
    if (!isPathWithin(resolve(webDistPath, 'assets'), resolvedPath)) {
      return reply.status(400).send({ error: 'Invalid path' });
    }
    await sendFile(reply, resolvedPath, true);
  });

  for (const entry of ['favicon.ico', 'manifest.webmanifest', 'robots.txt']) {
    fastify.get(`/${entry}`, async (_request, reply) => {
      await sendFile(reply, resolve(webDistPath, entry), true);
    });
  }

  fastify.get('/*', async (request, reply) => {
    const url = request.url || '';
    if (url.startsWith('/api') || url.startsWith('/socket.io')) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const requestedPath = resolve(webDistPath, url.replace(/^\//, ''));
    if (requestedPath !== indexPath && isPathWithin(webDistPath, requestedPath) && existsSync(requestedPath)) {
      const isAsset = requestedPath.includes(`${normalize('/assets/')}`);
      await sendFile(reply, requestedPath, isAsset);
      return;
    }

    await sendFile(reply, indexPath);
  });

  fastify.log.info({ webDistPath }, 'Static web hosting enabled');
}
