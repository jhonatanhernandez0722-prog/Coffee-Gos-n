import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type Cell = string | number;
type Rgb = [number, number, number];
export type PdfSection = { heading: string; columns: string[]; rows: Cell[][]; emptyText?: string; alignRight?: number[] };
export type PdfReport = { title: string; subtitle?: string; filename: string; summary?: [string, string][]; sections: PdfSection[]; orientation?: "portrait" | "landscape" };
export type ReceiptPdf = {
  saleNumber: string;
  date: string;
  customer: string;
  payment: string;
  items: { name: string; detail: string; total: string }[];
  received?: string;
  change?: string;
  total: string;
};

const roast: Rgb = [42, 19, 12];
const crema: Rgb = [233, 184, 114];
const ink: Rgb = [31, 45, 53];
const muted: Rgb = [107, 114, 128];
let logoCache: Promise<string | null> | null = null;

function hexToRgb(hex: string, fallback: Rgb): Rgb {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : fallback;
}

function themeColor(token: string, fallback: Rgb): Rgb {
  if (typeof window === "undefined") return fallback;
  return hexToRgb(getComputedStyle(document.documentElement).getPropertyValue(token), fallback);
}

/** Carga el logo reducido para que el PDF no pese de más. */
function loadLogo() {
  logoCache ??= new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 160;
      const context = canvas.getContext("2d");
      if (!context) return resolve(null);
      context.beginPath();
      context.arc(80, 80, 80, 0, Math.PI * 2);
      context.clip();
      context.drawImage(image, 0, 0, 160, 160);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => resolve(null);
    image.src = "/Coffe.png";
  });
  return logoCache;
}

function generatedLabel() {
  return `Generado el ${new Date().toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" })}`;
}

/** Descarga un informe PDF con encabezado de marca, indicadores y tablas. */
export async function downloadPdfReport({ title, subtitle, filename, summary = [], sections, orientation = "portrait" }: PdfReport) {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const accent = themeColor("--blue-main", [8, 126, 164]);
  const soft = themeColor("--blue-light", [207, 250, 254]);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const logo = await loadLogo();

  doc.setFillColor(...roast);
  doc.rect(0, 0, pageWidth, 34, "F");
  if (logo) doc.addImage(logo, "PNG", margin, 7, 20, 20);
  const textLeft = logo ? margin + 25 : margin;
  doc.setTextColor(255, 246, 234);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(title, textLeft, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...crema);
  doc.text(subtitle ? `Coffee Gosen · ${subtitle}` : "Coffee Gosen", textLeft, 23);
  doc.setFontSize(8);
  doc.setTextColor(214, 196, 178);
  doc.text(generatedLabel(), pageWidth - margin, 29, { align: "right" });

  let cursor = 42;
  if (summary.length) {
    const perRow = Math.min(summary.length, orientation === "landscape" ? 5 : 4);
    const gap = 4;
    const boxWidth = (pageWidth - margin * 2 - gap * (perRow - 1)) / perRow;
    summary.forEach(([label, value], index) => {
      const x = margin + (index % perRow) * (boxWidth + gap);
      const y = cursor + Math.floor(index / perRow) * 22;
      const highlighted = index === 0;
      doc.setFillColor(...(highlighted ? accent : soft));
      doc.roundedRect(x, y, boxWidth, 18, 3, 3, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...(highlighted ? [255, 255, 255] as Rgb : muted));
      doc.text(label, x + 4, y + 6.5, { maxWidth: boxWidth - 8 });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12.5);
      doc.setTextColor(...(highlighted ? [255, 255, 255] as Rgb : ink));
      doc.text(value, x + 4, y + 14, { maxWidth: boxWidth - 8 });
    });
    cursor += Math.ceil(summary.length / perRow) * 22 + 4;
  }

  sections.forEach((section) => {
    if (cursor > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      cursor = 18;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...ink);
    doc.text(section.heading, margin, cursor + 4);
    cursor += 7;
    if (!section.rows.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...muted);
      doc.text(section.emptyText ?? "Sin registros.", margin, cursor + 4);
      cursor += 12;
      return;
    }
    autoTable(doc, {
      startY: cursor,
      head: [section.columns],
      body: section.rows,
      margin: { left: margin, right: margin },
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2.4, textColor: ink, lineColor: [226, 232, 236], lineWidth: 0.1, valign: "middle", halign: "center" },
      headStyles: { fillColor: accent, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
      alternateRowStyles: { fillColor: soft },
      columnStyles: Object.fromEntries((section.alignRight ?? []).map((column) => [column, { halign: "right" }])),
    });
    cursor = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text(`Coffee Gosen, un lugar de provisión, fe y sabor · Página ${page} de ${pages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 7, { align: "center" });
  }
  doc.save(filename);
}

/** Descarga la factura en formato tirilla (80 mm de ancho). */
export async function downloadReceiptPdf(receipt: ReceiptPdf, filename: string) {
  const width = 80;
  const lineHeight = 4.6;
  const margin = 6;
  const nameWidth = width - margin * 2 - 22;
  const measure = new jsPDF({ unit: "mm", format: [width, 200] });
  measure.setFont("helvetica", "bold");
  measure.setFontSize(8.5);
  const nameLines = receipt.items.map((item) => measure.splitTextToSize(item.name, nameWidth) as string[]);
  const itemsHeight = nameLines.reduce((sum, lines) => sum + lines.length * 3.6 + lineHeight + 1.2, 0);
  const height = 116 + itemsHeight + (receipt.received ? 10 : 0);
  const doc = new jsPDF({ unit: "mm", format: [width, height] });
  const logo = await loadLogo();

  doc.setFillColor(...roast);
  doc.rect(0, 0, width, 50, "F");
  if (logo) doc.addImage(logo, "PNG", width / 2 - 9, 5, 18, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...crema);
  doc.text("Comprobante de venta", width / 2, 28, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 246, 234);
  doc.text(receipt.total, width / 2, 38, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(167, 243, 208);
  doc.text("Venta registrada", width / 2, 44.5, { align: "center" });

  let y = 57;
  const pair = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(label, margin, y);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...ink);
    doc.text(value, width - margin, y, { align: "right", maxWidth: width - margin * 2 - 22 });
    y += lineHeight + 0.6;
  };
  pair("Venta", receipt.saleNumber, true);
  pair("Fecha", receipt.date);
  pair("Comprador", receipt.customer);
  pair("Pago", receipt.payment);

  const dashed = () => {
    doc.setDrawColor(200, 190, 180);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin, y, width - margin, y);
    doc.setLineDashPattern([], 0);
    y += 5;
  };
  y += 1;
  dashed();
  receipt.items.forEach((item, index) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...ink);
    doc.text(nameLines[index], margin, y, { lineHeightFactor: 1.2 });
    doc.text(item.total, width - margin, y, { align: "right" });
    y += (nameLines[index].length - 1) * 3.6 + lineHeight;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text(item.detail, margin, y);
    y += lineHeight + 1.2;
  });
  dashed();
  if (receipt.received) pair("Recibido", receipt.received);
  if (receipt.change) pair("Vuelto", receipt.change);
  y += 1;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ink);
  doc.text("Total", margin, y + 2);
  doc.setFontSize(15);
  doc.text(receipt.total, width - margin, y + 2, { align: "right" });
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...muted);
  doc.text("Gracias por tu compra", width / 2, y, { align: "center" });
  doc.text("Coffee Gosen, un lugar de provisión, fe y sabor", width / 2, y + 4, { align: "center" });
  doc.save(filename);
}
