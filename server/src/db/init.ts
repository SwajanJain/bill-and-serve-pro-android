import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || resolve(__dirname, '../../data/restaurant.db');

// Ensure data directory exists
const dataDir = dirname(dbPath);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(dbPath);

// Enable WAL mode and foreign keys
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

console.log('🗄️  Initializing database schema...');

// Create tables
const statements = [
  // Users table
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    pin TEXT,
    password_hash TEXT,
    role TEXT NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  // Areas table
  `CREATE TABLE IF NOT EXISTS areas (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  // Tables table
  `CREATE TABLE IF NOT EXISTS tables (
    id TEXT PRIMARY KEY NOT NULL,
    area_id TEXT NOT NULL REFERENCES areas(id),
    name TEXT NOT NULL,
    capacity INTEGER DEFAULT 4,
    is_active INTEGER DEFAULT 1 NOT NULL,
    current_order_id TEXT,
    lock_owner_device_id TEXT,
    lock_expires_at INTEGER,
    version INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  // Categories table
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  // Menu items table
  `CREATE TABLE IF NOT EXISTS menu_items (
    id TEXT PRIMARY KEY NOT NULL,
    category_id TEXT NOT NULL REFERENCES categories(id),
    name TEXT NOT NULL,
    description TEXT,
    base_price REAL NOT NULL,
    tax_rate_percent REAL DEFAULT 5 NOT NULL,
    is_veg INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1 NOT NULL,
    image_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  // Orders table
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY NOT NULL,
    order_number TEXT NOT NULL UNIQUE,
    order_type TEXT NOT NULL,
    table_id TEXT REFERENCES tables(id),
    owner_user_id TEXT REFERENCES users(id),
    status TEXT DEFAULT 'open' NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    subtotal REAL DEFAULT 0 NOT NULL,
    discount_type TEXT,
    discount_value REAL,
    discount_reason TEXT,
    tax_total REAL DEFAULT 0 NOT NULL,
    grand_total REAL DEFAULT 0 NOT NULL,
    payment_status TEXT DEFAULT 'pending' NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    closed_at INTEGER,
    cancelled_at INTEGER,
    cancel_reason TEXT
  )`,

  // Order lines table
  `CREATE TABLE IF NOT EXISTS order_lines (
    id TEXT PRIMARY KEY NOT NULL,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
    qty INTEGER DEFAULT 1 NOT NULL,
    unit_price REAL NOT NULL,
    tax_rate REAL NOT NULL,
    line_total REAL NOT NULL,
    notes TEXT,
    kot_sent INTEGER DEFAULT 0 NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  // KOTs table
  `CREATE TABLE IF NOT EXISTS kots (
    id TEXT PRIMARY KEY NOT NULL,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    kot_number TEXT NOT NULL,
    status TEXT DEFAULT 'new' NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  // KOT lines table
  `CREATE TABLE IF NOT EXISTS kot_lines (
    id TEXT PRIMARY KEY NOT NULL,
    kot_id TEXT NOT NULL REFERENCES kots(id) ON DELETE CASCADE,
    order_line_id TEXT NOT NULL REFERENCES order_lines(id),
    menu_item_name TEXT NOT NULL,
    qty INTEGER NOT NULL,
    notes TEXT
  )`,

  // Payments table
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY NOT NULL,
    order_id TEXT NOT NULL REFERENCES orders(id),
    method TEXT NOT NULL,
    amount REAL NOT NULL,
    reference TEXT,
    received_at INTEGER NOT NULL,
    received_by TEXT NOT NULL REFERENCES users(id)
  )`,

  // Raw materials table
  `CREATE TABLE IF NOT EXISTS raw_materials (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    current_stock REAL DEFAULT 0 NOT NULL,
    low_stock_threshold REAL DEFAULT 10 NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  // Stock transactions table
  `CREATE TABLE IF NOT EXISTS stock_transactions (
    id TEXT PRIMARY KEY NOT NULL,
    raw_material_id TEXT NOT NULL REFERENCES raw_materials(id),
    direction TEXT NOT NULL,
    qty REAL NOT NULL,
    reason TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL
  )`,

  // Audit events table
  `CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY NOT NULL,
    event_type TEXT NOT NULL,
    actor_user_id TEXT REFERENCES users(id),
    actor_name TEXT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    before_json TEXT,
    after_json TEXT,
    reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL
  )`,

  // Settings table
  `CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    name TEXT DEFAULT 'My Restaurant' NOT NULL,
    phone TEXT,
    address TEXT,
    gstin TEXT,
    default_tax_rate REAL DEFAULT 5 NOT NULL,
    service_charge REAL DEFAULT 0 NOT NULL,
    show_tax_breakdown INTEGER DEFAULT 1 NOT NULL,
    cashier_discount_limit REAL DEFAULT 10 NOT NULL,
    require_cancel_reason INTEGER DEFAULT 1 NOT NULL,
    low_stock_alerts INTEGER DEFAULT 1 NOT NULL,
    new_order_sound INTEGER DEFAULT 1 NOT NULL,
    invoice_prefix TEXT DEFAULT 'INV',
    kot_prefix TEXT DEFAULT 'KOT',
    updated_at INTEGER NOT NULL
  )`,

  // Sequences table
  `CREATE TABLE IF NOT EXISTS sequences (
    name TEXT PRIMARY KEY NOT NULL,
    current_value INTEGER DEFAULT 0 NOT NULL,
    prefix TEXT,
    reset_daily INTEGER DEFAULT 0 NOT NULL,
    last_reset_date TEXT
  )`,

  // Device sessions table
  `CREATE TABLE IF NOT EXISTS device_sessions (
    device_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    app_version TEXT,
    last_seen_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,

  // Idempotency keys table
  `CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY NOT NULL,
    endpoint TEXT NOT NULL,
    actor_user_id TEXT NOT NULL REFERENCES users(id),
    response_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,

  // Sync actions table
  `CREATE TABLE IF NOT EXISTS sync_actions (
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
  )`,

  // Sync cursors table
  `CREATE TABLE IF NOT EXISTS sync_cursors (
    device_id TEXT PRIMARY KEY NOT NULL,
    last_event_seq INTEGER DEFAULT 0 NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  // Domain events table
  `CREATE TABLE IF NOT EXISTS domain_events (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    source_device_id TEXT,
    actor_user_id TEXT REFERENCES users(id),
    created_at INTEGER NOT NULL
  )`,
];

try {
  for (const sql of statements) {
    sqlite.exec(sql);
  }
  console.log('✅ Database schema created successfully!');
} catch (error) {
  console.error('❌ Failed to create schema:', error);
  process.exit(1);
} finally {
  sqlite.close();
}
