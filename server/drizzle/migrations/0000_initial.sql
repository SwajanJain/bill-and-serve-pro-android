-- Initial database schema for Bill & Serve Pro

-- Users table
CREATE TABLE IF NOT EXISTS `users` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL,
  `phone` text,
  `pin` text,
  `password_hash` text,
  `role` text NOT NULL,
  `is_active` integer DEFAULT true NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);

-- Areas table
CREATE TABLE IF NOT EXISTS `areas` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `is_active` integer DEFAULT true NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

-- Tables table
CREATE TABLE IF NOT EXISTS `tables` (
  `id` text PRIMARY KEY NOT NULL,
  `area_id` text NOT NULL,
  `name` text NOT NULL,
  `capacity` integer DEFAULT 4,
  `is_active` integer DEFAULT true NOT NULL,
  `current_order_id` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`)
);

-- Categories table
CREATE TABLE IF NOT EXISTS `categories` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `is_active` integer DEFAULT true NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

-- Menu items table
CREATE TABLE IF NOT EXISTS `menu_items` (
  `id` text PRIMARY KEY NOT NULL,
  `category_id` text NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `base_price` real NOT NULL,
  `tax_rate_percent` real DEFAULT 5 NOT NULL,
  `is_veg` integer DEFAULT true,
  `is_active` integer DEFAULT true NOT NULL,
  `image_url` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`)
);

-- Orders table
CREATE TABLE IF NOT EXISTS `orders` (
  `id` text PRIMARY KEY NOT NULL,
  `order_number` text NOT NULL,
  `order_type` text NOT NULL,
  `table_id` text,
  `status` text DEFAULT 'open' NOT NULL,
  `subtotal` real DEFAULT 0 NOT NULL,
  `discount_type` text,
  `discount_value` real,
  `discount_reason` text,
  `tax_total` real DEFAULT 0 NOT NULL,
  `grand_total` real DEFAULT 0 NOT NULL,
  `payment_status` text DEFAULT 'pending' NOT NULL,
  `created_by` text NOT NULL,
  `created_at` integer NOT NULL,
  `closed_at` integer,
  `cancelled_at` integer,
  `cancel_reason` text,
  FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
);
CREATE UNIQUE INDEX IF NOT EXISTS `orders_order_number_unique` ON `orders` (`order_number`);

-- Order lines table
CREATE TABLE IF NOT EXISTS `order_lines` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL,
  `menu_item_id` text NOT NULL,
  `qty` integer DEFAULT 1 NOT NULL,
  `unit_price` real NOT NULL,
  `tax_rate` real NOT NULL,
  `line_total` real NOT NULL,
  `notes` text,
  `kot_sent` integer DEFAULT false NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`)
);

-- KOTs (Kitchen Order Tickets) table
CREATE TABLE IF NOT EXISTS `kots` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL,
  `kot_number` text NOT NULL,
  `status` text DEFAULT 'new' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
);

-- KOT lines table
CREATE TABLE IF NOT EXISTS `kot_lines` (
  `id` text PRIMARY KEY NOT NULL,
  `kot_id` text NOT NULL,
  `order_line_id` text NOT NULL,
  `menu_item_name` text NOT NULL,
  `qty` integer NOT NULL,
  `notes` text,
  FOREIGN KEY (`kot_id`) REFERENCES `kots`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`order_line_id`) REFERENCES `order_lines`(`id`)
);

-- Payments table
CREATE TABLE IF NOT EXISTS `payments` (
  `id` text PRIMARY KEY NOT NULL,
  `order_id` text NOT NULL,
  `method` text NOT NULL,
  `amount` real NOT NULL,
  `reference` text,
  `received_at` integer NOT NULL,
  `received_by` text NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`),
  FOREIGN KEY (`received_by`) REFERENCES `users`(`id`)
);

-- Raw materials (inventory) table
CREATE TABLE IF NOT EXISTS `raw_materials` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `unit` text NOT NULL,
  `current_stock` real DEFAULT 0 NOT NULL,
  `low_stock_threshold` real DEFAULT 10 NOT NULL,
  `is_active` integer DEFAULT true NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

-- Stock transactions table
CREATE TABLE IF NOT EXISTS `stock_transactions` (
  `id` text PRIMARY KEY NOT NULL,
  `raw_material_id` text NOT NULL,
  `direction` text NOT NULL,
  `qty` real NOT NULL,
  `reason` text NOT NULL,
  `created_by` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`raw_material_id`) REFERENCES `raw_materials`(`id`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
);

-- Audit events table
CREATE TABLE IF NOT EXISTS `audit_events` (
  `id` text PRIMARY KEY NOT NULL,
  `event_type` text NOT NULL,
  `actor_user_id` text,
  `actor_name` text,
  `entity_type` text NOT NULL,
  `entity_id` text NOT NULL,
  `before_json` text,
  `after_json` text,
  `reason` text,
  `ip_address` text,
  `user_agent` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`)
);

-- Settings table (single row)
CREATE TABLE IF NOT EXISTS `settings` (
  `id` integer PRIMARY KEY DEFAULT 1,
  `name` text DEFAULT 'My Restaurant' NOT NULL,
  `phone` text,
  `address` text,
  `gstin` text,
  `default_tax_rate` real DEFAULT 5 NOT NULL,
  `service_charge` real DEFAULT 0 NOT NULL,
  `show_tax_breakdown` integer DEFAULT true NOT NULL,
  `cashier_discount_limit` real DEFAULT 10 NOT NULL,
  `require_cancel_reason` integer DEFAULT true NOT NULL,
  `low_stock_alerts` integer DEFAULT true NOT NULL,
  `new_order_sound` integer DEFAULT true NOT NULL,
  `invoice_prefix` text DEFAULT 'INV',
  `kot_prefix` text DEFAULT 'KOT',
  `updated_at` integer NOT NULL
);

-- Sequences table (for order/KOT number generation)
CREATE TABLE IF NOT EXISTS `sequences` (
  `name` text PRIMARY KEY NOT NULL,
  `current_value` integer DEFAULT 0 NOT NULL,
  `prefix` text,
  `reset_daily` integer DEFAULT false NOT NULL,
  `last_reset_date` text
);
