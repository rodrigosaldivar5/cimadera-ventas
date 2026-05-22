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

// Colores corporativos CIMAdera
const COLORS = {
  azulCimadera: '#00ADEF',
  azulProfundo: '#0089C7',
  negroCimadera: '#1A1A1A',
  grisCorporativo: '#4A4A4A',
  grisClaro: '#F2F2F2',
  maderaCalida: '#8B6C3E',
};

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n);

const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function drawFooter(doc: jsPDF) {
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  const W = 210;
  const [r, g, b] = hexToRgb(COLORS.azulCimadera);
  doc.setFillColor(r, g, b);
  doc.rect(0, 282, W, 15, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(
    'CIMAdera S.A.  ·  Las Heras, Mendoza  ·  coordinacion.general@cimadera.net  ·  261 635-0017',
    W / 2, 288, { align: 'center' }
  );
  doc.text('Certificación ISO 9001:2015  ·  Bureau Veritas', W / 2, 293, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(`Página ${pageCount}`, W - 15, 288, { align: 'right' });
}

export function generarPresupuestoPDF(p: PresupuestoPDF): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const marginL = 15;
  const marginR = 15;
  const contentW = W - marginL - marginR;
  let y = 0;

  const colH = (height: number) => { y += height; };
  const checkPage = (needed: number) => {
    if (y + needed > 275) {
      drawFooter(doc);
      doc.addPage();
      y = 20;
    }
  };

  // ── HEADER — franja azul 18mm ──────────────────────────────────────────
  const [aR, aG, aB] = hexToRgb(COLORS.azulProfundo);
  doc.setFillColor(aR, aG, aB);
  doc.rect(0, 0, W, 18, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('CIMAdera S.A.', marginL, 10);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('ventas.cimadera.net', marginL, 15);

  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(`PRESUPUESTO N° ${String(p.numero).padStart(4, '0')}`, W - marginR, 10, { align: 'right' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emisión: ${fmtDate(p.fechaCreacion)}`, W - marginR, 15, { align: 'right' });

  y = 22;

  // ── DATOS CLIENTE / EMISOR — dos columnas ──────────────────────────────
  const col1 = marginL;
  const colMid = marginL + contentW / 2;
  const col2 = colMid + 5;

  // Separador vertical
  const [gc1, gc2, gc3] = hexToRgb(COLORS.azulCimadera);
  doc.setDrawColor(gc1, gc2, gc3);
  doc.setLineWidth(0.5);
  doc.line(colMid, y, colMid, y + 28);

  const [grR, grG, grB] = hexToRgb(COLORS.grisCorporativo);
  doc.setTextColor(grR, grG, grB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CLIENTE', col1, y + 4);
  doc.text('ELABORADO POR', col2, y + 4);

  const [nR, nG, nB] = hexToRgb(COLORS.negroCimadera);
  doc.setTextColor(nR, nG, nB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(p.cliente.razonSocial, col1, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(p.creadoPor.nombre, col2, y + 10);

  doc.setFontSize(8);
  doc.setTextColor(grR, grG, grB);
  let clienteY = y + 15;
  if (p.cliente.cuit) { doc.text(`CUIT: ${p.cliente.cuit}`, col1, clienteY); clienteY += 4.5; }
  if (p.cliente.email) { doc.text(p.cliente.email, col1, clienteY); clienteY += 4.5; }
  if (p.cliente.telefono) { doc.text(p.cliente.telefono, col1, clienteY); clienteY += 4.5; }
  if (p.cliente.ciudad || p.cliente.provincia) {
    doc.text([p.cliente.ciudad, p.cliente.provincia].filter(Boolean).join(', '), col1, clienteY);
  }

  const [aR2, aG2, aB2] = hexToRgb(COLORS.azulCimadera);
  doc.setTextColor(aR2, aG2, aB2);
  doc.setFontSize(8);
  if (p.fechaVencimiento) {
    doc.text(`Vence: ${fmtDate(p.fechaVencimiento)}`, col2, y + 15);
  }
  if (p.nombrePresupuesto) {
    doc.setFontSize(7.5);
    doc.setTextColor(grR, grG, grB);
    doc.text(p.nombrePresupuesto, col2, y + 20);
  }

  // ── SEPARADOR AZUL y=52mm ──────────────────────────────────────────────
  y = 52;
  doc.setFillColor(aR2, aG2, aB2);
  doc.rect(marginL, y, contentW, 0.8, 'F');
  y = 55;

  // ── TABLA ENCABEZADO ─────────────────────────────────────────────────
  // Columnas: ÍTEM(12) | DESCRIPCIÓN(85) | CANT.(15) | P.UNIT.(30) | TOTAL(30)
  const colItem = marginL;
  const colDesc = marginL + 12;
  const colCant = marginL + 12 + 85;
  const colPUnit = marginL + 12 + 85 + 15;
  const colTotal = W - marginR;

  const [gcR, gcG, gcB] = hexToRgb(COLORS.grisClaro);
  doc.setFillColor(gcR, gcG, gcB);
  doc.rect(marginL, y - 3, contentW, 7, 'F');
  doc.setFillColor(aR2, aG2, aB2);
  doc.rect(marginL, y - 3, contentW, 0.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(grR, grG, grB);
  doc.text('ÍTEM', colItem, y + 1);
  doc.text('DESCRIPCIÓN', colDesc, y + 1);
  doc.text('CANT.', colCant, y + 1);
  doc.text('P.UNIT.', colPUnit, y + 1);
  doc.text('TOTAL', colTotal, y + 1, { align: 'right' });

  doc.setFillColor(aR2, aG2, aB2);
  doc.rect(marginL, y + 3, contentW, 0.5, 'F');
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(nR, nG, nB);

  let rowNum = 0;
  let rowAlt = false;

  const drawRow = (nombre: string, cantidad: number, unidad: string, precioUnitario: number, subtotal: number, detalle?: string) => {
    checkPage(detalle ? 14 : 9);
    rowNum++;

    if (rowAlt) {
      doc.setFillColor(gcR, gcG, gcB);
      doc.rect(marginL, y - 3.5, contentW, detalle ? 13 : 8, 'F');
    }
    rowAlt = !rowAlt;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(nR, nG, nB);
    doc.text(String(rowNum), colItem, y);
    doc.text(nombre, colDesc, y);
    doc.text(String(cantidad), colCant, y);
    doc.text(fmtCurrency(precioUnitario), colPUnit, y);
    doc.text(fmtCurrency(subtotal), colTotal, y, { align: 'right' });
    colH(detalle ? 5 : 6);

    if (detalle) {
      doc.setFontSize(7);
      doc.setTextColor(grR, grG, grB);
      const lines = doc.splitTextToSize(detalle, 80);
      doc.text(lines, colDesc, y);
      colH(lines.length * 4 + 2);
    }
  };

  // Puertas
  if (p.puertas && p.puertas.length > 0) {
    checkPage(10);
    const [aRx, aGx, aBx] = hexToRgb(COLORS.azulCimadera);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(aRx, aGx, aBx);
    doc.text('CONFIGURACIÓN DE PRODUCTOS', colDesc, y);
    colH(6);
    doc.setTextColor(nR, nG, nB);

    for (const pu of p.puertas) {
      const nombre = `${pu.tipoPuerta.nombre} ${Number(pu.ancho).toFixed(2)}m × ${Number(pu.alto).toFixed(2)}m`;
      const detalle = pu.colorMarca ? `Color/terminación: ${pu.colorMarca}` : undefined;
      drawRow(nombre, pu.cantidad, 'u.', Number(pu.precioUnitario), Number(pu.subtotal), detalle);
    }
  }

  // Líneas
  if (p.lineas.length > 0) {
    checkPage(10);
    const [aRx, aGx, aBx] = hexToRgb(COLORS.azulCimadera);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(aRx, aGx, aBx);
    doc.text('ÍTEMS', colDesc, y);
    colH(6);
    doc.setTextColor(nR, nG, nB);

    for (const l of p.lineas) {
      const detalle = l.opciones?.map((o) => `${o.atributoNombre}: ${o.opcionNombre}`).join(' | ');
      drawRow(l.nombre, l.cantidad, l.unidad ?? 'u.', l.precioUnitario, l.subtotal, detalle);
    }
  }

  if (rowNum === 0) {
    checkPage(10);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(grR, grG, grB);
    doc.text('Sin ítems cargados.', colDesc, y);
    colH(8);
  }

  // ── SILUETA DE PUERTA decorativa ──────────────────────────────────────
  checkPage(35);
  const doorX = W - marginR - 30;
  const doorY = y + 2;
  const [mR, mG, mB] = hexToRgb(COLORS.maderaCalida);
  doc.setFillColor(mR, mG, mB);
  doc.setDrawColor(mR - 30, mG - 20, mB - 10);
  doc.setLineWidth(0.5);
  doc.rect(doorX, doorY, 22, 30, 'FD');
  doc.setFillColor(mR + 30, mG + 20, mB + 10);
  doc.rect(doorX + 2, doorY + 2, 18, 26, 'F');
  // manija
  doc.setFillColor(180, 130, 50);
  doc.circle(doorX + 17, doorY + 15, 1.2, 'F');
  // bisagras
  doc.setFillColor(150, 120, 80);
  doc.rect(doorX + 2, doorY + 4, 2, 3, 'F');
  doc.rect(doorX + 2, doorY + 13, 2, 3, 'F');
  doc.rect(doorX + 2, doorY + 22, 2, 3, 'F');

  // ── TOTALES alineados a la derecha ────────────────────────────────────
  colH(8);
  doc.setDrawColor(aR2, aG2, aB2);
  doc.setLineWidth(0.4);
  doc.line(marginL, y, W - marginR - 35, y);
  colH(6);

  const totLabelX = W - marginR - 75;
  const totValX = W - marginR - 35;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(grR, grG, grB);
  doc.text('Subtotal:', totLabelX, y, { align: 'right' });
  doc.text(fmtCurrency(Number(p.subtotal)), totValX, y, { align: 'right' });
  colH(5.5);

  if (Number(p.descuento) > 0) {
    doc.setTextColor(200, 40, 40);
    doc.text(`Descuento (${Number(p.descuento)}%):`, totLabelX, y, { align: 'right' });
    doc.text(`- ${fmtCurrency(Number(p.subtotal) * Number(p.descuento) / 100)}`, totValX, y, { align: 'right' });
    colH(5.5);
  }

  // Precio Total destacado
  doc.setFillColor(aR2, aG2, aB2);
  doc.rect(totLabelX - 30, y - 3.5, totValX - totLabelX + 45, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('PRECIO TOTAL:', totLabelX, y + 2, { align: 'right' });
  doc.text(fmtCurrency(Number(p.totalFinal)), totValX, y + 2, { align: 'right' });
  colH(14);

  // ── OBSERVACIONES ──────────────────────────────────────────────────────
  if (p.observaciones) {
    checkPage(22);
    doc.setFillColor(gcR, gcG, gcB);
    doc.setDrawColor(aR2, aG2, aB2);
    doc.setLineWidth(0.3);
    doc.rect(marginL, y, contentW, 18, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(grR, grG, grB);
    doc.text('OBSERVACIONES', marginL + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(nR, nG, nB);
    const lines = doc.splitTextToSize(p.observaciones, contentW - 6);
    doc.text(lines, marginL + 3, y + 10);
    colH(22);
  }

  // ── CONDICIONES COMERCIALES ────────────────────────────────────────────
  checkPage(42);
  colH(4);
  doc.setFillColor(gcR, gcG, gcB);
  doc.setDrawColor(aR2, aG2, aB2);
  doc.setLineWidth(0.3);
  doc.rect(marginL, y, contentW, 36, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(aR2, aG2, aB2);
  doc.text('CONDICIONES COMERCIALES', marginL + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(grR, grG, grB);
  const condiciones = [
    '• Precios expresados en pesos argentinos (ARS), sujetos a actualización sin previo aviso.',
    '• Validez del presupuesto: 7 días hábiles desde la fecha de emisión.',
    '• Forma de pago: 50% al confirmar el pedido, 50% contra entrega.',
    '• El plazo de entrega se confirma al momento de la orden de compra.',
    '• No incluye instalación salvo que se especifique expresamente.',
    '• Los precios no incluyen IVA. Se emite factura A o B según corresponda.',
  ];
  condiciones.forEach((line, i) => {
    doc.text(line, marginL + 3, y + 11 + i * 4);
  });

  drawFooter(doc);

  // ── NOMBRE DE ARCHIVO ──────────────────────────────────────────────────
  const apellido = p.cliente.razonSocial.trim().split(/\s+/).slice(-1)[0].replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ0-9]/g, '');
  const fecha = new Date(p.fechaCreacion);
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const yyyy = fecha.getFullYear();
  doc.save(`Presupuesto-${String(p.numero).padStart(4, '0')}-${apellido}-${dd}${mm}${yyyy}.pdf`);
}
