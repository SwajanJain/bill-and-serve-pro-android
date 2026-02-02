import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { Order, OrderLine, OrderType, MenuItem, PaymentMethod, DiscountType, Category, DailySummary } from '@/types';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import { storage } from '@/lib/storage';
import { mockCategories, mockMenuItems } from '@/data/mockData';

interface POSContextType {
  currentOrder: Order | null;
  menuItems: MenuItem[];
  categories: Category[];
  activeOrders: Order[];
  completedOrders: Order[];
  dailySummaries: DailySummary[];
  isLoading: boolean;
  // Derived table occupancy map: tableId -> orderId
  tableOrderMap: Map<string, string>;

  // Actions
  startNewOrder: (type: OrderType, tableId?: string) => void;
  addItemToOrder: (item: MenuItem, qty?: number, notes?: string) => void;
  updateLineQty: (lineId: string, qty: number) => void;
  removeLineFromOrder: (lineId: string) => void;
  applyDiscount: (type: DiscountType, value: number, reason: string) => void;
  removeDiscount: () => void;
  processPayment: (method: PaymentMethod, amount: number, reference?: string) => void;
  closeOrder: () => void;
  cancelOrder: (reason: string) => void;
  clearCurrentOrder: () => void;
  loadOrder: (orderId: string) => void;

  // Table actions
  selectTable: (tableId: string) => void;
  freeTable: (tableId: string) => void;

  // Menu management
  addMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => void;
  deleteMenuItem: (id: string) => void;
  addCategory: (category: Omit<Category, 'id'> & { id?: string }) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  refreshData: () => void;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

const generateId = () => Math.random().toString(36).substring(2, 15);

const initialCategories: Category[] = mockCategories;
const initialMenuItems: MenuItem[] = mockMenuItems;

export function POSProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { tables, settings } = useSettings();
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orderCounter, setOrderCounter] = useState(1);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);

  // Derive table occupancy from active orders (Phase 1.1)
  const tableOrderMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const order of activeOrders) {
      if (order.tableId && order.status !== 'cancelled' && order.status !== 'paid') {
        map.set(order.tableId, order.id);
      }
    }
    return map;
  }, [activeOrders]);

  // Helper: parse dates on order objects from storage
  const hydrateOrderDates = (order: Order): Order => {
    try {
      return {
        ...order,
        createdAt: new Date(order.createdAt),
        closedAt: order.closedAt ? new Date(order.closedAt) : undefined,
        cancelledAt: order.cancelledAt ? new Date(order.cancelledAt) : undefined,
      };
    } catch {
      return order;
    }
  };

  // Helper: get YYYY-MM-DD string for a date
  const toDateKey = (d: Date): string => {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };

  // Day-rollover: archive yesterday's completed orders into daily summaries
  const archiveOldOrders = (orders: Order[], summaries: DailySummary[]): { todayOrders: Order[]; updatedSummaries: DailySummary[] } => {
    const todayKey = toDateKey(new Date());
    const todayOrders: Order[] = [];
    const olderOrders: Order[] = [];

    for (const order of orders) {
      const orderKey = toDateKey(new Date(order.createdAt));
      if (orderKey === todayKey) {
        todayOrders.push(order);
      } else {
        olderOrders.push(order);
      }
    }

    if (olderOrders.length === 0) return { todayOrders: orders, updatedSummaries: summaries };

    // Group older orders by date
    const byDate = new Map<string, Order[]>();
    for (const order of olderOrders) {
      const key = toDateKey(new Date(order.createdAt));
      const group = byDate.get(key) || [];
      group.push(order);
      byDate.set(key, group);
    }

    // Merge into summaries
    const summaryMap = new Map<string, DailySummary>();
    for (const s of summaries) {
      summaryMap.set(s.date, s);
    }

    for (const [date, orders] of byDate.entries()) {
      const existing = summaryMap.get(date);
      const paidOrders = orders.filter(o => o.status === 'paid');
      const cashTotal = paidOrders.filter(o => o.paymentMethod === 'cash').reduce((s, o) => s + o.grandTotal, 0);
      const upiTotal = paidOrders.filter(o => o.paymentMethod === 'upi').reduce((s, o) => s + o.grandTotal, 0);

      summaryMap.set(date, {
        date,
        cashTotal: (existing?.cashTotal || 0) + cashTotal,
        upiTotal: (existing?.upiTotal || 0) + upiTotal,
        orderCount: (existing?.orderCount || 0) + paidOrders.length,
        grandTotal: (existing?.grandTotal || 0) + cashTotal + upiTotal,
      });
    }

    // Keep only last 30 days of summaries
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffKey = toDateKey(cutoff);
    const updatedSummaries = Array.from(summaryMap.values())
      .filter(s => s.date >= cutoffKey)
      .sort((a, b) => b.date.localeCompare(a.date));

    return { todayOrders, updatedSummaries };
  };

  // Load data from storage on mount
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const [
          storedMenuItems,
          storedCategories,
          storedActiveOrders,
          storedOrderCounter,
          storedCompletedOrders,
          storedDailySummaries,
        ] = await Promise.all([
          storage.getMenuItems<MenuItem[]>(),
          storage.getCategories<Category[]>(),
          storage.getActiveOrdersSafe(),
          storage.getOrderCounter(),
          storage.getCompletedOrders(),
          storage.getDailySummaries(),
        ]);

        if (storedMenuItems && storedMenuItems.length > 0) {
          setMenuItems(storedMenuItems);
        }
        if (storedCategories && storedCategories.length > 0) {
          setCategories(storedCategories);
        }
        if (storedActiveOrders && storedActiveOrders.length > 0) {
          setActiveOrders(storedActiveOrders.map(hydrateOrderDates));
        }
        // Phase 1.3: Fix orderCounter NaN/string
        if (storedOrderCounter !== null) {
          const parsed = Number(storedOrderCounter);
          setOrderCounter(Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1);
        }

        // Load completed orders and run day-rollover archiving
        const hydrated = storedCompletedOrders.map(hydrateOrderDates);
        const { todayOrders, updatedSummaries } = archiveOldOrders(hydrated, storedDailySummaries);
        setCompletedOrders(todayOrders);
        setDailySummaries(updatedSummaries);

        // Persist archived results if anything changed
        if (hydrated.length !== todayOrders.length) {
          storage.saveCompletedOrders(todayOrders);
          storage.saveDailySummaries(updatedSummaries);
        }
      } catch (error) {
        console.error('Error loading stored POS data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredData();
  }, []);

  // Persist effects
  useEffect(() => {
    if (!isLoading) {
      storage.saveMenuItems(menuItems);
    }
  }, [menuItems, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      storage.saveCategories(categories);
    }
  }, [categories, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      storage.saveActiveOrders(activeOrders);
    }
  }, [activeOrders, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      storage.saveOrderCounter(orderCounter);
    }
  }, [orderCounter, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      storage.saveCompletedOrders(completedOrders);
    }
  }, [completedOrders, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      storage.saveDailySummaries(dailySummaries);
    }
  }, [dailySummaries, isLoading]);

  // Phase 1.2 + 3.8: Use line.taxRatePercent, guard NaN
  const calculateOrderTotals = useCallback((order: Order): Order => {
    const subtotal = order.lines.reduce((sum, line) => {
      const val = Number.isFinite(line.lineTotal) ? line.lineTotal : 0;
      return sum + val;
    }, 0);

    let discountAmount = 0;
    if (order.discountType && order.discountValue) {
      if (order.discountType === 'percentage') {
        const pct = Math.min(100, Math.max(0, order.discountValue));
        discountAmount = (subtotal * pct) / 100;
      } else {
        discountAmount = Math.min(subtotal, Math.max(0, order.discountValue));
      }
    }
    discountAmount = Math.min(discountAmount, subtotal);

    const afterDiscount = subtotal - discountAmount;

    // Skip tax calculation when GST is disabled
    const gstEnabled = settings.gstEnabled;
    const taxTotal = gstEnabled
      ? order.lines.reduce((sum, line) => {
          const taxRate = Number.isFinite(line.taxRatePercent) ? line.taxRatePercent : 0;
          const lineVal = Number.isFinite(line.lineTotal) ? line.lineTotal : 0;
          const lineAfterDiscount = subtotal > 0 ? lineVal * (afterDiscount / subtotal) : 0;
          return sum + (lineAfterDiscount * taxRate / 100);
        }, 0)
      : 0;

    const grandTotal = Math.max(0, Math.round(afterDiscount + taxTotal));

    return {
      ...order,
      subtotal: Number.isFinite(subtotal) ? subtotal : 0,
      taxTotal: Number.isFinite(taxTotal) ? taxTotal : 0,
      grandTotal: Number.isFinite(grandTotal) ? grandTotal : 0,
    };
  }, [settings.gstEnabled]);

  const startNewOrder = useCallback((type: OrderType, tableId?: string) => {
    const table = tableId ? tables.find(t => t.id === tableId) : undefined;
    const orderNumber = `ORD-${String(orderCounter).padStart(4, '0')}`;
    setOrderCounter(prev => prev + 1);

    const newOrder: Order = {
      id: generateId(),
      orderNumber,
      orderType: type,
      tableId,
      table,
      status: 'open',
      lines: [],
      subtotal: 0,
      taxTotal: 0,
      grandTotal: 0,
      paymentStatus: 'pending',
      createdBy: user?.id || '',
      createdAt: new Date(),
    };

    setCurrentOrder(newOrder);
    setActiveOrders(prev => [...prev, newOrder]);
  }, [tables, user, orderCounter]);

  const loadOrder = useCallback((orderId: string) => {
    const order = activeOrders.find(o => o.id === orderId);
    if (order) {
      setCurrentOrder(order);
    }
  }, [activeOrders]);

  // Phase 1.2: Freeze taxRatePercent at order time
  // Fix: Increment existing line qty for same item instead of creating duplicates
  const addItemToOrder = useCallback((item: MenuItem, qty = 1, notes?: string) => {
    if (!currentOrder) return;

    let updatedLines: OrderLine[];
    const existingLine = !notes ? currentOrder.lines.find(l => l.menuItemId === item.id && !l.notes) : undefined;

    if (existingLine) {
      const newQty = existingLine.qty + qty;
      updatedLines = currentOrder.lines.map(l =>
        l.id === existingLine.id
          ? { ...l, qty: newQty, lineTotal: l.unitPrice * newQty }
          : l
      );
    } else {
      const newLine: OrderLine = {
        id: generateId(),
        orderId: currentOrder.id,
        menuItemId: item.id,
        menuItem: item,
        qty,
        unitPrice: item.basePrice,
        lineTotal: item.basePrice * qty,
        taxRatePercent: item.taxRatePercent,
        notes,
      };
      updatedLines = [...currentOrder.lines, newLine];
    }

    const updatedOrder = calculateOrderTotals({
      ...currentOrder,
      lines: updatedLines,
    });

    setCurrentOrder(updatedOrder);
    setActiveOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
  }, [currentOrder, calculateOrderTotals]);

  // Phase 3.7: Clamp min qty to 1 (removal only via explicit trash)
  const updateLineQty = useCallback((lineId: string, qty: number) => {
    if (!currentOrder || qty < 1) return;

    const updatedLines = currentOrder.lines.map(l => {
      if (l.id === lineId) {
        return { ...l, qty, lineTotal: l.unitPrice * qty };
      }
      return l;
    });

    const updatedOrder = calculateOrderTotals({
      ...currentOrder,
      lines: updatedLines,
    });

    setCurrentOrder(updatedOrder);
    setActiveOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
  }, [currentOrder, calculateOrderTotals]);

  const removeLineFromOrder = useCallback((lineId: string) => {
    if (!currentOrder) return;
    const updatedLines = currentOrder.lines.filter(l => l.id !== lineId);
    const updatedOrder = calculateOrderTotals({
      ...currentOrder,
      lines: updatedLines,
    });
    setCurrentOrder(updatedOrder);
    setActiveOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
  }, [currentOrder, calculateOrderTotals]);

  const applyDiscount = useCallback((type: DiscountType, value: number, reason: string) => {
    if (!currentOrder) return;

    const updatedOrder = calculateOrderTotals({
      ...currentOrder,
      discountType: type,
      discountValue: value,
      discountReason: reason,
    });

    setCurrentOrder(updatedOrder);
    setActiveOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
  }, [currentOrder, calculateOrderTotals]);

  const removeDiscount = useCallback(() => {
    if (!currentOrder) return;

    const updatedOrder = calculateOrderTotals({
      ...currentOrder,
      discountType: undefined,
      discountValue: undefined,
      discountReason: undefined,
    });

    setCurrentOrder(updatedOrder);
    setActiveOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
  }, [currentOrder, calculateOrderTotals]);

  // Phase 1.7 + 3.1: Store payment method, guard double-tap
  const processPayment = useCallback((method: PaymentMethod, amount: number, reference?: string) => {
    if (!currentOrder) return;
    if (currentOrder.status === 'paid') return; // Phase 3.1: idempotency

    const updatedOrder: Order = {
      ...currentOrder,
      status: 'paid',
      paymentStatus: 'paid',
      paymentMethod: method,
      closedAt: new Date(),
    };

    setCurrentOrder(updatedOrder);
    setActiveOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
  }, [currentOrder]);

  const closeOrder = useCallback(() => {
    if (!currentOrder) return;
    // Move paid order to completedOrders for history, then remove from activeOrders
    if (currentOrder.status === 'paid') {
      setCompletedOrders(prev => [...prev, currentOrder]);
    }
    setActiveOrders(prev => prev.filter(o => o.id !== currentOrder.id));
    setCurrentOrder(null);
  }, [currentOrder]);

  // Phase 3.4: Cancel paid order keeps audit trail
  const cancelOrder = useCallback((reason: string) => {
    if (!currentOrder) return;

    if (currentOrder.status === 'paid') {
      // Keep paid order with cancelled status for audit trail
      const cancelledOrder: Order = {
        ...currentOrder,
        status: 'cancelled',
        cancelReason: reason,
        cancelledAt: new Date(),
      };
      setActiveOrders(prev => prev.map(o => o.id === cancelledOrder.id ? cancelledOrder : o));
      setCurrentOrder(null);
    } else {
      // Remove unpaid draft orders
      setActiveOrders(prev => prev.filter(o => o.id !== currentOrder.id));
      setCurrentOrder(null);
    }
  }, [currentOrder]);

  const clearCurrentOrder = useCallback(() => {
    setCurrentOrder(null);
  }, []);

  const selectTable = useCallback((tableId: string) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    const existingOrderId = tableOrderMap.get(tableId);
    if (existingOrderId) {
      loadOrder(existingOrderId);
    } else {
      startNewOrder('dine-in', tableId);
    }
  }, [tables, tableOrderMap, loadOrder, startNewOrder]);

  // Free a table by cancelling its associated unpaid order
  const freeTable = useCallback((tableId: string) => {
    const orderId = tableOrderMap.get(tableId);
    if (!orderId) return;

    // Remove the unpaid order from activeOrders
    setActiveOrders(prev => prev.filter(o => o.id !== orderId));
    // If the freed order was the current order, clear it
    if (currentOrder?.id === orderId) {
      setCurrentOrder(null);
    }
  }, [tableOrderMap, currentOrder]);

  // Menu Management
  const addMenuItem = useCallback((item: Omit<MenuItem, 'id'>) => {
    const newItem: MenuItem = {
      ...item,
      id: generateId(),
    };
    setMenuItems(prev => [...prev, newItem]);
  }, []);

  const updateMenuItem = useCallback((id: string, updates: Partial<MenuItem>) => {
    setMenuItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  const deleteMenuItem = useCallback((id: string) => {
    setMenuItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const addCategory = useCallback((category: Omit<Category, 'id'> & { id?: string }) => {
    const newCat: Category = {
      ...category,
      id: category.id || generateId(),
    };
    setCategories(prev => [...prev, newCat]);
  }, []);

  const updateCategory = useCallback((id: string, updates: Partial<Category>) => {
    setCategories(prev => prev.map(cat =>
      cat.id === id ? { ...cat, ...updates } : cat
    ));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(cat => cat.id !== id));
  }, []);

  const refreshData = useCallback(() => {}, []);

  return (
    <POSContext.Provider value={{
      currentOrder,
      menuItems,
      categories,
      activeOrders,
      completedOrders,
      dailySummaries,
      isLoading,
      tableOrderMap,
      startNewOrder,
      addItemToOrder,
      updateLineQty,
      removeLineFromOrder,
      applyDiscount,
      removeDiscount,
      processPayment,
      closeOrder,
      cancelOrder,
      clearCurrentOrder,
      loadOrder,
      selectTable,
      freeTable,
      addMenuItem,
      updateMenuItem,
      deleteMenuItem,
      addCategory,
      updateCategory,
      deleteCategory,
      refreshData,
    }}>
      {children}
    </POSContext.Provider>
  );
}

export function usePOS() {
  const context = useContext(POSContext);
  if (context === undefined) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
}
