import React, { useRef, useState } from 'react';
import { Download, Share2, Loader2 } from 'lucide-react';
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
import { generateInvoicePDF } from '@/lib/generate-invoice-pdf';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { WhatsAppShare } from '@/lib/whatsapp-share';
import { useToast } from '@/hooks/use-toast';

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  customerDetails?: CustomerDetails | null;
}

const pdfToBase64 = async (pdf: ReturnType<typeof generateInvoicePDF>): Promise<string> => {
  const blob = pdf.output('blob');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to encode PDF'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to encode PDF'));
    reader.readAsDataURL(blob);
  });

  const base64 = dataUrl.split(',')[1];
  if (!base64 || !base64.startsWith('JVBERi0')) {
    throw new Error('Invalid PDF data generated');
  }

  return base64;
};

export function InvoiceDialog({ open, onOpenChange, order, customerDetails }: InvoiceDialogProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();
  const { toast } = useToast();
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!order) return null;

  const discountAmount = order.discountType && order.discountValue
    ? order.discountType === 'percentage'
      ? (order.subtotal * order.discountValue / 100)
      : order.discountValue
    : 0;

  const handleShareBill = async () => {
    setSharing(true);
    try {
      const pdf = generateInvoicePDF(order, settings, customerDetails, discountAmount);
      const base64 = await pdfToBase64(pdf);
      const fileName = `Invoice_${order.orderNumber}_${Date.now()}.pdf`;

      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });
      const fileUri = (await Filesystem.getUri({
        path: fileName,
        directory: Directory.Cache,
      })).uri;
      const fileInfo = await Filesystem.stat({
        path: fileName,
        directory: Directory.Cache,
      });
      if (!fileInfo.size || fileInfo.size < 100) {
        throw new Error(`PDF file is empty or too small (${fileInfo.size ?? 0} bytes)`);
      }

      // If customer phone is available, send directly to their WhatsApp
      if (customerDetails?.phone && customerDetails.phone.length === 10) {
        try {
          // Pass just the filename — native plugin resolves from cache dir
          // and creates a proper FileProvider URI with correct permissions
          await WhatsAppShare.shareFile({
            phone: customerDetails.phone,
            filePath: fileName,
            mimeType: 'application/pdf',
          });
          return;
        } catch (waErr: any) {
          // WhatsApp not installed or plugin unavailable — fall back to generic share
          if (waErr?.message?.includes('not installed')) {
            toast({ title: 'WhatsApp not installed', variant: 'destructive' });
            return;
          }
        }
      }

      // Fallback: generic share sheet
      await Share.share({
        title: `Invoice ${order.orderNumber}`,
        files: [fileUri],
        dialogTitle: L.shareBill,
      });
    } catch (err: any) {
      console.log('Share error:', err);
      toast({
        title: L.errorGeneric,
        description: err?.message || 'Failed to share PDF',
        variant: 'destructive',
      });
    } finally {
      setSharing(false);
    }
  };

  const handleSavePDF = async () => {
    setSaving(true);
    try {
      const pdf = generateInvoicePDF(order, settings, customerDetails, discountAmount);
      const base64 = await pdfToBase64(pdf);
      const fileName = `Invoice_${order.orderNumber}.pdf`;

      await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents,
      });

      toast({ title: L.pdfSaved, description: fileName });
    } catch {
      // Fallback: download via blob for web/dev
      try {
        const pdf = generateInvoicePDF(order, settings, customerDetails, discountAmount);
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Invoice_${order.orderNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: L.pdfSaved });
      } catch {
        toast({ title: L.errorGeneric, variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice</DialogTitle>
        </DialogHeader>

        <div ref={invoiceRef} className="bg-white text-black p-3 sm:p-6 rounded-lg print:p-0">
          <div className="text-center mb-6 pb-4 border-b-2 border-black">
            {settings.logo && (
              <img src={settings.logo} alt="Logo" className="w-16 h-16 mx-auto mb-2 rounded object-cover" />
            )}
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

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={handleShareBill} variant="outline" className="gap-2 h-12" disabled={sharing}>
            {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            {L.shareBill}
          </Button>
          <Button onClick={handleSavePDF} variant="outline" className="gap-2 h-12" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {L.savePdf}
          </Button>
          <Button onClick={() => onOpenChange(false)} className="col-span-2 h-12">{L.done}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
