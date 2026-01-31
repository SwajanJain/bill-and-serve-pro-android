import { Area, Category, MenuItem, Table, User, RestaurantSettings } from '@/types';

export const mockUsers: User[] = [
  { id: '1', name: 'Owner', email: 'owner@restro.com', phone: '9876543210', pin: '1234', role: 'owner', isActive: true, forcePasswordChange: true, createdAt: new Date() },
];

export const mockAreas: Area[] = [];

export const mockTables: Table[] = [];

export const mockCategories: Category[] = [];

export const mockMenuItems: MenuItem[] = [];

export const defaultSettings: RestaurantSettings = {
  name: '',
  phone: '',
  address: '',
  gstEnabled: false,
  gstin: '',
  defaultTaxRate: 5,
  showTaxBreakdown: true,
  cashierDiscountLimit: 10,
  requireCancelReason: true,
  closingTime: '23:00',
};

// Generate order number
export const generateOrderNumber = (): string => {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${dateStr}-${random}`;
};
