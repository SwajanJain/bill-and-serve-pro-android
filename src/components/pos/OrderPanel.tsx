import React, { useState } from 'react';
import { Minus, Plus, Trash2, Receipt, Percent, X, AlertTriangle, ChefHat, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePOS } from '@/contexts/POSContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Order } from '@/types';
import { PaymentDialog } from './PaymentDialog';
import { DiscountDialog } from './DiscountDialog';
import { InvoiceDialog } from './InvoiceDialog';
import { CustomerDetailsDialog, CustomerDetails } from './CustomerDetailsDialog';
import { L } from '@/lib/labels';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useToast } from '@/hooks/use-toast';
import { useBackHandler } from '@/hooks/use-back-handler';

export function OrderPanel() {
  const {
    currentOrder,
    currentOrderReadonlyReason,
    updateLineQty,
    removeLineFromOrder,
    removeDiscount,
    clearCurrentOrder,
    closeOrder,
    cancelOrder,
    sendKOT,
  } = usePOS();
  const { toast } = useToast();
  const { settings } = useSettings();

  const [showPayment, setShowPayment] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null);
  const [isSendingKOT, setIsSendingKOT] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null);

  // Back button handlers
  useBackHandler('order-cancel-confirm', showCancelConfirm, () => setShowCancelConfirm(false), 100);
  useBackHandler('order-remove-confirm', !!showRemoveConfirm, () => setShowRemoveConfirm(null), 100);
  useBackHandler('order-invoice', showInvoice, () => handleInvoiceClose(), 90);
  useBackHandler('order-payment', showPayment, () => setShowPayment(false), 90);
  useBackHandler('order-discount', showDiscount, () => setShowDiscount(false), 90);
  useBackHandler('order-customer-details', showCustomerDetails, () => handleCustomerSkip(), 90);

  const handleCustomerSubmit = (details: CustomerDetails) => {
    setCustomerDetails(details);
    setShowCustomerDetails(false);
    setShowInvoice(true);
  };

  const handleCustomerSkip = () => {
    setCustomerDetails(null);
    setShowCustomerDetails(false);
    setShowInvoice(true);
  };

  const handleInvoiceClose = async () => {
    setShowInvoice(false);
    closeOrder();
    setCompletedOrder(null);
    setCustomerDetails(null);
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (error) {
      void error;
    }
    toast({ title: L.orderComplete, description: L.orderSavedSuccess });
  };

  const handleCancelOrder = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (error) {
      void error;
    }
    cancelOrder('User cancelled');
    setShowCancelConfirm(false);
    toast({ title: L.orderCancelled });
  };

  const handleQuantityChange = async (lineId: string, newQty: number) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (error) {
      void error;
    }
    updateLineQty(lineId, newQty);
  };

  const handleRemoveLine = async (lineId: string) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (error) {
      void error;
    }
    removeLineFromOrder(lineId);
    setShowRemoveConfirm(null);
  };

  const handleSendKOT = async () => {
    setIsSendingKOT(true);
    try {
      const result = await sendKOT();
      if (result === 'sent') {
        toast({ title: L.sentToKitchen });
      } else if (result === 'queued') {
        toast({ title: L.kitchenTicketQueued });
      } else if (result === 'no-items') {
        toast({ title: L.noNewItemsToSend });
      } else if (result === 'blocked') {
        toast({ title: L.cannotSendRightNow, variant: 'destructive' });
      } else {
        toast({ title: L.failedToSendKitchen, variant: 'destructive' });
      }
    } finally {
      setIsSendingKOT(false);
    }
  };

  if (showCustomerDetails && completedOrder) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground p-8">
        <Receipt className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-center">{L.paymentComplete}</p>
        <CustomerDetailsDialog
          open={showCustomerDetails}
          onOpenChange={(open) => { if (!open) handleCustomerSkip(); }}
          onSubmit={handleCustomerSubmit}
          onSkip={handleCustomerSkip}
        />
      </div>
    );
  }

  if (showInvoice && completedOrder) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground p-8">
        <Receipt className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-center">Invoice Ready</p>
        <InvoiceDialog
          open={showInvoice}
          onOpenChange={(open) => { if (!open) handleInvoiceClose(); }}
          order={completedOrder}
          customerDetails={customerDetails}
        />
      </div>
    );
  }

  if (!currentOrder) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground p-8">
        <Receipt className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-center">{L.addItems}</p>
      </div>
    );
  }

  const discountAmount = currentOrder.discountType && currentOrder.discountValue
    ? currentOrder.discountType === 'percentage'
      ? (currentOrder.subtotal * currentOrder.discountValue / 100)
      : currentOrder.discountValue
    : 0;
  const unsentLineCount = currentOrder.lines.filter((line) => !line.kotSent).length;
  const unsentQtyCount = currentOrder.lines.reduce((sum, line) => sum + (line.kotSent ? 0 : line.qty), 0);

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-semibold">{currentOrder.orderNumber}</h2>
            <p className="text-sm text-muted-foreground">
              {currentOrder.orderType === 'dine-in'
                ? `${L.tables}: ${currentOrder.table?.name}`
                : L.takeaway}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowCancelConfirm(true)}
            className="text-muted-foreground hover:text-destructive h-11 w-11"
            disabled={!!currentOrderReadonlyReason}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Order Lines */}
      <div className="flex-1 overflow-y-auto">
        {currentOrderReadonlyReason && (
          <div className="mx-4 mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
            {currentOrderReadonlyReason}
          </div>
        )}
        {currentOrder.lines.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            {L.addItems}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {currentOrder.lines.map(line => (
              <div key={line.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`shrink-0 w-5 h-5 border-2 rounded ${line.menuItem.isVeg ? 'border-green-600' : 'border-red-600'}`}>
                        <div className={`w-2.5 h-2.5 rounded-full m-auto mt-0.5 ${line.menuItem.isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
                      </div>
                      <span className="font-medium text-base truncate">{line.menuItem.name}</span>
                    </div>
                    {line.notes && (
                      <p className="text-xs text-muted-foreground mt-1">Note: {line.notes}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-base">₹{line.lineTotal}</div>
                    <div className="text-xs text-muted-foreground">₹{line.unitPrice} x {line.qty}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center bg-secondary rounded-lg">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 rounded-l-lg rounded-r-none"
                      onClick={() => handleQuantityChange(line.id, line.qty - 1)}
                      disabled={line.qty <= 1 || !!currentOrderReadonlyReason}
                    >
                      <Minus className="h-5 w-5" />
                    </Button>
                    <span className="w-14 h-11 flex items-center justify-center text-lg font-semibold">
                      {line.qty}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 rounded-r-lg rounded-l-none"
                      onClick={() => handleQuantityChange(line.id, line.qty + 1)}
                      disabled={!!currentOrderReadonlyReason}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setShowRemoveConfirm(line.id)}
                    disabled={!!currentOrderReadonlyReason}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      {currentOrder.lines.length > 0 && (
        <div className="border-t border-border p-4 space-y-2 bg-secondary/30">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{L.subtotal}</span>
            <span>₹{currentOrder.subtotal.toFixed(2)}</span>
          </div>
          {currentOrder.discountValue && currentOrder.discountValue > 0 && (
            <div className="flex justify-between text-sm text-success">
              <span className="flex items-center gap-1">
                {L.discount}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={removeDiscount}
                  disabled={!!currentOrderReadonlyReason}
                >
                  <X className="h-4 w-4" />
                </Button>
              </span>
              <span>-₹{discountAmount.toFixed(2)}</span>
            </div>
          )}
          {settings.gstEnabled && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{L.tax}</span>
              <span>₹{currentOrder.taxTotal.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-bold pt-2 border-t border-border">
            <span>{L.total}</span>
            <span className="text-primary">₹{currentOrder.grandTotal.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-4 border-t border-border space-y-3">
        <Button
          variant="secondary"
          className="w-full gap-2 h-12 text-base"
          onClick={handleSendKOT}
          disabled={unsentLineCount === 0 || !!currentOrderReadonlyReason || isSendingKOT}
        >
          {isSendingKOT ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <ChefHat className="h-5 w-5" />
              {unsentLineCount > 0 ? `${L.sendToKitchen} (${unsentQtyCount} ${L.items})` : L.allItemsSent}
            </>
          )}
        </Button>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 gap-2 h-12 text-base"
            onClick={() => setShowDiscount(true)}
            disabled={currentOrder.lines.length === 0 || !!currentOrderReadonlyReason}
          >
            <Percent className="h-5 w-5" />
            {L.discount}
          </Button>
          <Button
            className="flex-1 gap-2 h-12 text-base"
            onClick={() => setShowPayment(true)}
            disabled={currentOrder.lines.length === 0 || !!currentOrderReadonlyReason}
          >
            <Receipt className="h-5 w-5" />
            {L.collectPayment}
          </Button>
        </div>
      </div>

      {/* Cancel Order Dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {L.cancelOrder}
            </AlertDialogTitle>
            <AlertDialogDescription>{L.cancelOrderDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="h-12">{L.keepOrder}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              className="h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!currentOrderReadonlyReason}
            >
              {L.yesCancelOrder}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove item confirmation */}
      <AlertDialog open={!!showRemoveConfirm} onOpenChange={() => setShowRemoveConfirm(null)}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{L.removeItem}</AlertDialogTitle>
            <AlertDialogDescription>{L.removeItemDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="h-12">{L.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showRemoveConfirm && handleRemoveLine(showRemoveConfirm)}
              className="h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {L.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PaymentDialog
        open={showPayment}
        onOpenChange={setShowPayment}
        onComplete={(order) => {
          setCompletedOrder(order);
          setShowCustomerDetails(true);
        }}
      />
      <DiscountDialog open={showDiscount} onOpenChange={setShowDiscount} />
    </div>
  );
}
