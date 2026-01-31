import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/index.js';
import { orders, orderLines, payments, menuItems, kots } from '../db/schema.js';
import { eq, gte, lte, and, sql, desc } from 'drizzle-orm';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export default async function reportsRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all routes
  fastify.addHook('preHandler', authMiddleware);
  fastify.addHook('preHandler', requireRole('owner', 'manager'));

  // Dashboard stats
  fastify.get('/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    // Today's orders
    const todayOrders = db
      .select()
      .from(orders)
      .where(and(
        gte(orders.createdAt, todayStart),
        lte(orders.createdAt, todayEnd)
      ))
      .all();

    const totalOrders = todayOrders.length;
    const paidOrders = todayOrders.filter(o => o.status === 'paid');
    const cancelledOrders = todayOrders.filter(o => o.status === 'cancelled');
    const openOrders = todayOrders.filter(o => o.status === 'open' || o.status === 'billed');

    // Today's revenue
    const todayRevenue = paidOrders.reduce((sum, o) => sum + o.grandTotal, 0);

    // Today's payments
    const todayPayments = db
      .select()
      .from(payments)
      .where(and(
        gte(payments.receivedAt, todayStart),
        lte(payments.receivedAt, todayEnd)
      ))
      .all();

    const cashTotal = todayPayments.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
    const upiTotal = todayPayments.filter(p => p.method === 'upi').reduce((s, p) => s + p.amount, 0);
    const cardTotal = todayPayments.filter(p => p.method === 'card').reduce((s, p) => s + p.amount, 0);

    // Active KOTs
    const activeKots = db
      .select()
      .from(kots)
      .where(sql`${kots.status} != 'ready'`)
      .all();

    // Average order value
    const avgOrderValue = paidOrders.length > 0
      ? todayRevenue / paidOrders.length
      : 0;

    return {
      today: format(today, 'yyyy-MM-dd'),
      orders: {
        total: totalOrders,
        paid: paidOrders.length,
        cancelled: cancelledOrders.length,
        open: openOrders.length,
      },
      revenue: {
        total: Math.round(todayRevenue * 100) / 100,
        cash: Math.round(cashTotal * 100) / 100,
        upi: Math.round(upiTotal * 100) / 100,
        card: Math.round(cardTotal * 100) / 100,
      },
      averageOrderValue: Math.round(avgOrderValue * 100) / 100,
      activeKots: activeKots.length,
    };
  });

  // Sales report
  fastify.get('/sales', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      startDate?: string;
      endDate?: string;
    };

    const start = query.startDate
      ? startOfDay(new Date(query.startDate))
      : startOfDay(subDays(new Date(), 7));
    const end = query.endDate
      ? endOfDay(new Date(query.endDate))
      : endOfDay(new Date());

    // Get all paid orders in date range
    const paidOrders = db
      .select()
      .from(orders)
      .where(and(
        eq(orders.status, 'paid'),
        gte(orders.createdAt, start),
        lte(orders.createdAt, end)
      ))
      .all();

    // Group by date
    const salesByDate: Record<string, { orders: number; revenue: number; tax: number }> = {};

    for (const order of paidOrders) {
      const dateKey = format(order.createdAt, 'yyyy-MM-dd');
      if (!salesByDate[dateKey]) {
        salesByDate[dateKey] = { orders: 0, revenue: 0, tax: 0 };
      }
      salesByDate[dateKey].orders++;
      salesByDate[dateKey].revenue += order.grandTotal;
      salesByDate[dateKey].tax += order.taxTotal;
    }

    // Get payment breakdown
    const paymentsInRange = db
      .select()
      .from(payments)
      .where(and(
        gte(payments.receivedAt, start),
        lte(payments.receivedAt, end)
      ))
      .all();

    const paymentsByMethod = {
      cash: paymentsInRange.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0),
      upi: paymentsInRange.filter(p => p.method === 'upi').reduce((s, p) => s + p.amount, 0),
      card: paymentsInRange.filter(p => p.method === 'card').reduce((s, p) => s + p.amount, 0),
    };

    // Total stats
    const totalRevenue = paidOrders.reduce((s, o) => s + o.grandTotal, 0);
    const totalTax = paidOrders.reduce((s, o) => s + o.taxTotal, 0);
    const totalOrders = paidOrders.length;

    return {
      period: {
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd'),
      },
      summary: {
        totalOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalTax: Math.round(totalTax * 100) / 100,
        averageOrderValue: totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
      },
      paymentBreakdown: {
        cash: Math.round(paymentsByMethod.cash * 100) / 100,
        upi: Math.round(paymentsByMethod.upi * 100) / 100,
        card: Math.round(paymentsByMethod.card * 100) / 100,
      },
      dailySales: Object.entries(salesByDate)
        .map(([date, data]) => ({
          date,
          orders: data.orders,
          revenue: Math.round(data.revenue * 100) / 100,
          tax: Math.round(data.tax * 100) / 100,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  });

  // Item-wise sales report
  fastify.get('/items', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      startDate?: string;
      endDate?: string;
    };

    const start = query.startDate
      ? startOfDay(new Date(query.startDate))
      : startOfDay(subDays(new Date(), 7));
    const end = query.endDate
      ? endOfDay(new Date(query.endDate))
      : endOfDay(new Date());

    // Get paid orders in date range
    const paidOrders = db
      .select()
      .from(orders)
      .where(and(
        eq(orders.status, 'paid'),
        gte(orders.createdAt, start),
        lte(orders.createdAt, end)
      ))
      .all();

    const orderIds = paidOrders.map(o => o.id);

    if (orderIds.length === 0) {
      return {
        period: {
          start: format(start, 'yyyy-MM-dd'),
          end: format(end, 'yyyy-MM-dd'),
        },
        items: [],
      };
    }

    // Get all order lines for these orders
    const lines = db
      .select()
      .from(orderLines)
      .all()
      .filter(l => orderIds.includes(l.orderId));

    // Group by menu item
    const itemSales: Record<string, { qty: number; revenue: number }> = {};

    for (const line of lines) {
      if (!itemSales[line.menuItemId]) {
        itemSales[line.menuItemId] = { qty: 0, revenue: 0 };
      }
      itemSales[line.menuItemId].qty += line.qty;
      itemSales[line.menuItemId].revenue += line.lineTotal;
    }

    // Enrich with menu item names
    const items = Object.entries(itemSales).map(([menuItemId, data]) => {
      const menuItem = db.select().from(menuItems).where(eq(menuItems.id, menuItemId)).get();
      return {
        id: menuItemId,
        name: menuItem?.name || 'Unknown',
        categoryId: menuItem?.categoryId,
        quantitySold: data.qty,
        revenue: Math.round(data.revenue * 100) / 100,
      };
    });

    // Sort by quantity sold
    items.sort((a, b) => b.quantitySold - a.quantitySold);

    return {
      period: {
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd'),
      },
      items,
    };
  });

  // Payment breakdown
  fastify.get('/payments', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      startDate?: string;
      endDate?: string;
    };

    const start = query.startDate
      ? startOfDay(new Date(query.startDate))
      : startOfDay(subDays(new Date(), 7));
    const end = query.endDate
      ? endOfDay(new Date(query.endDate))
      : endOfDay(new Date());

    const paymentsInRange = db
      .select()
      .from(payments)
      .where(and(
        gte(payments.receivedAt, start),
        lte(payments.receivedAt, end)
      ))
      .orderBy(desc(payments.receivedAt))
      .all();

    // Group by method
    const byMethod = {
      cash: { count: 0, total: 0 },
      upi: { count: 0, total: 0 },
      card: { count: 0, total: 0 },
    };

    for (const payment of paymentsInRange) {
      byMethod[payment.method as keyof typeof byMethod].count++;
      byMethod[payment.method as keyof typeof byMethod].total += payment.amount;
    }

    // Group by date
    const byDate: Record<string, { cash: number; upi: number; card: number; total: number }> = {};

    for (const payment of paymentsInRange) {
      const dateKey = format(payment.receivedAt, 'yyyy-MM-dd');
      if (!byDate[dateKey]) {
        byDate[dateKey] = { cash: 0, upi: 0, card: 0, total: 0 };
      }
      byDate[dateKey][payment.method as keyof typeof byMethod] += payment.amount;
      byDate[dateKey].total += payment.amount;
    }

    return {
      period: {
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd'),
      },
      summary: {
        totalTransactions: paymentsInRange.length,
        totalAmount: Math.round(paymentsInRange.reduce((s, p) => s + p.amount, 0) * 100) / 100,
      },
      byMethod: {
        cash: {
          count: byMethod.cash.count,
          total: Math.round(byMethod.cash.total * 100) / 100,
        },
        upi: {
          count: byMethod.upi.count,
          total: Math.round(byMethod.upi.total * 100) / 100,
        },
        card: {
          count: byMethod.card.count,
          total: Math.round(byMethod.card.total * 100) / 100,
        },
      },
      daily: Object.entries(byDate)
        .map(([date, data]) => ({
          date,
          cash: Math.round(data.cash * 100) / 100,
          upi: Math.round(data.upi * 100) / 100,
          card: Math.round(data.card * 100) / 100,
          total: Math.round(data.total * 100) / 100,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  });
}
