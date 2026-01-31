import React, { useState } from 'react';
import { User, Phone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface CustomerDetails {
  name: string;
  phone: string;
}

interface CustomerDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (details: CustomerDetails) => void;
  onSkip: () => void;
}

export function CustomerDetailsDialog({
  open,
  onOpenChange,
  onSubmit,
  onSkip
}: CustomerDetailsDialogProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = () => {
    onSubmit({ name, phone });
    setName('');
    setPhone('');
  };

  const handleSkip = () => {
    onSkip();
    setName('');
    setPhone('');
  };

  // Format phone number for WhatsApp (add 91 if needed)
  const formatPhoneForDisplay = (value: string) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, '');
    return digits.slice(0, 10);
  };

  const isValidPhone = phone.length === 10;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customer Details</DialogTitle>
          <DialogDescription>
            Enter customer details to send bill via WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer-name">Customer Name (Optional)</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="customer-name"
                placeholder="Enter customer name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-phone">WhatsApp Number</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                +91
              </span>
              <Input
                id="customer-phone"
                type="tel"
                inputMode="numeric"
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(formatPhoneForDisplay(e.target.value))}
                className="pl-12 h-12 text-lg"
                maxLength={10}
              />
              <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            {phone && !isValidPhone && (
              <p className="text-xs text-destructive">Enter 10-digit mobile number</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-12"
              onClick={handleSkip}
            >
              Skip
            </Button>
            <Button
              className="flex-1 h-12"
              onClick={handleSubmit}
              disabled={phone.length > 0 && !isValidPhone}
            >
              {phone && isValidPhone ? 'Send Bill' : 'View Bill'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
