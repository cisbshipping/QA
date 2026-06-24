import jsPDF from 'jspdf';
import type { Complaint } from '@/types';
import { fmtDate } from '@/lib/utils';

interface PdfOptions {
  letterheadDataUrl?: string;
  pic?: string;
}

export async function generateComplaintPdf(c: Complaint, opts: PdfOptions = {}): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  // ---- Letterhead ----
  if (opts.letterheadDataUrl) {
    try {
      const { width, height } = await imgDimensions(opts.letterheadDataUrl);
      const maxWidth = pageWidth - margin * 2;
      const scale = Math.min(1, maxWidth / width);
      const drawW = width * scale;
      const drawH = height * scale;
      doc.addImage(opts.letterheadDataUrl, 'PNG', (pageWidth - drawW) / 2, y, drawW, drawH);
      y += drawH + 15;
    } catch {
      // letterhead optional; ignore failures
    }
  }

  // Divider under letterhead
  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('COMPLAINT REGISTRATION FORM', pageWidth / 2, y, { align: 'center' });
  y += 22;

  // Top metadata row
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  drawKV(doc, margin, y, [
    { k: 'Complaint No.', v: c.complaintNo },
    { k: 'Date Recorded', v: fmtDate(c.dateRecorded) },
    { k: 'PIC', v: opts.pic || '—' },
  ]);
  y += 22;

  y = section(doc, 'Complaint Information', y);
  y = drawTwoCol(doc, margin, y, [
    ['Factory / Supplier', c.factory],
    ['Brand Name', c.brandName],
    ['Product Name', c.productName],
    ['PI No.', c.piNo],
    ['PO No.', c.poNo],
    ['Lot No.', c.lotNo],
    ['Size', c.size],
    ['Quantity Involved', c.quantityInvolved],
  ]);

  y = section(doc, 'Defective Samples', y);
  y = drawTwoCol(doc, margin, y, [
    ['Defective Sample Photo', c.hasDefectiveSamplePhoto ? 'Yes' : 'No'],
    ['Defective Sample Return', c.hasDefectiveSampleReturn
      ? `Yes (Qty: ${c.returnSampleQty ?? '—'})`
      : 'No'],
  ]);

  y = section(doc, 'Nature of Complaint', y);
  doc.setFontSize(10);
  const natures = c.natures.join(' · ') + (c.othersDescription ? ` · Others: ${c.othersDescription}` : '');
  y = wrapText(doc, natures || '—', margin, y, pageWidth - margin * 2, 14);
  y += 8;

  y = section(doc, 'Description of Complaint', y);
  y = wrapText(doc, c.description, margin, y, pageWidth - margin * 2, 14);
  y += 20;

  if (c.dateIssuedToFactory || c.forwardedBy) {
    y = section(doc, 'Workflow', y);
    y = drawTwoCol(doc, margin, y, [
      ['Date Issued to Factory', fmtDate(c.dateIssuedToFactory)],
      ['Forwarded By', c.forwardedBy],
    ]);
  }

  // Signatures (placeholder area)
  y = Math.max(y, doc.internal.pageSize.getHeight() - 120);
  doc.setDrawColor(160);
  doc.line(margin, y, margin + 180, y);
  doc.line(pageWidth - margin - 180, y, pageWidth - margin, y);
  doc.setFontSize(9);
  doc.text('Submitted by', margin, y + 12);
  doc.text('Reviewed by', pageWidth - margin - 180, y + 12);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(
    `Generated on ${new Date().toLocaleString()} · Complaint No. ${c.complaintNo}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 20,
    { align: 'center' },
  );

  return doc;
}

export function pdfFilename(c: Complaint): string {
  return `Complaint_${c.complaintNo}.pdf`;
}

// ---- helpers ----

function section(doc: jsPDF, title: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text(title, 40, y);
  doc.setDrawColor(220);
  doc.line(40, y + 3, doc.internal.pageSize.getWidth() - 40, y + 3);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(20);
  return y + 16;
}

function drawKV(doc: jsPDF, x: number, y: number, items: { k: string; v?: string }[]): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const colWidth = (pageWidth - x * 2) / items.length;
  items.forEach((it, i) => {
    const cx = x + colWidth * i;
    doc.setTextColor(120);
    doc.setFontSize(8);
    doc.text(it.k.toUpperCase(), cx, y);
    doc.setTextColor(20);
    doc.setFontSize(10);
    doc.text(it.v || '—', cx, y + 12);
  });
}

function drawTwoCol(doc: jsPDF, x: number, y: number, rows: [string, string | undefined][]): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const colWidth = (pageWidth - x * 2) / 2;
  for (let i = 0; i < rows.length; i += 2) {
    const left = rows[i];
    const right = rows[i + 1];
    drawField(doc, x, y, colWidth - 10, left[0], left[1]);
    if (right) drawField(doc, x + colWidth, y, colWidth - 10, right[0], right[1]);
    y += 26;
  }
  return y + 6;
}

function drawField(doc: jsPDF, x: number, y: number, w: number, label: string, value?: string): void {
  doc.setTextColor(120);
  doc.setFontSize(8);
  doc.text(label.toUpperCase(), x, y);
  doc.setTextColor(20);
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(value || '—', w);
  doc.text(lines[0] ?? '—', x, y + 12);
}

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text || '—', maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function imgDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = dataUrl;
  });
}
