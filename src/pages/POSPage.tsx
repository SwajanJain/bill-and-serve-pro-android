import React, { useMemo, useState } from 'react';
import { ShoppingBag, UtensilsCrossed, ShoppingCart, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MenuPanel } from '@/components/pos/MenuPanel';
import { OrderPanel } from '@/components/pos/OrderPanel';
import { TableSelector } from '@/components/pos/TableSelector';
import { usePOS } from '@/contexts/POSContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { L } from '@/lib/labels';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useBackHandler } from '@/hooks/use-back-handler';

type MobileView = 'menu' | 'cart';

export default function POSPage() {
  const { currentOrder, startNewOrder, selectTable, tableOrderMap, activeOrders } = usePOS();
  const { areas, tables } = useSettings();
  const { user } = useAuth();
  const [showTableSelector, setShowTableSelector] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('menu');
  const [orderType, setOrderType] = useState<'dine-in' | 'takeaway'>('takeaway');

  // Back button handlers
  useBackHandler('pos-table-selector', showTableSelector, () => setShowTableSelector(false), 90);
  useBackHandler('pos-mobile-cart', mobileView === 'cart', () => setMobileView('menu'), 50);

  const handleStartOrder = () => {
    if (orderType === 'dine-in') {
      setShowTableSelector(true);
    } else {
      startNewOrder('takeaway');
    }
  };

  const handleTableSelect = (tableId: string) => {
    selectTable(tableId);
    setShowTableSelector(false);
  };

  const activeDineInTableCount = useMemo(
    () => activeOrders.filter((order) => order.orderType === 'dine-in' && order.status === 'open').length,
    [activeOrders]
  );

  const getTableSummary = (tableId: string) => {
    const orderId = tableOrderMap.get(tableId);
    if (!orderId) return null;
    const order = activeOrders.find((item) => item.id === orderId);
    if (!order) return null;
    const itemCount = order.lines.reduce((sum, line) => sum + line.qty, 0);
    return {
      orderNumber: order.orderNumber,
      total: order.grandTotal,
      itemCount,
    };
  };

  const tableSelectorDialog = (
    <Dialog open={showTableSelector} onOpenChange={setShowTableSelector}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{L.tables}</DialogTitle>
        </DialogHeader>
        <TableSelector onTableSelect={handleTableSelect} />
      </DialogContent>
    </Dialog>
  );

  const cartItemCount = currentOrder?.lines.reduce((sum, line) => sum + line.qty, 0) || 0;

  // If no order, show order type toggle + start button (NOT a blocker)
  if (!currentOrder) {
    return (
      <div className="flex flex-col h-full">
        {/* Order type toggle bar */}
        <div className="p-3 border-b border-border bg-card">
          <div className="flex gap-2">
            <Button
              variant={orderType === 'takeaway' ? 'default' : 'outline'}
              className="flex-1 h-12 gap-2"
              onClick={() => setOrderType('takeaway')}
            >
              <ShoppingBag className="h-5 w-5" />
              {L.takeaway}
            </Button>
            <Button
              variant={orderType === 'dine-in' ? 'default' : 'outline'}
              className="flex-1 h-12 gap-2"
              onClick={() => setOrderType('dine-in')}
            >
              <UtensilsCrossed className="h-5 w-5" />
              {L.dineIn}
            </Button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-3">
            <Button
              size="lg"
              className="h-16 px-8 text-lg gap-3"
              onClick={handleStartOrder}
            >
              <ShoppingCart className="h-6 w-6" />
              {L.newOrder}
            </Button>
            {activeDineInTableCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {activeDineInTableCount} {L.activeTableOrdersRunning}
              </p>
            )}
          </div>
        </div>

        {tableSelectorDialog}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col md:flex-row">
      {/* Desktop Layout */}
      <div className="hidden md:flex flex-1 h-full">
        <div className="w-80 border-r border-border bg-card flex flex-col">
          <div className="p-4 border-b border-border space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">{L.loggedInAs}</p>
              <p className="font-semibold truncate">{user?.name || 'Waiter'}</p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setShowTableSelector(true)}>
              {L.switchOpenTable}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {areas.map((area) => {
              const areaTables = tables.filter((table) => table.areaId === area.id && table.isActive);
              if (areaTables.length === 0) return null;

              return (
                <div key={area.id} className="space-y-2">
                  <h3 className="text-xs uppercase tracking-wide text-muted-foreground">{area.name}</h3>
                  <div className="space-y-2">
                    {areaTables.map((table) => {
                      const summary = getTableSummary(table.id);
                      const isActive = currentOrder.tableId === table.id;
                      return (
                        <button
                          key={table.id}
                          onClick={() => handleTableSelect(table.id)}
                          className={`w-full rounded-lg border p-3 text-left transition-colors ${
                            isActive
                              ? 'border-primary bg-primary/10'
                              : summary
                                ? 'border-warning/30 bg-warning/5 hover:bg-warning/10'
                                : 'border-border hover:bg-secondary/40'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{table.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {summary ? L.occupied : L.available}
                            </span>
                          </div>
                          {summary && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {summary.orderNumber} • {summary.itemCount} items • ₹{summary.total.toFixed(0)}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <MenuPanel />
        </div>
        <div className="w-80 lg:w-96 shrink-0">
          <OrderPanel />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="flex md:hidden flex-col h-full">
        {/* Order context bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-medium">
            {currentOrder.orderType === 'dine-in' ? (
              <>
                <UtensilsCrossed className="h-4 w-4 text-primary" />
                <span>{currentOrder.table?.name || L.dineIn}</span>
              </>
            ) : (
              <>
                <ShoppingBag className="h-4 w-4 text-primary" />
                <span>{L.takeaway}</span>
              </>
            )}
            <span className="text-muted-foreground">{'\u2022'} {currentOrder.orderNumber}</span>
          </div>
          {currentOrder.orderType === 'dine-in' && (
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setShowTableSelector(true)}>
              {L.switchTable}
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          {mobileView === 'menu' ? <MenuPanel /> : <OrderPanel />}
        </div>

        {/* Mobile bottom nav */}
        <div className="border-t border-border bg-card safe-area-bottom">
          <div className="flex">
            <button
              onClick={() => setMobileView('menu')}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
                mobileView === 'menu'
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground'
              }`}
            >
              <ChefHat className="h-5 w-5" />
              <span className="text-xs font-medium">{L.menu}</span>
            </button>
            <button
              onClick={() => setMobileView('cart')}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors relative ${
                mobileView === 'cart'
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground'
              }`}
            >
              <div className="relative">
                <ShoppingCart className="h-5 w-5" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">
                Cart {currentOrder.grandTotal > 0 && `(\u20B9${currentOrder.grandTotal.toFixed(0)})`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Phase 4.2: Full-width floating cart bar on mobile */}
      {mobileView === 'menu' && cartItemCount > 0 && (
        <button
          onClick={() => setMobileView('cart')}
          className="md:hidden fixed left-3 right-3 bg-primary text-primary-foreground rounded-xl px-4 py-3.5 shadow-lg flex items-center justify-between z-50 animate-in slide-in-from-bottom-4"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        >
          <span className="font-semibold">
            {cartItemCount} {L.items} | ₹{currentOrder.grandTotal.toFixed(0)}
          </span>
          <span className="font-semibold">{L.viewCart} &gt;</span>
        </button>
      )}
      {tableSelectorDialog}
    </div>
  );
}
