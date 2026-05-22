import { jsPDF } from 'jspdf';

type LineaItem = {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  unidad?: string;
  opciones?: { atributoNombre: string; opcionNombre: string }[];
};

type PresupuestoPDF = {
  numero: number;
  nombrePresupuesto?: string | null;
  fechaCreacion: Date | string;
  fechaVencimiento?: Date | string | null;
  observaciones?: string | null;
  subtotal: number;
  descuento: number;
  totalFinal: number;
  cliente: {
    razonSocial: string;
    cuit?: string | null;
    email?: string | null;
    telefono?: string | null;
    ciudad?: string | null;
    provincia?: string | null;
    tipoCliente?: string | null;
  };
  creadoPor: { nombre: string };
  lineas: LineaItem[];
  puertas?: {
    tipoPuerta: { nombre: string };
    ancho: number;
    alto: number;
    cantidad: number;
    colorMarca?: string | null;
    precioUnitario: number;
    subtotal: number;
  }[];
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n);

const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export function generarPresupuestoPDF(p: PresupuestoPDF): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const marginL = 15;
  const marginR = 15;
  const contentW = W - marginL - marginR;
  let y = 18;

  const colH = (height: number) => { y += height; };
  const checkPage = (needed: number) => {
    if (y + needed > 270) {
      doc.addPage();
      y = 18;
      drawFooter(doc);
    }
  };

  // ── HEADER ──────────────────────────────────────────────────────────
  doc.setFillColor(14, 165, 233); // sky-500
  doc.rect(0, 0, W, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('CIMAdera S.A.', marginL, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Carpintería Industrial — ventas.cimadera.net', marginL, 19);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`PRESUPUESTO Nº ${String(p.numero).padStart(4, '0')}`, W - marginR, 12, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emisión: ${fmtDate(p.fechaCreacion)}`, W - marginR, 19, { align: 'right' });
  if (p.fechaVencimiento)
    doc.text(`Vence: ${fmtDate(p.fechaVencimiento)}`, W - marginR, 24, { align: 'right' });

  y = 35;
  doc.setTextColor(30, 41, 59); // slate-800

  // ── DATOS CLIENTE / EMISOR ───────────────────────────────────────────
  const col1 = marginL;
  const col2 = marginL + contentW / 2 + 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('CLIENTE', col1, y);
  doc.text('ELABORADO POR', col2, y);
  colH(5);

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(p.cliente.razonSocial, col1, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(p.creadoPor.nombre, col2, y);
  colH(5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  if (p.cliente.cuit) { doc.text(`CUIT: ${p.cliente.cuit}`, col1, y); colH(4.5); }
  if (p.cliente.email) { doc.text(p.cliente.email, col1, y); colH(4.5); }
  if (p.cliente.telefono) { doc.text(p.cliente.telefono, col1, y); colH(4.5); }
  if (p.cliente.ciudad || p.cliente.provincia) {
    doc.text([p.cliente.ciudad, p.cliente.provincia].filter(Boolean).join(', '), col1, y);
    colH(4.5);
  }
  if (p.cliente.tipoCliente) {
    const labels: Record<string, string> = { CONSTRUCTORA: 'Constructora', DESARROLLADOR: 'Pequeño Desarrollador', PARTICULAR: 'Particular' };
    doc.text(`Tipo: ${labels[p.cliente.tipoCliente] ?? p.cliente.tipoCliente}`, col1, y);
    colH(4.5);
  }

  y = Math.max(y, 65);

  // ── SEPARATOR ───────────────────────────────────────────────────────
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(marginL, y, W - marginR, y);
  colH(6);

  // ── TABLE HEADER ────────────────────────────────────────────────────
  const colNombre = marginL;
  const colCant = marginL + contentW * 0.52;
  const colUnit = marginL + contentW * 0.63;
  const colPrecio = marginL + contentW * 0.76;
  const colSubtotal = W - marginR;

  doc.setFillColor(241, 245, 249);
  doc.rect(marginL, y - 4, contentW, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('DESCRIPCIÓN', colNombre, y);
  doc.text('CANT.', colCant, y);
  doc.text('UNIDAD', colUnit, y);
  doc.text('P. UNIT.', colPrecio, y);
  doc.text('SUBTOTAL', colSubtotal, y, { align: 'right' });
  colH(6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  let rowAlt = false;

  const drawRow = (nombre: string, cantidad: number, unidad: string, precioUnitario: number, subtotal: number, detalle?: string) => {
    checkPage(10);
    if (rowAlt) {
      doc.setFillColor(248, 250, 252);
      doc.rect(marginL, y - 4, contentW, 8, 'F');
    }
    rowAlt = !rowAlt;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(nombre, colNombre, y);
    doc.text(String(cantidad), colCant, y);
    doc.text(unidad, colUnit, y);
    doc.text(fmtCurrency(precioUnitario), colPrecio, y);
    doc.text(fmtCurrency(subtotal), colSubtotal, y, { align: 'right' });
    colH(6);

    if (detalle) {
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(detalle, colNombre + 2, y);
      colH(5);
    }
  };

  // Puertas
  if (p.puertas && p.puertas.length > 0) {
    checkPage(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(14, 165, 233);
    doc.text('Puertas', colNombre, y);
    colH(5);

    for (const pu of p.puertas) {
      const nombre = `${pu.tipoPuerta.nombre} ${Number(pu.ancho).toFixed(2)}m × ${Number(pu.alto).toFixed(2)}m`;
      const detalle = pu.colorMarca ? `Color/marca: ${pu.colorMarca}` : undefined;
      drawRow(nombre, pu.cantidad, 'u.', Number(pu.precioUnitario), Number(pu.subtotal), detalle);
    }
  }

  // Líneas
  if (p.lineas.length > 0) {
    checkPage(8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(14, 165, 233);
    doc.text('Ítems', colNombre, y);
    colH(5);

    for (const l of p.lineas) {
      const detalle = l.opciones?.map((o) => `${o.atributoNombre}: ${o.opcionNombre}`).join(' | ');
      drawRow(l.nombre, l.cantidad, l.unidad ?? 'u.', l.precioUnitario, l.subtotal, detalle);
    }
  }

  // ── TOTALES ──────────────────────────────────────────────────────────
  checkPage(30);
  colH(4);
  doc.setDrawColor(226, 232, 240);
  doc.line(marginL, y, W - marginR, y);
  colH(6);

  const totX = W - marginR - 60;
  const totValX = W - marginR;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  doc.text('Subtotal:', totX, y);
  doc.text(fmtCurrency(Number(p.subtotal)), totValX, y, { align: 'right' });
  colH(5.5);

  if (Number(p.descuento) > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text(`Descuento (${Number(p.descuento)}%):`, totX, y);
    doc.text(`- ${fmtCurrency(Number(p.subtotal) * Number(p.descuento) / 100)}`, totValX, y, { align: 'right' });
    colH(5.5);
  }

  doc.setFillColor(14, 165, 233);
  doc.rect(totX - 5, y - 4, totValX - totX + 20, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL FINAL:', totX, y + 2);
  doc.text(fmtCurrency(Number(p.totalFinal)), totValX, y + 2, { align: 'right' });
  colH(14);

  // ── OBSERVACIONES ───────────────────────────────────────────────────
  if (p.observaciones) {
    checkPage(20);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginL, y - 2, contentW, 16, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('OBSERVACIONES', marginL + 3, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(p.observaciones, contentW - 6);
    doc.text(lines, marginL + 3, y + 9);
    colH(18);
  }

  drawFooter(doc);

  const clienteSlug = p.cliente.razonSocial.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 30);
  doc.save(`Presupuesto-${String(p.numero).padStart(4, '0')}-${clienteSlug}.pdf`);
}

function drawFooter(doc: jsPDF) {
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('CIMAdera S.A. — ventas.cimadera.net', 15, 288);
  doc.text(`Página ${pageCount}`, 195, 288, { align: 'right' });
}
