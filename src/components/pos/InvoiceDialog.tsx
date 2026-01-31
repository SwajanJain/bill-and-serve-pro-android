import React, { useRef } from 'react';
import { Printer, Download, MessageCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Order } from '@/types';
import { format } from 'date-fns';
import { useSettings } from '@/contexts/SettingsContext';
import { CustomerDetails } from './CustomerDetailsDialog';
import { L } from '@/lib/labels';

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  customerDetails?: CustomerDetails | null;
}

export function InvoiceDialog({ open, onOpenChange, order, customerDetails }: InvoiceDialogProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();

  if (!order) return null;

  const discountAmount = order.discountType && order.discountValue
    ? order.discountType === 'percentage'
      ? (order.subtotal * order.discountValue / 100)
      : order.discountValue
    : 0;

  // Phase 3.5: Fix WhatsApp phone number
  const formatPhoneForWhatsApp = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) {
      return digits;
    }
    return '91' + digits;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${order.orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; max-width: 320px; margin: 0 auto; background: white; color: #1a1a1a; font-size: 13px; line-height: 1.4; }
          .header { text-align: center; padding-bottom: 16px; border-bottom: 2px solid #1a1a1a; margin-bottom: 16px; }
          .header h1 { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
          .header p { font-size: 11px; color: #666; margin: 2px 0; }
          .section { padding: 12px 0; border-bottom: 1px dashed #ccc; }
          .row { display: flex; justify-content: space-between; margin: 4px 0; }
          .row .label { color: #666; }
          .row .value { font-weight: 500; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th { text-align: left; font-size: 11px; font-weight: 600; color: #666; padding: 6px 0; border-bottom: 1px solid #eee; }
          th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
          td { padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
          td:nth-child(2), td:nth-child(3), td:nth-child(4) { text-align: right; }
          .totals .grand-total { font-size: 18px; font-weight: 700; padding-top: 10px; margin-top: 10px; border-top: 2px solid #1a1a1a; }
          .footer { text-align: center; padding-top: 16px; margin-top: 8px; border-top: 1px dashed #ccc; }
          .footer p { color: #666; font-size: 12px; margin: 4px 0; }
          .footer .thank-you { font-weight: 600; color: #1a1a1a; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${settings.name}</h1>
          <p>${settings.address}</p>
          <p>Phone: ${settings.phone}</p>
          ${settings.gstEnabled && settings.gstin ? `<p style="font-size:10px;color:#888">GSTIN: ${settings.gstin}</p>` : ''}
        </div>
        <div class="section">
          <div class="row"><span class="label">Invoice #</span><span class="value">${order.orderNumber}</span></div>
          <div class="row"><span class="label">Date</span><span class="value">${format(order.createdAt, 'dd MMM yyyy, hh:mm a')}</span></div>
          <div class="row"><span class="label">Type</span><span class="value">${order.orderType}</span></div>
          ${order.table ? `<div class="row"><span class="label">Table</span><span class="value">${order.table.name}</span></div>` : ''}
        </div>
        ${customerDetails?.name ? `<div style="background:#f8f8f8;padding:10px 12px;border-radius:6px;margin:12px 0"><div style="font-weight:600">${customerDetails.name}</div>${customerDetails.phone ? `<div style="font-size:11px;color:#666">+91 ${customerDetails.phone}</div>` : ''}</div>` : ''}
        <div class="section">
          <table>
            <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amt</th></tr></thead>
            <tbody>${order.lines.map(l => `<tr><td>${l.menuItem.name}</td><td>${l.qty}</td><td>\u20B9${l.unitPrice}</td><td>\u20B9${l.lineTotal}</td></tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="section totals">
          <div class="row"><span class="label">Subtotal</span><span class="value">\u20B9${order.subtotal.toFixed(2)}</span></div>
          ${discountAmount > 0 ? `<div class="row" style="color:#16a34a"><span>Discount</span><span>-\u20B9${discountAmount.toFixed(2)}</span></div>` : ''}
          ${settings.gstEnabled ? `<div class="row"><span class="label">GST</span><span class="value">\u20B9${order.taxTotal.toFixed(2)}</span></div>` : ''}
          <div class="row grand-total"><span>Total</span><span>\u20B9${order.grandTotal.toFixed(2)}</span></div>
        </div>
        <div class="footer"><p class="thank-you">Thank you for your visit!</p><p>We hope to see you again soon</p></div>
        <script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}};</script>
      </body>
      </html>`;

    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
  };

  const handleWhatsAppShare = () => {
    const itemsList = order.lines.map(l => `\u2022 ${l.menuItem.name} x${l.qty} = \u20B9${l.lineTotal}`).join('\n');
    const customerGreeting = customerDetails?.name ? `Dear ${customerDetails.name},\n\nThank you for dining with us!\n\n` : '';

    const message = `${customerGreeting}*${settings.name}*
${settings.address}
Phone: ${settings.phone}

*Invoice: ${order.orderNumber}*
${format(order.createdAt, 'dd MMM yyyy, hh:mm a')}
${order.table ? `Table: ${order.table.name}` : 'Takeaway'}

*Items:*
${itemsList}

Subtotal: \u20B9${order.subtotal.toFixed(2)}
${discountAmount > 0 ? `Discount: -\u20B9${discountAmount.toFixed(2)}\n` : ''}GST: \u20B9${order.taxTotal.toFixed(2)}
*Total: \u20B9${order.grandTotal.toFixed(2)}*

Thank you! Visit again`.trim();

    const encodedMessage = encodeURIComponent(message);

    if (customerDetails?.phone) {
      const phoneWithCountry = formatPhoneForWhatsApp(customerDetails.phone);
      window.open(`https://wa.me/${phoneWithCountry}?text=${encodedMessage}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Invoice
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={handleWhatsAppShare} title="WhatsApp"><MessageCircle className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={handleDownloadPDF} title="PDF"><Download className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={handlePrint} title="Print"><Printer className="h-4 w-4" /></Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div ref={invoiceRef} className="bg-white text-black p-6 rounded-lg print:p-0">
          <div className="text-center mb-6 pb-4 border-b-2 border-black">
            <h1 className="text-xl font-bold tracking-wide">{settings.name}</h1>
            <p className="text-sm text-gray-600 mt-1">{settings.address}</p>
            <p className="text-sm text-gray-600">Phone: {settings.phone}</p>
            {settings.gstEnabled && settings.gstin && <p className="text-xs text-gray-500 mt-1">GSTIN: {settings.gstin}</p>}
          </div>

          <div className="text-sm mb-4 pb-4 border-b border-dashed border-gray-300">
            <div className="flex justify-between"><span className="text-gray-500">Invoice #</span><span className="font-medium">{order.orderNumber}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{format(order.createdAt, 'dd MMM yyyy, hh:mm a')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="capitalize">{order.orderType}</span></div>
            {order.table && <div className="flex justify-between"><span className="text-gray-500">Table</span><span>{order.table.name}</span></div>}
          </div>

          {customerDetails?.name && (
            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <div className="font-semibold">{customerDetails.name}</div>
              {customerDetails.phone && <div className="text-sm text-gray-500">+91 {customerDetails.phone}</div>}
            </div>
          )}

          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Item</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Qty</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Rate</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Amt</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map(line => (
                <tr key={line.id} className="border-b border-gray-100">
                  <td className="py-2 font-medium">{line.menuItem.name}</td>
                  <td className="text-right py-2">{line.qty}</td>
                  <td className="text-right py-2">{'\u20B9'}{line.unitPrice}</td>
                  <td className="text-right py-2">{'\u20B9'}{line.lineTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="text-sm space-y-1 pt-4 border-t border-dashed border-gray-300">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{'\u20B9'}{order.subtotal.toFixed(2)}</span></div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount{order.discountType === 'percentage' && ` (${order.discountValue}%)`}</span>
                <span>-{'\u20B9'}{discountAmount.toFixed(2)}</span>
              </div>
            )}
            {settings.gstEnabled && (
              <div className="flex justify-between"><span className="text-gray-500">GST</span><span>{'\u20B9'}{order.taxTotal.toFixed(2)}</span></div>
            )}
            <div className="flex justify-between text-lg font-bold pt-3 mt-3 border-t-2 border-black">
              <span>Total</span><span>{'\u20B9'}{order.grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="text-center text-sm mt-6 pt-4 border-t border-dashed border-gray-300">
            <p className="font-semibold">Thank you for your visit!</p>
            <p className="text-gray-500 mt-1">We hope to see you again soon</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleWhatsAppShare} variant="outline" className="flex-1 gap-2 h-12">
            <MessageCircle className="h-4 w-4" />WhatsApp
          </Button>
          <Button onClick={handleDownloadPDF} variant="outline" className="flex-1 gap-2 h-12">
            <Download className="h-4 w-4" />PDF
          </Button>
          <Button onClick={() => onOpenChange(false)} className="flex-1 h-12">{L.done}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
