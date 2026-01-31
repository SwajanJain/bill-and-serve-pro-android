import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePOS } from '@/contexts/POSContext';
import { DiscountType } from '@/types';
import { L } from '@/lib/labels';
import { useToast } from '@/hooks/use-toast';

interface DiscountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DiscountDialog({ open, onOpenChange }: DiscountDialogProps) {
  const { currentOrder, applyDiscount } = usePOS();
  const { toast } = useToast();
  const [discountType, setDiscountType] = useState<DiscountType>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!currentOrder) return null;

  const subtotal = currentOrder.subtotal;
  const value = parseFloat(discountValue) || 0;

  // Clamp values
  let clampedValue = value;
  if (discountType === 'percentage') {
    clampedValue = Math.min(100, Math.max(0, value));
  } else {
    clampedValue = Math.min(subtotal, Math.max(0, value));
  }

  const discountAmount = discountType === 'percentage'
    ? (subtotal * clampedValue / 100)
    : clampedValue;
  const newTotal = Math.max(0, subtotal - discountAmount);

  const handleApply = () => {
    setError('');
    if (value <= 0) {
      setError('Value must be greater than 0');
      return;
    }
    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }
    if (discountType === 'percentage' && value > 100) {
      setError('Percentage cannot exceed 100%');
      return;
    }
    if (discountType === 'flat' && value > subtotal) {
      setError('Discount cannot exceed subtotal');
      return;
    }

    applyDiscount(discountType, clampedValue, reason.trim());
    toast({ title: L.discountApplied });
    onOpenChange(false);
    setDiscountValue('');
    setReason('');
    setError('');
  };

  const quickPercentages = [5, 10, 15, 20];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{L.discount}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Discount Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={discountType === 'percentage' ? 'default' : 'outline'} onClick={() => setDiscountType('percentage')}>
                Percentage (%)
              </Button>
              <Button variant={discountType === 'flat' ? 'default' : 'outline'} onClick={() => setDiscountType('flat')}>
                Flat Amount ({'\u20B9'})
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{discountType === 'percentage' ? 'Discount Percentage' : 'Discount Amount'}</Label>
            <Input
              type="number"
              placeholder={discountType === 'percentage' ? '10' : '100'}
              value={discountValue}
              onChange={(e) => { setDiscountValue(e.target.value); setError(''); }}
              className="text-xl h-12"
            />
            {discountType === 'percentage' && (
              <div className="flex gap-2 flex-wrap">
                {quickPercentages.map(pct => (
                  <Button key={pct} variant="secondary" size="sm" onClick={() => setDiscountValue(pct.toString())}>
                    {pct}%
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Reason (required)</Label>
            <Textarea placeholder="Why is this discount being applied?" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {value > 0 && (
            <div className="p-3 bg-secondary rounded-lg space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{L.subtotal}</span>
                <span>{'\u20B9'}{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-success">
                <span>{L.discount}</span>
                <span>-{'\u20B9'}{discountAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-border pt-1">
                <span>New Total</span>
                <span>{'\u20B9'}{newTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>{L.cancel}</Button>
            <Button className="flex-1" onClick={handleApply} disabled={value <= 0 || !reason.trim()}>
              {L.discountApplied}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
