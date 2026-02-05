CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  pin TEXT,
  password_hash TEXT,
  role TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS areas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY,
  area_id TEXT NOT NULL REFERENCES areas(id),
  name TEXT NOT NULL,
  capacity INTEGER DEFAULT 4,
  is_active INTEGER NOT NULL DEFAULT 1,
  current_order_id TEXT,
  lock_owner_device_id TEXT,
  lock_expires_at BIGINT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  description TEXT,
  base_price DOUBLE PRECISION NOT NULL,
  tax_rate_percent DOUBLE PRECISION NOT NULL DEFAULT 5,
  is_veg INTEGER DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  order_type TEXT NOT NULL,
  table_id TEXT REFERENCES tables(id),
  owner_user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'open',
  version INTEGER NOT NULL DEFAULT 1,
  subtotal DOUBLE PRECISION NOT NULL DEFAULT 0,
  discount_type TEXT,
  discount_value DOUBLE PRECISION,
  discount_reason TEXT,
  tax_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  grand_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  closed_at BIGINT,
  cancelled_at BIGINT,
  cancel_reason TEXT
);

CREATE TABLE IF NOT EXISTS order_lines (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price DOUBLE PRECISION NOT NULL,
  tax_rate DOUBLE PRECISION NOT NULL,
  line_total DOUBLE PRECISION NOT NULL,
  notes TEXT,
  kot_sent INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS kots (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kot_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS kot_lines (
  id TEXT PRIMARY KEY,
  kot_id TEXT NOT NULL REFERENCES kots(id) ON DELETE CASCADE,
  order_line_id TEXT NOT NULL REFERENCES order_lines(id),
  menu_item_name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  method TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  reference TEXT,
  received_at BIGINT NOT NULL,
  received_by TEXT NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS raw_materials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  current_stock DOUBLE PRECISION NOT NULL DEFAULT 0,
  low_stock_threshold DOUBLE PRECISION NOT NULL DEFAULT 10,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id TEXT PRIMARY KEY,
  raw_material_id TEXT NOT NULL REFERENCES raw_materials(id),
  direction TEXT NOT NULL,
  qty DOUBLE PRECISION NOT NULL,
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
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
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  name TEXT NOT NULL DEFAULT 'My Restaurant',
  phone TEXT,
  address TEXT,
  gstin TEXT,
  default_tax_rate DOUBLE PRECISION NOT NULL DEFAULT 5,
  service_charge DOUBLE PRECISION NOT NULL DEFAULT 0,
  show_tax_breakdown INTEGER NOT NULL DEFAULT 1,
  cashier_discount_limit DOUBLE PRECISION NOT NULL DEFAULT 10,
  require_cancel_reason INTEGER NOT NULL DEFAULT 1,
  low_stock_alerts INTEGER NOT NULL DEFAULT 1,
  new_order_sound INTEGER NOT NULL DEFAULT 1,
  invoice_prefix TEXT DEFAULT 'INV',
  kot_prefix TEXT DEFAULT 'KOT',
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS sequences (
  name TEXT PRIMARY KEY,
  current_value INTEGER NOT NULL DEFAULT 0,
  prefix TEXT,
  reset_daily INTEGER NOT NULL DEFAULT 0,
  last_reset_date TEXT
);

CREATE TABLE IF NOT EXISTS device_sessions (
  device_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  app_version TEXT,
  last_seen_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  response_json TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_actions (
  action_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  base_version INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  result_json TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at BIGINT NOT NULL,
  processed_at BIGINT
);

CREATE TABLE IF NOT EXISTS sync_cursors (
  device_id TEXT PRIMARY KEY,
  last_event_seq BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS domain_events (
  seq BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  source_device_id TEXT,
  actor_user_id TEXT REFERENCES users(id),
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_actions_device_status
  ON sync_actions(device_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_domain_events_seq
  ON domain_events(seq);

CREATE INDEX IF NOT EXISTS idx_domain_events_entity
  ON domain_events(entity_type, entity_id);
