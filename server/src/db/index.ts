import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || resolve(__dirname, '../../data/restaurant.db');
const dbClient = process.env.DB_CLIENT || 'sqlite';

if (dbClient !== 'sqlite') {
  throw new Error(
    `Unsupported DB_CLIENT="${dbClient}" for current runtime. ` +
    'Use DB_CLIENT=sqlite for app runtime, and follow POSTGRES_MIGRATION.md for data migration.'
  );
}

// Ensure data directory exists
const dataDir = dirname(dbPath);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Create SQLite connection
const sqlite: Database.Database = new Database(dbPath);

// Enable WAL mode for better concurrent access
sqlite.pragma('journal_mode = WAL');

// Enable foreign keys
sqlite.pragma('foreign_keys = ON');

function hasColumn(tableName: string, columnName: string): boolean {
  const rows = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
}

function ensureColumn(tableName: string, columnName: string, sqlType: string): void {
  try {
    if (!hasColumn(tableName, columnName)) {
      sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqlType}`);
    }
  } catch (error) {
    // Base table might not exist yet during first-time setup
  }
}

function ensureSchemaExtensions(): void {
  ensureColumn('tables', 'lock_owner_device_id', 'TEXT');
  ensureColumn('tables', 'lock_expires_at', 'INTEGER');
  ensureColumn('tables', 'version', 'INTEGER NOT NULL DEFAULT 1');

  ensureColumn('orders', 'owner_user_id', 'TEXT REFERENCES users(id)');
  ensureColumn('orders', 'version', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('orders', 'updated_at', 'INTEGER NOT NULL DEFAULT 0');

  ensureColumn('order_lines', 'version', 'INTEGER NOT NULL DEFAULT 1');

  sqlite.exec(`UPDATE orders SET updated_at = created_at WHERE updated_at = 0`);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS device_sessions (
      device_id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      app_version TEXT,
      last_seen_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY NOT NULL,
      endpoint TEXT NOT NULL,
      actor_user_id TEXT NOT NULL REFERENCES users(id),
      response_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sync_actions (
      action_id TEXT PRIMARY KEY NOT NULL,
      device_id TEXT NOT NULL,
      actor_user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      base_version INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      result_json TEXT,
      error_code TEXT,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      processed_at INTEGER
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sync_cursors (
      device_id TEXT PRIMARY KEY NOT NULL,
      last_event_seq INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS domain_events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      source_device_id TEXT,
      actor_user_id TEXT REFERENCES users(id),
      created_at INTEGER NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_sync_actions_device_status
    ON sync_actions(device_id, status, created_at)
  `);

  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_domain_events_seq
    ON domain_events(seq)
  `);

  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_domain_events_entity
    ON domain_events(entity_type, entity_id)
  `);
}

ensureSchemaExtensions();

// Create Drizzle ORM instance
export const db = drizzle(sqlite, { schema });

// Export the raw SQLite connection for direct queries if needed
export { sqlite };

// Export schema for use in other files
export * from './schema.js';
