import { db, sqlite } from './index.js';
import {
  users,
  areas,
  tables,
  categories,
  menuItems,
  rawMaterials,
  settings,
  sequences,
} from './schema.js';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const SALT_ROUNDS = 10;

async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function seed() {
  console.log('🌱 Seeding database...');

  const now = new Date();

  try {
    // Check if already seeded
    const existingUsers = db.select().from(users).all();
    if (existingUsers.length > 0) {
      console.log('⚠️  Database already seeded. Skipping...');
      return;
    }

    // Seed Users
    console.log('👤 Seeding users...');
    const seedUsers = [
      {
        id: 'user-1',
        name: 'Rajesh Kumar',
        email: 'owner@restro.com',
        phone: '9876543210',
        role: 'owner' as const,
        pin: await hashPin('1234'),
        passwordHash: await hashPassword('password123'),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-2',
        name: 'Amit Singh',
        email: 'manager@restro.com',
        phone: '9876543211',
        role: 'manager' as const,
        pin: await hashPin('2345'),
        passwordHash: await hashPassword('password123'),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-3',
        name: 'Priya Sharma',
        email: 'cashier@restro.com',
        phone: '9876543212',
        role: 'cashier' as const,
        pin: await hashPin('3456'),
        passwordHash: await hashPassword('password123'),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'user-4',
        name: 'Suresh',
        email: 'kitchen@restro.com',
        phone: '9876543213',
        role: 'kitchen' as const,
        pin: await hashPin('4567'),
        passwordHash: await hashPassword('password123'),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const user of seedUsers) {
      db.insert(users).values(user).run();
    }

    // Seed Areas
    console.log('🏠 Seeding areas...');
    const seedAreas = [
      { id: 'area-1', name: 'Main Hall', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
      { id: 'area-2', name: 'Garden', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
      { id: 'area-3', name: 'AC Section', sortOrder: 3, isActive: true, createdAt: now, updatedAt: now },
    ];

    for (const area of seedAreas) {
      db.insert(areas).values(area).run();
    }

    // Seed Tables
    console.log('🪑 Seeding tables...');
    const seedTables = [
      { id: 'table-1', areaId: 'area-1', name: 'T1', capacity: 4, isActive: true, createdAt: now, updatedAt: now },
      { id: 'table-2', areaId: 'area-1', name: 'T2', capacity: 4, isActive: true, createdAt: now, updatedAt: now },
      { id: 'table-3', areaId: 'area-1', name: 'T3', capacity: 4, isActive: true, createdAt: now, updatedAt: now },
      { id: 'table-4', areaId: 'area-1', name: 'T4', capacity: 6, isActive: true, createdAt: now, updatedAt: now },
      { id: 'table-5', areaId: 'area-2', name: 'G1', capacity: 4, isActive: true, createdAt: now, updatedAt: now },
      { id: 'table-6', areaId: 'area-2', name: 'G2', capacity: 6, isActive: true, createdAt: now, updatedAt: now },
      { id: 'table-7', areaId: 'area-3', name: 'AC1', capacity: 4, isActive: true, createdAt: now, updatedAt: now },
      { id: 'table-8', areaId: 'area-3', name: 'AC2', capacity: 4, isActive: true, createdAt: now, updatedAt: now },
      { id: 'table-9', areaId: 'area-3', name: 'AC3', capacity: 6, isActive: true, createdAt: now, updatedAt: now },
    ];

    for (const table of seedTables) {
      db.insert(tables).values(table).run();
    }

    // Seed Categories
    console.log('📁 Seeding categories...');
    const seedCategories = [
      { id: 'cat-1', name: 'Coffee & Shakes', sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
      { id: 'cat-2', name: 'Mojitos & Lassi', sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
      { id: 'cat-3', name: 'Starters', sortOrder: 3, isActive: true, createdAt: now, updatedAt: now },
      { id: 'cat-4', name: 'Daal', sortOrder: 4, isActive: true, createdAt: now, updatedAt: now },
      { id: 'cat-5', name: 'Sabzi', sortOrder: 5, isActive: true, createdAt: now, updatedAt: now },
      { id: 'cat-6', name: 'Paneer', sortOrder: 6, isActive: true, createdAt: now, updatedAt: now },
      { id: 'cat-7', name: 'Rice', sortOrder: 7, isActive: true, createdAt: now, updatedAt: now },
      { id: 'cat-8', name: 'Raita', sortOrder: 8, isActive: true, createdAt: now, updatedAt: now },
      { id: 'cat-9', name: 'Breads', sortOrder: 9, isActive: true, createdAt: now, updatedAt: now },
      { id: 'cat-10', name: 'Continental', sortOrder: 10, isActive: true, createdAt: now, updatedAt: now },
      { id: 'cat-11', name: 'Chinese', sortOrder: 11, isActive: true, createdAt: now, updatedAt: now },
      { id: 'cat-12', name: 'Desserts', sortOrder: 12, isActive: true, createdAt: now, updatedAt: now },
      { id: 'cat-13', name: 'Snacks', sortOrder: 13, isActive: true, createdAt: now, updatedAt: now },
      { id: 'cat-14', name: 'Thali', sortOrder: 14, isActive: true, createdAt: now, updatedAt: now },
    ];

    for (const category of seedCategories) {
      db.insert(categories).values(category).run();
    }

    // Seed Menu Items
    console.log('🍽️  Seeding menu items...');
    const seedMenuItems = [
      // Coffee & Shakes (cat-1)
      { id: 'item-1', categoryId: 'cat-1', name: 'Hot Coffee', basePrice: 40, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-2', categoryId: 'cat-1', name: 'Cappuccino', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-3', categoryId: 'cat-1', name: 'Plain Cold Coffee', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-4', categoryId: 'cat-1', name: 'Cold Coffee with Ice Cream', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-5', categoryId: 'cat-1', name: 'Oreo Shake', basePrice: 120, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-6', categoryId: 'cat-1', name: 'KitKat Shake', basePrice: 120, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-7', categoryId: 'cat-1', name: 'Chocolate Shake', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-8', categoryId: 'cat-1', name: 'Strawberry Shake', basePrice: 170, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-9', categoryId: 'cat-1', name: 'Choco Shake', basePrice: 200, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },

      // Mojitos & Lassi (cat-2)
      { id: 'item-10', categoryId: 'cat-2', name: 'Lemon Mojito', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-11', categoryId: 'cat-2', name: 'Mint Mojito', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-12', categoryId: 'cat-2', name: 'Blue Berry Mojito', basePrice: 130, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-13', categoryId: 'cat-2', name: 'Strawberry Mojito', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-14', categoryId: 'cat-2', name: 'Masala Chaach', basePrice: 50, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-15', categoryId: 'cat-2', name: 'Plain Lassi', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-16', categoryId: 'cat-2', name: 'Dry Fruit Lassi', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },

      // Starters (cat-3) - Salad, Papad, Soup
      { id: 'item-17', categoryId: 'cat-3', name: 'Onion Salad', basePrice: 40, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-18', categoryId: 'cat-3', name: 'Green Salad', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-19', categoryId: 'cat-3', name: 'Kachumber Salad', basePrice: 70, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-20', categoryId: 'cat-3', name: 'Plain Roasted Papad', basePrice: 20, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-21', categoryId: 'cat-3', name: 'Fried Papad', basePrice: 30, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-22', categoryId: 'cat-3', name: 'Masala Papad', basePrice: 40, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-23', categoryId: 'cat-3', name: 'Tomato Soup', basePrice: 50, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-24', categoryId: 'cat-3', name: 'Sweet Corn Soup', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-25', categoryId: 'cat-3', name: 'Manchow Soup', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-26', categoryId: 'cat-3', name: 'Hot & Sour Soup', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },

      // Daal (cat-4)
      { id: 'item-27', categoryId: 'cat-4', name: 'Fried Daal', basePrice: 120, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-28', categoryId: 'cat-4', name: 'Daal Tadka', basePrice: 140, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-29', categoryId: 'cat-4', name: 'Daal Masala', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-30', categoryId: 'cat-4', name: 'Daal Butter', basePrice: 160, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },

      // Sabzi (cat-5)
      { id: 'item-31', categoryId: 'cat-5', name: 'Mix Veg', basePrice: 160, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-32', categoryId: 'cat-5', name: 'Sev Tamatar', basePrice: 140, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-33', categoryId: 'cat-5', name: 'Sev Bhaaji', basePrice: 170, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-34', categoryId: 'cat-5', name: 'Mutter Masala', basePrice: 140, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-35', categoryId: 'cat-5', name: 'Chana Masala', basePrice: 140, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-36', categoryId: 'cat-5', name: 'Aloo Masala', basePrice: 140, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-37', categoryId: 'cat-5', name: 'Aloo Jeera', basePrice: 110, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-38', categoryId: 'cat-5', name: 'Baingan Masala', basePrice: 140, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-39', categoryId: 'cat-5', name: 'Tamatar Masala', basePrice: 140, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-40', categoryId: 'cat-5', name: 'Bhindi Masala', basePrice: 140, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },

      // Paneer (cat-6)
      { id: 'item-41', categoryId: 'cat-6', name: 'Matar Paneer', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-42', categoryId: 'cat-6', name: 'Chola Paneer', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-43', categoryId: 'cat-6', name: 'Palak Paneer', basePrice: 200, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-44', categoryId: 'cat-6', name: 'Kaju Kari', basePrice: 210, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-45', categoryId: 'cat-6', name: 'Kadai Paneer', basePrice: 220, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-46', categoryId: 'cat-6', name: 'Masala Paneer', basePrice: 220, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-47', categoryId: 'cat-6', name: 'Malai Kofta', basePrice: 220, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-48', categoryId: 'cat-6', name: 'Shahi Paneer', basePrice: 220, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-49', categoryId: 'cat-6', name: 'Paneer Do Pyaza', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-50', categoryId: 'cat-6', name: 'Butter Paneer Masala', basePrice: 240, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-51', categoryId: 'cat-6', name: 'Hyderabadi Paneer', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-52', categoryId: 'cat-6', name: 'Kaju Paneer', basePrice: 240, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-53', categoryId: 'cat-6', name: 'Paneer Kofta', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-54', categoryId: 'cat-6', name: 'Paneer Kolhapuri', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-55', categoryId: 'cat-6', name: 'Paneer Angaara', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-56', categoryId: 'cat-6', name: 'Paneer Lababdaar', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-57', categoryId: 'cat-6', name: 'Punjabi Paneer', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-58', categoryId: 'cat-6', name: 'Paneer Handi', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-59', categoryId: 'cat-6', name: 'Paneer Bhurji', basePrice: 270, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-60', categoryId: 'cat-6', name: 'Paneer Tikka Masala', basePrice: 300, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-61', categoryId: 'cat-6', name: 'M2 Special Paneer', basePrice: 350, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },

      // Rice (cat-7)
      { id: 'item-62', categoryId: 'cat-7', name: 'Jeera Rice', basePrice: 90, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-63', categoryId: 'cat-7', name: 'Masala Rice', basePrice: 120, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-64', categoryId: 'cat-7', name: 'Mutter Pulao', basePrice: 130, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-65', categoryId: 'cat-7', name: 'Aloo Pulao', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-66', categoryId: 'cat-7', name: 'Veg Pulao', basePrice: 160, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-67', categoryId: 'cat-7', name: 'Kaju Paneer Pulao', basePrice: 190, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-68', categoryId: 'cat-7', name: 'Hyderabadi Veg Biryani', basePrice: 200, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },

      // Raita (cat-8)
      { id: 'item-69', categoryId: 'cat-8', name: 'Bundi Raita', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-70', categoryId: 'cat-8', name: 'Vegetable Raita', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-71', categoryId: 'cat-8', name: 'Mint Raita', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },

      // Breads (cat-9)
      { id: 'item-72', categoryId: 'cat-9', name: 'Tawa Roti', basePrice: 10, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-73', categoryId: 'cat-9', name: 'Tawa Butter Roti', basePrice: 12, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-74', categoryId: 'cat-9', name: 'Tandoori Roti', basePrice: 10, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-75', categoryId: 'cat-9', name: 'Tandoori Butter Roti', basePrice: 12, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-76', categoryId: 'cat-9', name: 'Plain Naan', basePrice: 40, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-77', categoryId: 'cat-9', name: 'Butter Naan', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-78', categoryId: 'cat-9', name: 'Garlic Naan', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-79', categoryId: 'cat-9', name: 'Laccha Paratha', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-80', categoryId: 'cat-9', name: 'Aloo Paratha', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-81', categoryId: 'cat-9', name: 'Sev Paratha', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-82', categoryId: 'cat-9', name: 'Masala Paratha', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-83', categoryId: 'cat-9', name: 'Paneer Paratha', basePrice: 120, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-84', categoryId: 'cat-9', name: 'M2 Special Paratha', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },

      // Continental (cat-10) - Fries, Burger, Sandwich, Pizza, Pasta
      { id: 'item-85', categoryId: 'cat-10', name: 'Plain French Fries', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-86', categoryId: 'cat-10', name: 'Masala French Fries', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-87', categoryId: 'cat-10', name: 'Cheese French Fries', basePrice: 90, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-88', categoryId: 'cat-10', name: 'Peri Peri French Fries', basePrice: 90, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-89', categoryId: 'cat-10', name: 'Veg Cheese Burger', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-90', categoryId: 'cat-10', name: 'Paneer Cheese Burger', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-91', categoryId: 'cat-10', name: 'Double Cheese Burger', basePrice: 110, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-92', categoryId: 'cat-10', name: 'Veg Sandwich', basePrice: 70, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-93', categoryId: 'cat-10', name: 'Veg Cheese Sandwich', basePrice: 90, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-94', categoryId: 'cat-10', name: 'Cheese Corn Sandwich', basePrice: 110, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-95', categoryId: 'cat-10', name: 'Peri Peri Cheese Sandwich', basePrice: 120, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-96', categoryId: 'cat-10', name: 'Paneer Cheese Sandwich', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-97', categoryId: 'cat-10', name: 'M2 Special Sandwich', basePrice: 200, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-98', categoryId: 'cat-10', name: 'Onion Pizza', basePrice: 120, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-99', categoryId: 'cat-10', name: 'Margherita Pizza', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-100', categoryId: 'cat-10', name: 'Capsicum Pizza', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-101', categoryId: 'cat-10', name: 'Classic Veggie Pizza', basePrice: 200, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-102', categoryId: 'cat-10', name: 'Cheese Corn Delight Pizza', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-103', categoryId: 'cat-10', name: 'Peri Peri Paneer Pizza', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-104', categoryId: 'cat-10', name: 'Paneer Tikka Pizza', basePrice: 300, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-105', categoryId: 'cat-10', name: 'M2 Special Delight Pizza', basePrice: 420, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-106', categoryId: 'cat-10', name: 'Veg Pasta', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-107', categoryId: 'cat-10', name: 'Red Sauce Pasta', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-108', categoryId: 'cat-10', name: 'White Sauce Pasta', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },

      // Chinese (cat-11)
      { id: 'item-109', categoryId: 'cat-11', name: 'Veg Noodles', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-110', categoryId: 'cat-11', name: 'Hakka Noodles', basePrice: 90, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-111', categoryId: 'cat-11', name: 'Veg Manchurian Mix Noodles', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-112', categoryId: 'cat-11', name: 'Veg Kothey', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-113', categoryId: 'cat-11', name: 'Gravy Manchurian', basePrice: 90, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-114', categoryId: 'cat-11', name: 'Dry Manchurian', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-115', categoryId: 'cat-11', name: 'Schezwan Fried Rice', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-116', categoryId: 'cat-11', name: 'Chilli Potato', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-117', categoryId: 'cat-11', name: 'Chilli Paneer', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },

      // Desserts (cat-12)
      { id: 'item-118', categoryId: 'cat-12', name: 'Brownie with Ice Cream', basePrice: 120, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-119', categoryId: 'cat-12', name: 'Oreo Brownie', basePrice: 150, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-120', categoryId: 'cat-12', name: 'M2 Special Brownie', basePrice: 300, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-121', categoryId: 'cat-12', name: 'Gulab Jamun (2 pcs)', basePrice: 50, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-122', categoryId: 'cat-12', name: 'White Rasgulla (2 pcs)', basePrice: 30, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },

      // Snacks (cat-13)
      { id: 'item-123', categoryId: 'cat-13', name: 'Chole Bhatura', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-124', categoryId: 'cat-13', name: 'Chole Kulcha', basePrice: 110, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-125', categoryId: 'cat-13', name: 'Pav Bhaji', basePrice: 70, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-126', categoryId: 'cat-13', name: 'Crispy Corn', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-127', categoryId: 'cat-13', name: 'Steam Momos', basePrice: 60, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-128', categoryId: 'cat-13', name: 'Fried Momos', basePrice: 80, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-129', categoryId: 'cat-13', name: 'Paneer Momos', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-130', categoryId: 'cat-13', name: 'Paneer Pakoda', basePrice: 160, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-131', categoryId: 'cat-13', name: 'Paneer Tikka', basePrice: 220, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-132', categoryId: 'cat-13', name: 'Achari Paneer Tikka', basePrice: 250, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-133', categoryId: 'cat-13', name: 'Malai Paneer Tikka', basePrice: 260, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-134', categoryId: 'cat-13', name: 'Chana Roast', basePrice: 100, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-135', categoryId: 'cat-13', name: 'Peanut Masala', basePrice: 110, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },

      // Thali (cat-14)
      { id: 'item-136', categoryId: 'cat-14', name: 'Special Thali', basePrice: 160, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-137', categoryId: 'cat-14', name: 'Deluxe Thali', basePrice: 220, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-138', categoryId: 'cat-14', name: 'Super Deluxe Thali', basePrice: 300, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
      { id: 'item-139', categoryId: 'cat-14', name: 'M2 Special Thali', basePrice: 350, taxRatePercent: 5, isVeg: true, isActive: true, createdAt: now, updatedAt: now },
    ];

    for (const item of seedMenuItems) {
      db.insert(menuItems).values(item).run();
    }

    // Seed Raw Materials
    console.log('📦 Seeding inventory...');
    const seedMaterials = [
      { id: 'mat-1', name: 'Basmati Rice', unit: 'kg', currentStock: 25, lowStockThreshold: 10, isActive: true, createdAt: now, updatedAt: now },
      { id: 'mat-2', name: 'Chicken', unit: 'kg', currentStock: 8, lowStockThreshold: 5, isActive: true, createdAt: now, updatedAt: now },
      { id: 'mat-3', name: 'Paneer', unit: 'kg', currentStock: 3, lowStockThreshold: 5, isActive: true, createdAt: now, updatedAt: now },
      { id: 'mat-4', name: 'Onion', unit: 'kg', currentStock: 15, lowStockThreshold: 10, isActive: true, createdAt: now, updatedAt: now },
      { id: 'mat-5', name: 'Tomato', unit: 'kg', currentStock: 12, lowStockThreshold: 8, isActive: true, createdAt: now, updatedAt: now },
      { id: 'mat-6', name: 'Cooking Oil', unit: 'L', currentStock: 20, lowStockThreshold: 10, isActive: true, createdAt: now, updatedAt: now },
      { id: 'mat-7', name: 'Butter', unit: 'kg', currentStock: 2, lowStockThreshold: 3, isActive: true, createdAt: now, updatedAt: now },
      { id: 'mat-8', name: 'Cream', unit: 'L', currentStock: 5, lowStockThreshold: 4, isActive: true, createdAt: now, updatedAt: now },
      { id: 'mat-9', name: 'Mutton', unit: 'kg', currentStock: 4, lowStockThreshold: 3, isActive: true, createdAt: now, updatedAt: now },
      { id: 'mat-10', name: 'Garlic', unit: 'kg', currentStock: 2, lowStockThreshold: 2, isActive: true, createdAt: now, updatedAt: now },
    ];

    for (const material of seedMaterials) {
      db.insert(rawMaterials).values(material).run();
    }

    // Seed Settings
    console.log('⚙️  Seeding settings...');
    db.insert(settings).values({
      id: 1,
      name: 'My Restaurant',
      phone: '9876543210',
      address: '123 Main Street, City',
      gstin: '12ABCDE1234F1Z5',
      defaultTaxRate: 5,
      serviceCharge: 0,
      showTaxBreakdown: true,
      cashierDiscountLimit: 10,
      requireCancelReason: true,
      lowStockAlerts: true,
      newOrderSound: true,
      invoicePrefix: 'INV',
      kotPrefix: 'KOT',
      updatedAt: now,
    }).run();

    // Seed Sequences
    console.log('🔢 Seeding sequences...');
    const today = new Date().toISOString().split('T')[0];
    db.insert(sequences).values([
      { name: 'order_number', currentValue: 0, prefix: 'ORD', resetDaily: true, lastResetDate: today },
      { name: 'kot_number', currentValue: 0, prefix: 'KOT', resetDaily: true, lastResetDate: today },
    ]).run();

    console.log('✅ Database seeded successfully!');
    console.log('');
    console.log('📋 Default PINs:');
    console.log('   Owner (Rajesh Kumar): 1234');
    console.log('   Manager (Amit Singh): 2345');
    console.log('   Cashier (Priya Sharma): 3456');
    console.log('   Kitchen (Suresh): 4567');
    console.log('');
    console.log('🔑 Default password for all users: password123');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    sqlite.close();
  }
}

seed();
