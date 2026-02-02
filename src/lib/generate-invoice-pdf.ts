import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, RestaurantSettings } from '@/types';
import { CustomerDetails } from '@/components/pos/CustomerDetailsDialog';
import { format } from 'date-fns';

const RS = 'Rs.';
const PAGE_WIDTH = 226;
const DRAFT_PAGE_HEIGHT = 900;
const MIN_PAGE_HEIGHT = 260;
const BOTTOM_PADDING = 8;

// Colors — matched to M2 brand (black + gold)
const ACCENT = [20, 20, 22] as const;        // rich black
const GOLD = [198, 162, 68] as const;         // brand gold
const GOLD_LIGHT = [248, 243, 228] as const;  // warm cream bg
const MUTED = [120, 115, 105] as const;       // warm gray
const DARK = [30, 28, 25] as const;
const GREEN = [16, 140, 70] as const;
const WHITE = [255, 255, 255] as const;

function drawInvoiceContent(
  doc: jsPDF,
  order: Order,
  settings: RestaurantSettings,
  customerDetails?: CustomerDetails | null,
  discountAmount = 0
): number {
  const pageWidth = PAGE_WIDTH;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // ── HEADER BAND ──────────────────────────────────
  // Measure header height dynamically based on content
  let headerContentH = 14; // top padding
  if (settings.logo) headerContentH += 60 + 8; // logo + gap
  headerContentH += 14; // restaurant name
  if (settings.address) headerContentH += 9;
  if (settings.phone) headerContentH += 9;
  headerContentH += 8; // bottom padding before gold strip
  const headerH = headerContentH + 3; // +3 for gold strip

  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, pageWidth, headerH, 'F');

  // Gold accent strip at bottom of header
  doc.setFillColor(...GOLD);
  doc.rect(0, headerH - 3, pageWidth, 3, 'F');

  y = 14;

  // Logo — rendered directly, no backdrop (works with any logo shape/bg)
  if (settings.logo) {
    try {
      const logoSize = 60;
      const logoX = (pageWidth - logoSize) / 2;
      doc.addImage(settings.logo, logoX, y, logoSize, logoSize);
      y += logoSize + 8;
    } catch {
      // skip
    }
  }

  // Restaurant name
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text(settings.name.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 14;

  // Address & phone in header
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(190, 185, 175);
  if (settings.address) {
    doc.text(settings.address, pageWidth / 2, y, { align: 'center' });
    y += 9;
  }
  if (settings.phone) {
    doc.text('Ph: ' + settings.phone, pageWidth / 2, y, { align: 'center' });
    y += 9;
  }

  y = headerH + 8;

  // ── INVOICE TITLE BAR ─────────────────────────────
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('INVOICE', margin, y + 1);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text('#' + order.orderNumber, pageWidth - margin, y + 1, { align: 'right' });
  y += 10;

  // Gold accent line
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ── DETAILS SECTION ───────────────────────────────
  doc.setFontSize(7);
  const detailRow = (label: string, value: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += 11;
  };

  detailRow('Date', format(order.createdAt, 'dd MMM yyyy, hh:mm a'));
  detailRow('Type', order.orderType === 'dine-in' ? 'Dine-In' : 'Takeaway');
  if (order.table) {
    detailRow('Table', order.table.name);
  }

  // GSTIN below details
  if (settings.gstEnabled && settings.gstin) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...MUTED);
    doc.text('GSTIN: ' + settings.gstin, margin, y);
    y += 10;
  }

  // ── CUSTOMER CARD ─────────────────────────────────
  if (customerDetails?.name) {
    y += 2;
    const boxH = customerDetails.phone ? 30 : 18;
    doc.setFillColor(...GOLD_LIGHT);
    doc.roundedRect(margin, y - 2, contentWidth, boxH, 4, 4, 'F');
    // Left gold accent bar
    doc.setFillColor(...GOLD);
    doc.roundedRect(margin, y - 2, 3, boxH, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...DARK);
    doc.text(customerDetails.name, margin + 10, y + 8);
    if (customerDetails.phone) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED);
      doc.text('+91 ' + customerDetails.phone, margin + 10, y + 19);
    }
    y += boxH + 6;
  }

  y += 4;

  // ── ITEMS TABLE ───────────────────────────────────
  const tableBody = order.lines.map(l => [
    l.menuItem.name,
    String(l.qty),
    RS + l.unitPrice,
    RS + l.lineTotal,
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Item', 'Qty', 'Rate', 'Amt']],
    body: tableBody,
    theme: 'plain',
    styles: {
      fontSize: 7,
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      textColor: [...DARK],
      lineWidth: 0,
    },
    headStyles: {
      fontSize: 6,
      fontStyle: 'bold',
      textColor: [...ACCENT],
      fillColor: [...GOLD_LIGHT],
      cellPadding: { top: 5, bottom: 5, left: 3, right: 3 },
    },
    alternateRowStyles: {
      fillColor: [252, 250, 244],
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.44 },
      1: { halign: 'center', cellWidth: contentWidth * 0.10 },
      2: { halign: 'right', cellWidth: contentWidth * 0.22 },
      3: { halign: 'right', cellWidth: contentWidth * 0.24, fontStyle: 'bold' },
    },
    didDrawPage: () => {
      // Draw bottom border of table
    },
  });

  y = (doc as any).lastAutoTable?.finalY ?? y + 40;

  // Table bottom line
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ── TOTALS ────────────────────────────────────────
  const totalRow = (label: string, value: string, opts?: { bold?: boolean; color?: readonly [number, number, number]; size?: number }) => {
    const { bold = false, color = DARK, size = 7.5 } = opts || {};
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(label, margin + 2, y);
    doc.text(value, pageWidth - margin - 2, y, { align: 'right' });
    y += bold ? 14 : 11;
  };

  totalRow('Subtotal', RS + order.subtotal.toFixed(2), { color: MUTED });
  if (discountAmount > 0) {
    totalRow('Discount', '-' + RS + discountAmount.toFixed(2), { color: GREEN });
  }
  if (settings.gstEnabled) {
    totalRow('GST', RS + order.taxTotal.toFixed(2), { color: MUTED });
  }

  y += 2;

  // ── GRAND TOTAL BOX ───────────────────────────────
  const totalBoxH = 22;
  doc.setFillColor(...ACCENT);
  doc.roundedRect(margin, y - 2, contentWidth, totalBoxH, 4, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text('TOTAL', margin + 8, y + 12);
  doc.setFontSize(11);
  doc.text(RS + order.grandTotal.toFixed(2), pageWidth - margin - 8, y + 12, { align: 'right' });

  y += totalBoxH + 12;

  // ── FOOTER ────────────────────────────────────────
  // Gold decorative line
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([3, 2], 0);
  doc.line(margin + 20, y, pageWidth - margin - 20, y);
  doc.setLineDashPattern([], 0);
  y += 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  doc.text('Thank you for your visit!', pageWidth / 2, y, { align: 'center' });
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text('We hope to see you again soon', pageWidth / 2, y, { align: 'center' });
  y += 16;

  // Bottom gold accent bar
  doc.setFillColor(...GOLD);
  doc.rect(0, y - 2, pageWidth, 3, 'F');
  y += 4;

  return y;
}

export function generateInvoicePDF(
  order: Order,
  settings: RestaurantSettings,
  customerDetails?: CustomerDetails | null,
  discountAmount?: number
): jsPDF {
  const safeDiscount = discountAmount ?? 0;

  const draftDoc = new jsPDF({ unit: 'pt', format: [PAGE_WIDTH, DRAFT_PAGE_HEIGHT] });
  const contentEndY = drawInvoiceContent(draftDoc, order, settings, customerDetails, safeDiscount);

  if (draftDoc.getNumberOfPages() > 1) {
    return draftDoc;
  }

  const targetHeight = Math.max(MIN_PAGE_HEIGHT, Math.ceil(contentEndY + BOTTOM_PADDING));

  if (targetHeight >= DRAFT_PAGE_HEIGHT - 1) {
    return draftDoc;
  }

  const finalDoc = new jsPDF({ unit: 'pt', format: [PAGE_WIDTH, targetHeight] });
  drawInvoiceContent(finalDoc, order, settings, customerDetails, safeDiscount);
  return finalDoc;
}
