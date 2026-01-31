import { Preferences } from '@capacitor/preferences';
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

  // Setup
  SETUP_COMPLETE: 'app_setup_complete',
} as const;

// Generic storage functions
export async function setItem<T>(key: string, value: T): Promise<boolean> {
  try {
    await Preferences.set({
      key,
      value: JSON.stringify(value),
    });
    return true;
  } catch (error) {
    console.error(`Error saving ${key}:`, error);
    return false;
  }
}

export async function getItem<T>(key: string): Promise<T | null> {
  try {
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
    await Preferences.remove({ key });
    return true;
  } catch (error) {
    console.error(`Error removing ${key}:`, error);
    return false;
  }
}

export async function clearAll(): Promise<void> {
  try {
    await Preferences.clear();
  } catch (error) {
    console.error('Error clearing storage:', error);
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
    return setItem(STORAGE_KEYS.MENU_ITEMS, items);
  },
  async getMenuItems<T>(): Promise<T | null> {
    return getItem<T>(STORAGE_KEYS.MENU_ITEMS);
  },

  async saveCategories<T>(categories: T): Promise<boolean> {
    return setItem(STORAGE_KEYS.CATEGORIES, categories);
  },
  async getCategories<T>(): Promise<T | null> {
    return getItem<T>(STORAGE_KEYS.CATEGORIES);
  },

  async saveTables<T>(tables: T): Promise<boolean> {
    return setItem(STORAGE_KEYS.TABLES, tables);
  },
  async getTables<T>(): Promise<T | null> {
    return getItem<T>(STORAGE_KEYS.TABLES);
  },

  async saveActiveOrders<T>(orders: T): Promise<boolean> {
    return setItem(STORAGE_KEYS.ACTIVE_ORDERS, orders);
  },
  async getActiveOrders<T>(): Promise<T | null> {
    return getItem<T>(STORAGE_KEYS.ACTIVE_ORDERS);
  },
  async getActiveOrdersSafe(): Promise<Order[]> {
    const raw = await getItem<unknown>(STORAGE_KEYS.ACTIVE_ORDERS);
    return validateActiveOrders(raw);
  },

  async saveCompletedOrders(orders: Order[]): Promise<boolean> {
    return setItem(STORAGE_KEYS.COMPLETED_ORDERS, orders);
  },
  async getCompletedOrders(): Promise<Order[]> {
    const raw = await getItem<unknown>(STORAGE_KEYS.COMPLETED_ORDERS);
    return validateActiveOrders(raw); // same validation works
  },

  async saveDailySummaries(summaries: DailySummary[]): Promise<boolean> {
    return setItem(STORAGE_KEYS.DAILY_SUMMARIES, summaries);
  },
  async getDailySummaries(): Promise<DailySummary[]> {
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
    return setItem(STORAGE_KEYS.USERS, users);
  },
  async getUsers<T>(): Promise<T | null> {
    return getItem<T>(STORAGE_KEYS.USERS);
  },

  async saveAreas<T>(areas: T): Promise<boolean> {
    return setItem(STORAGE_KEYS.AREAS, areas);
  },
  async getAreas<T>(): Promise<T | null> {
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

  // Setup
  async isSetupComplete(): Promise<boolean> {
    const val = await getItem<boolean>(STORAGE_KEYS.SETUP_COMPLETE);
    return val === true;
  },
  async markSetupComplete(): Promise<boolean> {
    return setItem(STORAGE_KEYS.SETUP_COMPLETE, true);
  },
};
