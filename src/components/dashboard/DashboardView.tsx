import React from 'react';
import { Banknote, Smartphone, ShoppingBag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { usePOS } from '@/contexts/POSContext';
import { L } from '@/lib/labels';

export function DashboardView() {
  const { completedOrders } = usePOS();

  // completedOrders contains today's paid orders (older ones archived to dailySummaries)
  const paidOrders = completedOrders.filter(o => {
    if (o.status === 'cancelled') return false;
    const today = new Date();
    const orderDate = new Date(o.createdAt);
    return o.status === 'paid' && orderDate.toDateString() === today.toDateString();
  });

  const cashTotal = paidOrders
    .filter(o => o.paymentMethod === 'cash')
    .reduce((sum, o) => sum + o.grandTotal, 0);

  const upiTotal = paidOrders
    .filter(o => o.paymentMethod === 'upi')
    .reduce((sum, o) => sum + o.grandTotal, 0);

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
      title: L.orderCount,
      value: paidOrders.length.toString(),
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          {paidOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{L.noOrdersYet}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paidOrders.slice(-5).reverse().map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                  <div>
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.orderType === 'dine-in' ? `Table ${order.table?.name}` : L.takeaway}
                      {' \u2022 '}{order.lines.length} items
                      {' \u2022 '}{order.paymentMethod === 'cash' ? L.cash : L.upi}
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
