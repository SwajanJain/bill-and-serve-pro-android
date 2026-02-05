import { Category, MenuItem, Order, OrderLine, Table, User, RestaurantSettings } from '@/types';

function toDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  return new Date();
}

export function mapUser(serverUser: Record<string, unknown>): User {
  return {
    id: String(serverUser.id),
    name: String(serverUser.name || ''),
    email: String(serverUser.email || ''),
    phone: serverUser.phone ? String(serverUser.phone) : undefined,
    role: (serverUser.role as User['role']) || 'cashier',
    isActive: Boolean(serverUser.isActive ?? true),
    createdAt: toDate(serverUser.createdAt),
  };
}

export function mapCategory(serverCategory: Record<string, unknown>): Category {
  return {
    id: String(serverCategory.id),
    name: String(serverCategory.name || ''),
    sortOrder: Number(serverCategory.sortOrder || 0),
    isActive: Boolean(serverCategory.isActive ?? true),
  };
}

export function mapMenuItem(serverItem: Record<string, unknown>): MenuItem {
  return {
    id: String(serverItem.id),
    categoryId: String(serverItem.categoryId || ''),
    name: String(serverItem.name || ''),
    basePrice: Number(serverItem.basePrice || 0),
    taxRatePercent: Number(serverItem.taxRatePercent || 0),
    isVeg: Boolean(serverItem.isVeg ?? true),
    isActive: Boolean(serverItem.isActive ?? true),
  };
}

export function mapTable(serverTable: Record<string, unknown>): Table {
  return {
    id: String(serverTable.id),
    areaId: String(serverTable.areaId || ''),
    name: String(serverTable.name || ''),
    isActive: Boolean(serverTable.isActive ?? true),
    currentOrderId: serverTable.currentOrderId ? String(serverTable.currentOrderId) : null,
    lockOwnerDeviceId: serverTable.lockOwnerDeviceId ? String(serverTable.lockOwnerDeviceId) : null,
    lockExpiresAt: serverTable.lockExpiresAt ? toDate(serverTable.lockExpiresAt) : null,
    version: Number(serverTable.version || 1),
  };
}

export function mapSettings(serverSettings: Record<string, unknown>): RestaurantSettings {
  return {
    name: String(serverSettings.name || ''),
    phone: String(serverSettings.phone || ''),
    address: String(serverSettings.address || ''),
    logo: serverSettings.logo ? String(serverSettings.logo) : undefined,
    gstEnabled: true,
    gstin: String(serverSettings.gstin || ''),
    defaultTaxRate: Number(serverSettings.defaultTaxRate || 5),
    showTaxBreakdown: Boolean(serverSettings.showTaxBreakdown ?? true),
    cashierDiscountLimit: Number(serverSettings.cashierDiscountLimit || 10),
    requireCancelReason: Boolean(serverSettings.requireCancelReason ?? true),
    closingTime: serverSettings.closingTime ? String(serverSettings.closingTime) : undefined,
  };
}

export function mapOrder(
  serverOrder: Record<string, unknown>,
  menuItems: MenuItem[],
  allTables: Table[]
): Order {
  const table = serverOrder.table && typeof serverOrder.table === 'object'
    ? mapTable(serverOrder.table as Record<string, unknown>)
    : allTables.find((entry) => entry.id === String(serverOrder.tableId || ''));

  const linesArray = Array.isArray(serverOrder.lines) ? serverOrder.lines : [];
  const lines: OrderLine[] = linesArray.map((line) => {
    const lineRecord = line as Record<string, unknown>;
    const menuItemId = String(lineRecord.menuItemId || '');
    const fallbackItem: MenuItem = {
      id: menuItemId,
      categoryId: '',
      name: String(lineRecord.menuItemName || 'Item'),
      basePrice: Number(lineRecord.unitPrice || 0),
      taxRatePercent: Number(lineRecord.taxRate || 0),
      isVeg: Boolean(lineRecord.isVeg ?? true),
      isActive: true,
    };
    const resolvedItem = menuItems.find((item) => item.id === menuItemId) || fallbackItem;
    return {
      id: String(lineRecord.id),
      orderId: String(lineRecord.orderId || serverOrder.id || ''),
      menuItemId,
      menuItem: resolvedItem,
      qty: Number(lineRecord.qty || 0),
      unitPrice: Number(lineRecord.unitPrice || 0),
      lineTotal: Number(lineRecord.lineTotal || 0),
      taxRatePercent: Number(lineRecord.taxRate || lineRecord.taxRatePercent || 0),
      notes: lineRecord.notes ? String(lineRecord.notes) : undefined,
      version: Number(lineRecord.version || 1),
      kotSent: Boolean(lineRecord.kotSent),
    };
  });

  return {
    id: String(serverOrder.id),
    orderNumber: String(serverOrder.orderNumber || ''),
    orderType: (serverOrder.orderType as Order['orderType']) || 'takeaway',
    tableId: serverOrder.tableId ? String(serverOrder.tableId) : undefined,
    table,
    status: (serverOrder.status as Order['status']) || 'open',
    lines,
    subtotal: Number(serverOrder.subtotal || 0),
    discountType: serverOrder.discountType ? (serverOrder.discountType as Order['discountType']) : undefined,
    discountValue: serverOrder.discountValue ? Number(serverOrder.discountValue) : undefined,
    discountReason: serverOrder.discountReason ? String(serverOrder.discountReason) : undefined,
    taxTotal: Number(serverOrder.taxTotal || 0),
    grandTotal: Number(serverOrder.grandTotal || 0),
    paymentStatus: (serverOrder.paymentStatus as Order['paymentStatus']) || 'pending',
    paymentMethod: serverOrder.paymentMethod ? (serverOrder.paymentMethod as Order['paymentMethod']) : undefined,
    cancelReason: serverOrder.cancelReason ? String(serverOrder.cancelReason) : undefined,
    cancelledAt: serverOrder.cancelledAt ? toDate(serverOrder.cancelledAt) : undefined,
    ownerUserId: serverOrder.ownerUserId ? String(serverOrder.ownerUserId) : undefined,
    version: Number(serverOrder.version || 1),
    updatedAt: serverOrder.updatedAt ? toDate(serverOrder.updatedAt) : undefined,
    createdBy: String(serverOrder.createdBy || ''),
    createdAt: toDate(serverOrder.createdAt),
    closedAt: serverOrder.closedAt ? toDate(serverOrder.closedAt) : undefined,
  };
}
