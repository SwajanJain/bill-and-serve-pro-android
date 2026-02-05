import { Preferences } from '@capacitor/preferences';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Order, DailySummary } from '@/types';

// Storage keys
export const STORAGE_KEYS = {
  // POS data
  MENU_ITEMS: 'pos_menu_items',
  CATEGORIES: 'pos_categories',
  TABLES: 'pos_tables',
  ACTIVE_ORDERS: 'pos_active_orders',
  COMPLETED_ORDERS: 'pos_completed_orders',
  DAILY_SUMMARIES: 'pos_daily_summaries',
  ORDER_COUNTER: 'pos_order_counter',

  // Settings data
  USERS: 'settings_users',
  AREAS: 'settings_areas',
  RESTAURANT_SETTINGS: 'settings_restaurant',

  // Auth data
  CURRENT_USER: 'auth_current_user',
  AUTH_TOKEN: 'auth_token',
  DEVICE_ID: 'device_id',
  SERVER_BASE_URL: 'server_base_url',

  // Offline sync
  SYNC_QUEUE: 'sync_queue',
  SYNC_STATE: 'sync_state',
  SYNC_CONFLICTS: 'sync_conflicts',

  // Setup
  SETUP_COMPLETE: 'app_setup_complete',
} as const;

const SQLITE_DB_NAME = 'billit_local_store';
const SQLITE_TABLE_NAME = 'kv_store';
const SQLITE_ENTITY_TABLE = 'entity_store';

interface SQLiteQueryResult {
  values?: Array<Record<string, unknown>>;
}
interface SQLitePlugin {
  createConnection(options: {
    database: string;
    encrypted: boolean;
    mode: string;
    version: number;
    readonly: boolean;
  }): Promise<void>;
  open(options: {
    database: string;
    readonly: boolean;
  }): Promise<void>;
  execute(options: {
    database: string;
    statements: string;
  }): Promise<void>;
  run(options: {
    database: string;
    statement: string;
    values?: Array<string | number>;
  }): Promise<unknown>;
  query(options: {
    database: string;
    statement: string;
    values?: Array<string | number>;
  }): Promise<SQLiteQueryResult>;
}

const CapacitorSQLite = registerPlugin<SQLitePlugin>('CapacitorSQLite');
let sqliteInitialized = false;
let sqliteUnavailable = false;

// Generic storage functions
export async function setItem<T>(key: string, value: T): Promise<boolean> {
  try {
    const serialized = JSON.stringify(value);

    if (await isSQLiteStorageReady()) {
      await CapacitorSQLite.run({
        database: SQLITE_DB_NAME,
        statement: `
          INSERT INTO ${SQLITE_TABLE_NAME}(storage_key, storage_value, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(storage_key) DO UPDATE SET
            storage_value = excluded.storage_value,
            updated_at = excluded.updated_at
        `,
        values: [key, serialized, Date.now()],
      });
      return true;
    }

    await Preferences.set({
      key,
      value: serialized,
    });
    return true;
  } catch (error) {
    console.error(`Error saving ${key}:`, error);
    return false;
  }
}

export async function getItem<T>(key: string): Promise<T | null> {
  try {
    if (await isSQLiteStorageReady()) {
      const result = await CapacitorSQLite.query({
        database: SQLITE_DB_NAME,
        statement: `SELECT storage_value FROM ${SQLITE_TABLE_NAME} WHERE storage_key = ? LIMIT 1`,
        values: [key],
      });
      const row = Array.isArray(result?.values) && result.values.length > 0
        ? result.values[0]
        : null;
      const value = row?.storage_value || row?.STORAGE_VALUE;
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    }

    const { value } = await Preferences.get({ key });
    if (value) {
      return JSON.parse(value) as T;
    }
    return null;
  } catch (error) {
    console.error(`Error reading ${key}:`, error);
    return null;
  }
}

export async function removeItem(key: string): Promise<boolean> {
  try {
    if (await isSQLiteStorageReady()) {
      await CapacitorSQLite.run({
        database: SQLITE_DB_NAME,
        statement: `DELETE FROM ${SQLITE_TABLE_NAME} WHERE storage_key = ?`,
        values: [key],
      });
      return true;
    }

    await Preferences.remove({ key });
    return true;
  } catch (error) {
    console.error(`Error removing ${key}:`, error);
    return false;
  }
}

export async function clearAll(): Promise<void> {
  try {
    if (await isSQLiteStorageReady()) {
      await CapacitorSQLite.execute({
        database: SQLITE_DB_NAME,
        statements: `DELETE FROM ${SQLITE_TABLE_NAME};`,
      });
      return;
    }
    await Preferences.clear();
  } catch (error) {
    console.error('Error clearing storage:', error);
  }
}

async function isSQLiteStorageReady(): Promise<boolean> {
  if (sqliteUnavailable) {
    return false;
  }

  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  if (!Capacitor.isPluginAvailable('CapacitorSQLite')) {
    sqliteUnavailable = true;
    return false;
  }

  if (sqliteInitialized) {
    return true;
  }

  try {
    try {
      await CapacitorSQLite.createConnection({
        database: SQLITE_DB_NAME,
        encrypted: false,
        mode: 'no-encryption',
        version: 1,
        readonly: false,
      });
    } catch {
      // already created/connected
    }

    try {
      await CapacitorSQLite.open({
        database: SQLITE_DB_NAME,
        readonly: false,
      });
    } catch {
      // already open
    }

    await CapacitorSQLite.execute({
      database: SQLITE_DB_NAME,
      statements: `
        CREATE TABLE IF NOT EXISTS ${SQLITE_TABLE_NAME} (
          storage_key TEXT PRIMARY KEY NOT NULL,
          storage_value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ${SQLITE_ENTITY_TABLE} (
          scope TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (scope, entity_id)
        );
      `,
    });

    sqliteInitialized = true;
    return true;
  } catch (error) {
    console.warn('SQLite storage unavailable, falling back to Preferences', error);
    sqliteUnavailable = true;
    return false;
  }
}

async function saveCollection<T>(
  scope: string,
  items: T[],
  getId: (item: T, index: number) => string
): Promise<boolean> {
  try {
    if (!(await isSQLiteStorageReady())) {
      return false;
    }

    await CapacitorSQLite.run({
      database: SQLITE_DB_NAME,
      statement: `DELETE FROM ${SQLITE_ENTITY_TABLE} WHERE scope = ?`,
      values: [scope],
    });

    const now = Date.now();
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const entityId = getId(item, index);
      await CapacitorSQLite.run({
        database: SQLITE_DB_NAME,
        statement: `
          INSERT INTO ${SQLITE_ENTITY_TABLE}(scope, entity_id, payload, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(scope, entity_id) DO UPDATE SET
            payload = excluded.payload,
            updated_at = excluded.updated_at
        `,
        values: [scope, entityId, JSON.stringify(item), now],
      });
    }

    return true;
  } catch (error) {
    console.warn(`SQLite collection save failed for ${scope}`, error);
    return false;
  }
}

async function getCollection<T>(scope: string): Promise<T[] | null> {
  try {
    if (!(await isSQLiteStorageReady())) {
      return null;
    }

    const result = await CapacitorSQLite.query({
      database: SQLITE_DB_NAME,
      statement: `SELECT payload FROM ${SQLITE_ENTITY_TABLE} WHERE scope = ? ORDER BY updated_at ASC`,
      values: [scope],
    });

    const values = Array.isArray(result?.values) ? result.values : [];
    return values
      .map((row) => {
        const payload = row.payload || row.PAYLOAD;
        if (typeof payload !== 'string') return null;
        try {
          return JSON.parse(payload) as T;
        } catch {
          return null;
        }
      })
      .filter((item): item is T => item !== null);
  } catch (error) {
    console.warn(`SQLite collection read failed for ${scope}`, error);
    return null;
  }
}

// Validate active orders from storage
function validateActiveOrders(orders: unknown): Order[] {
  if (!Array.isArray(orders)) return [];
  return orders.filter((order: unknown) => {
    if (!order || typeof order !== 'object') return false;
    const o = order as Record<string, unknown>;
    return (
      typeof o.id === 'string' &&
      Array.isArray(o.lines) &&
      (typeof o.grandTotal === 'number' || o.grandTotal === undefined)
    );
  }) as Order[];
}

// Typed storage helpers for specific data
export const storage = {
  // POS Data
  async saveMenuItems<T>(items: T): Promise<boolean> {
    const list = Array.isArray(items) ? items as Array<Record<string, unknown>> : [];
    const sqliteSaved = await saveCollection('menu_items_local', list, (item, index) =>
      typeof item.id === 'string' ? item.id : `menu_${index}`
    );
    if (sqliteSaved) return true;
    return setItem(STORAGE_KEYS.MENU_ITEMS, items);
  },
  async getMenuItems<T>(): Promise<T | null> {
    const sqliteItems = await getCollection<unknown>('menu_items_local');
    if (sqliteItems && sqliteItems.length > 0) {
      return sqliteItems as T;
    }
    return getItem<T>(STORAGE_KEYS.MENU_ITEMS);
  },

  async saveCategories<T>(categories: T): Promise<boolean> {
    const list = Array.isArray(categories) ? categories as Array<Record<string, unknown>> : [];
    const sqliteSaved = await saveCollection('categories_local', list, (item, index) =>
      typeof item.id === 'string' ? item.id : `category_${index}`
    );
    if (sqliteSaved) return true;
    return setItem(STORAGE_KEYS.CATEGORIES, categories);
  },
  async getCategories<T>(): Promise<T | null> {
    const sqliteItems = await getCollection<unknown>('categories_local');
    if (sqliteItems && sqliteItems.length > 0) {
      return sqliteItems as T;
    }
    return getItem<T>(STORAGE_KEYS.CATEGORIES);
  },

  async saveTables<T>(tables: T): Promise<boolean> {
    const list = Array.isArray(tables) ? tables as Array<Record<string, unknown>> : [];
    const sqliteSaved = await saveCollection('tables_local', list, (item, index) =>
      typeof item.id === 'string' ? item.id : `table_${index}`
    );
    if (sqliteSaved) return true;
    return setItem(STORAGE_KEYS.TABLES, tables);
  },
  async getTables<T>(): Promise<T | null> {
    const sqliteItems = await getCollection<unknown>('tables_local');
    if (sqliteItems && sqliteItems.length > 0) {
      return sqliteItems as T;
    }
    return getItem<T>(STORAGE_KEYS.TABLES);
  },

  async saveActiveOrders<T>(orders: T): Promise<boolean> {
    const list = Array.isArray(orders) ? orders as Array<Record<string, unknown>> : [];
    const sqliteSaved = await saveCollection('orders_local_active', list, (item, index) =>
      typeof item.id === 'string' ? item.id : `active_order_${index}`
    );
    if (sqliteSaved) return true;
    return setItem(STORAGE_KEYS.ACTIVE_ORDERS, orders);
  },
  async getActiveOrders<T>(): Promise<T | null> {
    const sqliteItems = await getCollection<unknown>('orders_local_active');
    if (sqliteItems && sqliteItems.length > 0) {
      return sqliteItems as T;
    }
    return getItem<T>(STORAGE_KEYS.ACTIVE_ORDERS);
  },
  async getActiveOrdersSafe(): Promise<Order[]> {
    const raw = await getItem<unknown>(STORAGE_KEYS.ACTIVE_ORDERS);
    return validateActiveOrders(raw);
  },

  async saveCompletedOrders(orders: Order[]): Promise<boolean> {
    const sqliteSaved = await saveCollection('orders_local_completed', orders, (item, index) =>
      typeof item.id === 'string' ? item.id : `completed_order_${index}`
    );
    if (sqliteSaved) return true;
    return setItem(STORAGE_KEYS.COMPLETED_ORDERS, orders);
  },
  async getCompletedOrders(): Promise<Order[]> {
    const sqliteItems = await getCollection<Order>('orders_local_completed');
    if (sqliteItems && sqliteItems.length > 0) {
      return validateActiveOrders(sqliteItems);
    }
    const raw = await getItem<unknown>(STORAGE_KEYS.COMPLETED_ORDERS);
    return validateActiveOrders(raw); // same validation works
  },

  async saveDailySummaries(summaries: DailySummary[]): Promise<boolean> {
    const sqliteSaved = await saveCollection('daily_summaries_local', summaries, (item, index) =>
      typeof item.date === 'string' ? item.date : `summary_${index}`
    );
    if (sqliteSaved) return true;
    return setItem(STORAGE_KEYS.DAILY_SUMMARIES, summaries);
  },
  async getDailySummaries(): Promise<DailySummary[]> {
    const sqliteItems = await getCollection<DailySummary>('daily_summaries_local');
    if (sqliteItems && sqliteItems.length > 0) {
      return sqliteItems;
    }
    const raw = await getItem<DailySummary[]>(STORAGE_KEYS.DAILY_SUMMARIES);
    return Array.isArray(raw) ? raw : [];
  },

  async saveOrderCounter(counter: number): Promise<boolean> {
    return setItem(STORAGE_KEYS.ORDER_COUNTER, counter);
  },
  async getOrderCounter(): Promise<number | null> {
    return getItem<number>(STORAGE_KEYS.ORDER_COUNTER);
  },

  // Settings Data
  async saveUsers<T>(users: T): Promise<boolean> {
    const list = Array.isArray(users) ? users as Array<Record<string, unknown>> : [];
    const sqliteSaved = await saveCollection('users_local', list, (item, index) =>
      typeof item.id === 'string' ? item.id : `user_${index}`
    );
    if (sqliteSaved) return true;
    return setItem(STORAGE_KEYS.USERS, users);
  },
  async getUsers<T>(): Promise<T | null> {
    const sqliteItems = await getCollection<unknown>('users_local');
    if (sqliteItems && sqliteItems.length > 0) {
      return sqliteItems as T;
    }
    return getItem<T>(STORAGE_KEYS.USERS);
  },

  async saveAreas<T>(areas: T): Promise<boolean> {
    const list = Array.isArray(areas) ? areas as Array<Record<string, unknown>> : [];
    const sqliteSaved = await saveCollection('areas_local', list, (item, index) =>
      typeof item.id === 'string' ? item.id : `area_${index}`
    );
    if (sqliteSaved) return true;
    return setItem(STORAGE_KEYS.AREAS, areas);
  },
  async getAreas<T>(): Promise<T | null> {
    const sqliteItems = await getCollection<unknown>('areas_local');
    if (sqliteItems && sqliteItems.length > 0) {
      return sqliteItems as T;
    }
    return getItem<T>(STORAGE_KEYS.AREAS);
  },

  async saveRestaurantSettings<T>(settings: T): Promise<boolean> {
    return setItem(STORAGE_KEYS.RESTAURANT_SETTINGS, settings);
  },
  async getRestaurantSettings<T>(): Promise<T | null> {
    return getItem<T>(STORAGE_KEYS.RESTAURANT_SETTINGS);
  },

  // Auth Data
  async saveCurrentUser<T>(user: T | null): Promise<boolean> {
    if (user) {
      return setItem(STORAGE_KEYS.CURRENT_USER, user);
    } else {
      return removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  },
  async getCurrentUser<T>(): Promise<T | null> {
    return getItem<T>(STORAGE_KEYS.CURRENT_USER);
  },

  async saveAuthToken(token: string | null): Promise<boolean> {
    if (!token) {
      return removeItem(STORAGE_KEYS.AUTH_TOKEN);
    }
    return setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  },
  async getAuthToken(): Promise<string | null> {
    return getItem<string>(STORAGE_KEYS.AUTH_TOKEN);
  },

  async getOrCreateDeviceId(): Promise<string> {
    const existing = await getItem<string>(STORAGE_KEYS.DEVICE_ID);
    if (existing) {
      return existing;
    }
    const generated = crypto.randomUUID();
    await setItem(STORAGE_KEYS.DEVICE_ID, generated);
    return generated;
  },

  async saveServerBaseUrl(url: string | null): Promise<boolean> {
    if (!url) {
      return removeItem(STORAGE_KEYS.SERVER_BASE_URL);
    }
    return setItem(STORAGE_KEYS.SERVER_BASE_URL, url);
  },
  async getServerBaseUrl(): Promise<string | null> {
    return getItem<string>(STORAGE_KEYS.SERVER_BASE_URL);
  },

  async saveSyncQueue<T>(queue: T): Promise<boolean> {
    return setItem(STORAGE_KEYS.SYNC_QUEUE, queue);
  },
  async getSyncQueue<T>(): Promise<T | null> {
    return getItem<T>(STORAGE_KEYS.SYNC_QUEUE);
  },

  async saveSyncState<T>(state: T): Promise<boolean> {
    return setItem(STORAGE_KEYS.SYNC_STATE, state);
  },
  async getSyncState<T>(): Promise<T | null> {
    return getItem<T>(STORAGE_KEYS.SYNC_STATE);
  },

  async saveSyncConflicts<T>(conflicts: T): Promise<boolean> {
    return setItem(STORAGE_KEYS.SYNC_CONFLICTS, conflicts);
  },
  async getSyncConflicts<T>(): Promise<T | null> {
    return getItem<T>(STORAGE_KEYS.SYNC_CONFLICTS);
  },

  // Setup
  async isSetupComplete(): Promise<boolean> {
    const val = await getItem<boolean>(STORAGE_KEYS.SETUP_COMPLETE);
    return val === true;
  },
  async markSetupComplete(): Promise<boolean> {
    return setItem(STORAGE_KEYS.SETUP_COMPLETE, true);
  },
};
