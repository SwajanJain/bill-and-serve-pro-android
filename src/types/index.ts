// Core Types for Restaurant POS System

export type UserRole = 'owner' | 'manager' | 'cashier';

export interface User {
  id: string;
  name: string;
  phone?: string;
  email: string;
  pin?: string;
  role: UserRole;
  isActive: boolean;
  forcePasswordChange?: boolean;
  createdAt: Date;
}

export interface Area {
  id: string;
  name: string;
}

export interface Table {
  id: string;
  areaId: string;
  name: string;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  basePrice: number;
  taxRatePercent: number;
  isVeg?: boolean;
  isActive: boolean;
}

export type OrderType = 'dine-in' | 'takeaway';
export type OrderStatus = 'open' | 'billed' | 'paid' | 'cancelled';
export type PaymentStatus = 'pending' | 'partial' | 'paid';
export type PaymentMethod = 'cash' | 'upi';
export type DiscountType = 'percentage' | 'flat';

export interface OrderLine {
  id: string;
  orderId: string;
  menuItemId: string;
  menuItem: MenuItem;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  taxRatePercent: number;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  orderType: OrderType;
  tableId?: string;
  table?: Table;
  status: OrderStatus;
  lines: OrderLine[];
  subtotal: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountReason?: string;
  taxTotal: number;
  grandTotal: number;
  paymentMethod?: PaymentMethod;
  paymentStatus: PaymentStatus;
  cancelReason?: string;
  cancelledAt?: Date;
  createdBy: string;
  createdAt: Date;
  closedAt?: Date;
}

export interface Payment {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  reference?: string;
  receivedAt: Date;
  receivedBy: string;
}

export interface AuditEvent {
  id: string;
  eventType: string;
  actorUserId: string;
  actorName: string;
  entityType: string;
  entityId: string;
  beforeJson?: string;
  afterJson?: string;
  reason?: string;
  createdAt: Date;
}

export interface RestaurantSettings {
  name: string;
  phone: string;
  address: string;
  gstEnabled: boolean;
  gstin: string;
  defaultTaxRate: number;
  showTaxBreakdown: boolean;
  cashierDiscountLimit: number;
  requireCancelReason: boolean;
  closingTime?: string;
}

export interface DailySummary {
  date: string; // YYYY-MM-DD
  cashTotal: number;
  upiTotal: number;
  orderCount: number;
  grandTotal: number;
}

export interface DashboardStats {
  todaySales: number;
  ordersCount: number;
  paymentSplit: {
    cash: number;
    upi: number;
  };
}
