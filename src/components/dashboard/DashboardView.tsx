import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CreditCard, Loader2, Smartphone, ShoppingBag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { usePOS } from '@/contexts/POSContext';
import { useSettings } from '@/contexts/SettingsContext';
import { L } from '@/lib/labels';
import { apiRequest } from '@/lib/api/client';

export function DashboardView() {
  const { completedOrders } = usePOS();
  const { tables } = useSettings();
  const [isLoading, setIsLoading] = useState(true);
  const [remoteStats, setRemoteStats] = useState<{
    cash: number;
    upi: number;
    card: number;
    orderCount: number;
  } | null>(null);
  const [remoteRecent, setRemoteRecent] = useState<Array<{
    id: string;
    orderNumber: string;
    orderType: 'dine-in' | 'takeaway';
    tableName?: string | null;
    lineCount: number;
    paymentMethod: 'cash' | 'upi' | 'card';
    grandTotal: number;
  }>>([]);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const now = new Date();
        const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const [dashboard, todayOrders] = await Promise.all([
          apiRequest<{
            revenue: { cash: number; upi: number; card: number };
            orders: { paid: number };
          }>('/api/reports/dashboard'),
          apiRequest<Array<Record<string, unknown>>>(`/api/orders?date=${date}&limit=50`),
        ]);

        const paidRecent = todayOrders
          .filter((order) => order.status === 'paid')
          .slice(0, 10)
          .map((order) => ({
            id: String(order.id),
            orderNumber: String(order.orderNumber || ''),
            orderType: (order.orderType as 'dine-in' | 'takeaway') || 'takeaway',
            tableName: order.tableId
              ? tables.find((table) => table.id === String(order.tableId))?.name || String(order.tableId)
              : null,
            lineCount: Array.isArray(order.lines) ? order.lines.length : Number(order.linesCount || 0),
            paymentMethod: (order.paymentMethod as 'cash' | 'upi' | 'card') || 'cash',
            grandTotal: Number(order.grandTotal || 0),
          }));

        setRemoteStats({
          cash: Number(dashboard.revenue.cash || 0),
          upi: Number(dashboard.revenue.upi || 0),
          card: Number(dashboard.revenue.card || 0),
          orderCount: Number(dashboard.orders.paid || 0),
        });
        setRemoteRecent(paidRecent);
      } catch {
        setRemoteStats(null);
        setRemoteRecent([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, [tables]);

  // completedOrders contains today's paid orders (older ones archived to dailySummaries)
  const fallbackPaidOrders = useMemo(() => completedOrders.filter(o => {
    if (o.status === 'cancelled') return false;
    const today = new Date();
    const orderDate = new Date(o.createdAt);
    return o.status === 'paid' && orderDate.toDateString() === today.toDateString();
  }), [completedOrders]);

  const fallbackCashTotal = fallbackPaidOrders
    .filter(o => o.paymentMethod === 'cash')
    .reduce((sum, o) => sum + o.grandTotal, 0);

  const fallbackUpiTotal = fallbackPaidOrders
    .filter(o => o.paymentMethod === 'upi')
    .reduce((sum, o) => sum + o.grandTotal, 0);

  const fallbackCardTotal = fallbackPaidOrders
    .filter(o => o.paymentMethod === 'card')
    .reduce((sum, o) => sum + o.grandTotal, 0);

  const paidOrderCount = remoteStats?.orderCount ?? fallbackPaidOrders.length;
  const cashTotal = remoteStats?.cash ?? fallbackCashTotal;
  const upiTotal = remoteStats?.upi ?? fallbackUpiTotal;
  const cardTotal = remoteStats?.card ?? fallbackCardTotal;

  const statCards = [
    {
      title: L.cashTotal,
      value: `\u20B9${Math.round(cashTotal).toLocaleString()}`,
      icon: Banknote,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: L.upiTotal,
      value: `\u20B9${Math.round(upiTotal).toLocaleString()}`,
      icon: Smartphone,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      title: 'Card Total',
      value: `\u20B9${Math.round(cardTotal).toLocaleString()}`,
      icon: CreditCard,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: L.orderCount,
      value: paidOrderCount.toString(),
      icon: ShoppingBag,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
  ];

  return (
    <div className="p-3 sm:p-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">{L.todaysSummary}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-xl sm:text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent orders */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin" />
              <p>Loading summary...</p>
            </div>
          ) : (remoteRecent.length === 0 && fallbackPaidOrders.length === 0) ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{L.noOrdersYet}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(remoteRecent.length > 0
                ? remoteRecent
                : fallbackPaidOrders.slice(-5).reverse().map(order => ({
                    id: order.id,
                    orderNumber: order.orderNumber,
                    orderType: order.orderType,
                    tableName: order.table?.name || null,
                    lineCount: order.lines.length,
                    paymentMethod: (order.paymentMethod || 'cash') as 'cash' | 'upi' | 'card',
                    grandTotal: order.grandTotal,
                  }))).map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                  <div>
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.orderType === 'dine-in' ? `Table ${order.tableName || '-'}` : L.takeaway}
                      {' \u2022 '}{order.lineCount} items
                      {' \u2022 '}{order.paymentMethod === 'cash' ? L.cash : order.paymentMethod === 'upi' ? L.upi : 'Card'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{'\u20B9'}{order.grandTotal.toFixed(0)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
