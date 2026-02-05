import { storage } from '@/lib/storage';

const ENV_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';
const DEV_UI_PORTS = new Set(['5173', '8080', '4173']);
let resolvedApiBaseUrl: string | null = null;

type RequestOptions = RequestInit & {
  idempotencyKey?: string;
};

function normalizeBaseUrl(raw: string): string {
  let value = raw.trim();
  if (!value) return '';
  value = value.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(value)) {
    value = `http://${value}`;
  }
  value = value.replace(/\/api$/i, '');
  return value;
}

function getFallbackBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const { hostname, port, origin } = window.location;
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
    if (!isLocalHost || !DEV_UI_PORTS.has(port)) {
      return origin;
    }
  }
  return 'http://localhost:3001';
}

export async function resolveApiBaseUrl(): Promise<string> {
  if (resolvedApiBaseUrl) {
    return resolvedApiBaseUrl;
  }

  const persisted = await storage.getServerBaseUrl();
  const normalizedPersisted = persisted ? normalizeBaseUrl(persisted) : '';
  if (normalizedPersisted) {
    resolvedApiBaseUrl = normalizedPersisted;
    return resolvedApiBaseUrl;
  }

  const normalizedEnv = ENV_API_BASE_URL ? normalizeBaseUrl(ENV_API_BASE_URL) : '';
  if (normalizedEnv) {
    resolvedApiBaseUrl = normalizedEnv;
    return resolvedApiBaseUrl;
  }

  resolvedApiBaseUrl = getFallbackBaseUrl();
  return resolvedApiBaseUrl;
}

export async function updateApiBaseUrl(url: string | null): Promise<string | null> {
  const normalized = url ? normalizeBaseUrl(url) : '';
  await storage.saveServerBaseUrl(normalized || null);
  resolvedApiBaseUrl = normalized || null;
  return resolvedApiBaseUrl;
}

export class APIError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function buildHeaders(options?: RequestOptions): Promise<HeadersInit> {
  const token = await storage.getAuthToken();
  const deviceId = await storage.getOrCreateDeviceId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Device-Id': deviceId,
    ...(options?.idempotencyKey ? { 'X-Idempotency-Key': options.idempotencyKey } : {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function apiRequest<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
  const apiBaseUrl = await resolveApiBaseUrl();
  const headers = await buildHeaders(options);
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers || {}),
    },
  });

  const isJSON = response.headers.get('content-type')?.includes('application/json');
  const payload = isJSON ? await response.json() : await response.text();

  if (!response.ok) {
    const message = (typeof payload === 'object' && payload && 'error' in payload)
      ? String((payload as { error?: string }).error || 'Request failed')
      : response.statusText || 'Request failed';
    throw new APIError(message, response.status, payload);
  }

  return payload as T;
}

export function createIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
