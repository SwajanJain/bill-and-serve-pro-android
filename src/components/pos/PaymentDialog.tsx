import React, { useState, useMemo } from 'react';
import { Banknote, Smartphone, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePOS } from '@/contexts/POSContext';
import { PaymentMethod, Order } from '@/types';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { L } from '@/lib/labels';
import { useToast } from '@/hooks/use-toast';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (completedOrder: Order) => void;
}

export function PaymentDialog({ open, onOpenChange, onComplete }: PaymentDialogProps) {
  const { currentOrder, processPayment } = usePOS();
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [reference, setReference] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!currentOrder) return null;

  const total = currentOrder.grandTotal; // Already rounded to nearest rupee in calculateOrderTotals
  const received = parseInt(receivedAmount) || 0;
  const change = received - total;

  // Phase 4.3: Smart payment buttons based on bill total
  const smartAmounts = useMemo(() => {
    const amounts: number[] = [total]; // Exact
    const roundups = [10, 50, 100, 500];
    for (const r of roundups) {
      const rounded = Math.ceil(total / r) * r;
      if (rounded > total && !amounts.includes(rounded)) {
        amounts.push(rounded);
      }
      if (amounts.length >= 4) break;
    }
    // If we don't have 4, add common notes
    const notes = [100, 200, 500, 1000, 2000];
    for (const n of notes) {
      if (n >= total && !amounts.includes(n)) {
        amounts.push(n);
      }
      if (amounts.length >= 5) break;
    }
    return amounts.slice(0, 5);
  }, [total]);

  const handlePayment = async () => {
    if (!currentOrder || isProcessing) return;
    if (currentOrder.status === 'paid') return;

    setIsProcessing(true);
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (e) {}

    const completedOrder: Order = {
      ...currentOrder,
      status: 'paid',
      paymentStatus: 'paid',
      paymentMethod: selectedMethod,
      closedAt: new Date(),
    };

    processPayment(selectedMethod, selectedMethod === 'upi' ? total : received, reference || undefined);
    onOpenChange(false);
    toast({ title: L.paymentComplete });
    onComplete(completedOrder);
    setIsProcessing(false);
    setReceivedAmount('');
    setReference('');
  };

  const handleMethodSelect = async (method: PaymentMethod) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}
    setSelectedMethod(method);
    if (method === 'upi') {
      setReceivedAmount(total.toString());
    } else {
      setReceivedAmount('');
    }
  };

  const handleQuickAmount = async (amount: number) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}
    setReceivedAmount(amount.toString());
  };

  const primaryMethods = [
    { id: 'cash' as const, label: L.cash, icon: Banknote },
    { id: 'upi' as const, label: L.upi, icon: Smartphone },
  ];

  const canComplete = selectedMethod === 'upi' || received >= total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{L.collectPayment}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Total */}
          <div className="text-center p-5 bg-secondary rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">{L.amountDue}</p>
            <p className="text-3xl sm:text-4xl font-bold text-primary">₹{total}</p>
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <Label className="text-base">{L.paymentMethod}</Label>
            <div className="grid grid-cols-2 gap-3">
              {primaryMethods.map(method => (
                <Button
                  key={method.id}
                  variant={selectedMethod === method.id ? 'default' : 'outline'}
                  className={`flex flex-col h-24 gap-2 ${
                    selectedMethod === method.id ? 'ring-2 ring-primary ring-offset-2' : ''
                  }`}
                  onClick={() => handleMethodSelect(method.id)}
                >
                  <method.icon className="h-8 w-8" />
                  <span className="text-base font-medium">{method.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Cash specific */}
          {selectedMethod === 'cash' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-base">{L.receivedAmount}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  className="text-2xl h-14 text-center font-semibold"
                />
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {smartAmounts.map((amount, i) => (
                  <Button
                    key={amount}
                    variant="secondary"
                    className="h-12 text-sm font-medium"
                    onClick={() => handleQuickAmount(amount)}
                  >
                    {i === 0 ? L.exact : `₹${amount}`}
                  </Button>
                ))}
              </div>

              {received >= total && received > 0 && (
                <div className="p-4 bg-success/10 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">{L.change}</p>
                  <p className="text-3xl font-bold text-success">₹{change}</p>
                </div>
              )}
            </div>
          )}

          {/* UPI reference */}
          {selectedMethod === 'upi' && (
            <div className="space-y-2">
              <Label className="text-base">Reference / Transaction ID (optional)</Label>
              <Input
                placeholder="Enter reference number"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="h-12"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-14 text-base"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              {L.cancel}
            </Button>
            <Button
              className="flex-1 h-14 text-base font-semibold"
              onClick={handlePayment}
              disabled={!canComplete || isProcessing}
            >
              {isProcessing ? (
                <><Loader2 className="h-5 w-5 mr-2 animate-spin" />{L.processing}</>
              ) : (
                L.complete
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
