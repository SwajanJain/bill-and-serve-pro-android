import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============== USERS ==============
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  pin: text('pin'), // 4-digit PIN (hashed)
  passwordHash: text('password_hash'), // For settings access
  role: text('role', { enum: ['owner', 'manager', 'cashier', 'kitchen'] }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  payments: many(payments),
  auditEvents: many(auditEvents),
  stockTransactions: many(stockTransactions),
}));

// ============== AREAS ==============
export const areas = sqliteTable('areas', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const areasRelations = relations(areas, ({ many }) => ({
  tables: many(tables),
}));

// ============== TABLES ==============
export const tables = sqliteTable('tables', {
  id: text('id').primaryKey(),
  areaId: text('area_id').notNull().references(() => areas.id),
  name: text('name').notNull(),
  capacity: integer('capacity').default(4),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  currentOrderId: text('current_order_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const tablesRelations = relations(tables, ({ one, many }) => ({
  area: one(areas, {
    fields: [tables.areaId],
    references: [areas.id],
  }),
  orders: many(orders),
}));

// ============== CATEGORIES ==============
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  menuItems: many(menuItems),
}));

// ============== MENU ITEMS ==============
export const menuItems = sqliteTable('menu_items', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').notNull().references(() => categories.id),
  name: text('name').notNull(),
  description: text('description'),
  basePrice: real('base_price').notNull(),
  taxRatePercent: real('tax_rate_percent').notNull().default(5),
  isVeg: integer('is_veg', { mode: 'boolean' }).default(true),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  imageUrl: text('image_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  category: one(categories, {
    fields: [menuItems.categoryId],
    references: [categories.id],
  }),
  orderLines: many(orderLines),
}));

// ============== ORDERS ==============
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  orderType: text('order_type', { enum: ['dine-in', 'takeaway'] }).notNull(),
  tableId: text('table_id').references(() => tables.id),
  status: text('status', { enum: ['open', 'billed', 'paid', 'cancelled'] }).notNull().default('open'),
  subtotal: real('subtotal').notNull().default(0),
  discountType: text('discount_type', { enum: ['percentage', 'flat'] }),
  discountValue: real('discount_value'),
  discountReason: text('discount_reason'),
  taxTotal: real('tax_total').notNull().default(0),
  grandTotal: real('grand_total').notNull().default(0),
  paymentStatus: text('payment_status', { enum: ['pending', 'partial', 'paid'] }).notNull().default('pending'),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  closedAt: integer('closed_at', { mode: 'timestamp' }),
  cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),
  cancelReason: text('cancel_reason'),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
  table: one(tables, {
    fields: [orders.tableId],
    references: [tables.id],
  }),
  createdByUser: one(users, {
    fields: [orders.createdBy],
    references: [users.id],
  }),
  lines: many(orderLines),
  kots: many(kots),
  payments: many(payments),
}));

// ============== ORDER LINES ==============
export const orderLines = sqliteTable('order_lines', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  menuItemId: text('menu_item_id').notNull().references(() => menuItems.id),
  qty: integer('qty').notNull().default(1),
  unitPrice: real('unit_price').notNull(),
  taxRate: real('tax_rate').notNull(),
  lineTotal: real('line_total').notNull(),
  notes: text('notes'),
  kotSent: integer('kot_sent', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const orderLinesRelations = relations(orderLines, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderLines.orderId],
    references: [orders.id],
  }),
  menuItem: one(menuItems, {
    fields: [orderLines.menuItemId],
    references: [menuItems.id],
  }),
  kotLines: many(kotLines),
}));

// ============== KOT (Kitchen Order Ticket) ==============
export const kots = sqliteTable('kots', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  kotNumber: text('kot_number').notNull(),
  status: text('status', { enum: ['new', 'preparing', 'ready'] }).notNull().default('new'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const kotsRelations = relations(kots, ({ one, many }) => ({
  order: one(orders, {
    fields: [kots.orderId],
    references: [orders.id],
  }),
  lines: many(kotLines),
}));

// ============== KOT LINES ==============
export const kotLines = sqliteTable('kot_lines', {
  id: text('id').primaryKey(),
  kotId: text('kot_id').notNull().references(() => kots.id, { onDelete: 'cascade' }),
  orderLineId: text('order_line_id').notNull().references(() => orderLines.id),
  menuItemName: text('menu_item_name').notNull(),
  qty: integer('qty').notNull(),
  notes: text('notes'),
});

export const kotLinesRelations = relations(kotLines, ({ one }) => ({
  kot: one(kots, {
    fields: [kotLines.kotId],
    references: [kots.id],
  }),
  orderLine: one(orderLines, {
    fields: [kotLines.orderLineId],
    references: [orderLines.id],
  }),
}));

// ============== PAYMENTS ==============
export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull().references(() => orders.id),
  method: text('method', { enum: ['cash', 'upi', 'card'] }).notNull(),
  amount: real('amount').notNull(),
  reference: text('reference'),
  receivedAt: integer('received_at', { mode: 'timestamp' }).notNull(),
  receivedBy: text('received_by').notNull().references(() => users.id),
});

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
  receivedByUser: one(users, {
    fields: [payments.receivedBy],
    references: [users.id],
  }),
}));

// ============== RAW MATERIALS (Inventory) ==============
export const rawMaterials = sqliteTable('raw_materials', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  currentStock: real('current_stock').notNull().default(0),
  lowStockThreshold: real('low_stock_threshold').notNull().default(10),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const rawMaterialsRelations = relations(rawMaterials, ({ many }) => ({
  stockTransactions: many(stockTransactions),
}));

// ============== STOCK TRANSACTIONS ==============
export const stockTransactions = sqliteTable('stock_transactions', {
  id: text('id').primaryKey(),
  rawMaterialId: text('raw_material_id').notNull().references(() => rawMaterials.id),
  direction: text('direction', { enum: ['in', 'out'] }).notNull(),
  qty: real('qty').notNull(),
  reason: text('reason').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const stockTransactionsRelations = relations(stockTransactions, ({ one }) => ({
  rawMaterial: one(rawMaterials, {
    fields: [stockTransactions.rawMaterialId],
    references: [rawMaterials.id],
  }),
  createdByUser: one(users, {
    fields: [stockTransactions.createdBy],
    references: [users.id],
  }),
}));

// ============== AUDIT EVENTS ==============
export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(),
  actorUserId: text('actor_user_id').references(() => users.id),
  actorName: text('actor_name'),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  beforeJson: text('before_json'),
  afterJson: text('after_json'),
  reason: text('reason'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  actor: one(users, {
    fields: [auditEvents.actorUserId],
    references: [users.id],
  }),
}));

// ============== RESTAURANT SETTINGS ==============
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey().default(1),
  name: text('name').notNull().default('My Restaurant'),
  phone: text('phone'),
  address: text('address'),
  gstin: text('gstin'),
  defaultTaxRate: real('default_tax_rate').notNull().default(5),
  serviceCharge: real('service_charge').notNull().default(0),
  showTaxBreakdown: integer('show_tax_breakdown', { mode: 'boolean' }).notNull().default(true),
  cashierDiscountLimit: real('cashier_discount_limit').notNull().default(10),
  requireCancelReason: integer('require_cancel_reason', { mode: 'boolean' }).notNull().default(true),
  lowStockAlerts: integer('low_stock_alerts', { mode: 'boolean' }).notNull().default(true),
  newOrderSound: integer('new_order_sound', { mode: 'boolean' }).notNull().default(true),
  invoicePrefix: text('invoice_prefix').default('INV'),
  kotPrefix: text('kot_prefix').default('KOT'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// ============== SEQUENCES (for order/KOT numbers) ==============
export const sequences = sqliteTable('sequences', {
  name: text('name').primaryKey(),
  currentValue: integer('current_value').notNull().default(0),
  prefix: text('prefix'),
  resetDaily: integer('reset_daily', { mode: 'boolean' }).notNull().default(false),
  lastResetDate: text('last_reset_date'),
});

// Type exports for use in the app
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Area = typeof areas.$inferSelect;
export type NewArea = typeof areas.$inferInsert;
export type Table = typeof tables.$inferSelect;
export type NewTable = typeof tables.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type MenuItem = typeof menuItems.$inferSelect;
export type NewMenuItem = typeof menuItems.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderLine = typeof orderLines.$inferSelect;
export type NewOrderLine = typeof orderLines.$inferInsert;
export type KOT = typeof kots.$inferSelect;
export type NewKOT = typeof kots.$inferInsert;
export type KOTLine = typeof kotLines.$inferSelect;
export type NewKOTLine = typeof kotLines.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type RawMaterial = typeof rawMaterials.$inferSelect;
export type NewRawMaterial = typeof rawMaterials.$inferInsert;
export type StockTransaction = typeof stockTransactions.$inferSelect;
export type NewStockTransaction = typeof stockTransactions.$inferInsert;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type Sequence = typeof sequences.$inferSelect;
