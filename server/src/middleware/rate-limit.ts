import { FastifyReply, FastifyRequest } from 'fastify';

type KeyBuilder = (request: FastifyRequest) => string;
type Matcher = (request: FastifyRequest) => boolean;

interface RateLimitOptions {
  name: string;
  max: number;
  windowMs: number;
  match: Matcher;
  keyBuilder: KeyBuilder;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createMemoryRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!options.match(request)) {
      return;
    }

    const now = Date.now();
    const key = `${options.name}:${options.keyBuilder(request)}`;
    const existing = buckets.get(key);

    if (!existing || now >= existing.resetAt) {
      buckets.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      return;
    }

    if (existing.count >= options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      reply
        .header('Retry-After', String(retryAfterSeconds))
        .status(429)
        .send({
          error: 'Too many requests',
          code: 'RATE_LIMITED',
          retryAfterSeconds,
        });
      return;
    }

    existing.count += 1;
  };
}
