import { jsPDF } from 'jspdf';
import { loadLogoDataUrl } from './logo';

type LineaItem = {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  unidad?: string;
  opciones?: { atributoNombre: string; opcionNombre: string; precioUnitario?: number }[];
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
  tasaIva?: number;
  montoIva?: number;
  totalConIva?: number;
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

const COLORS = {
  azulCimadera: '#00ADEF',
  azulProfundo: '#0089C7',
  negroCimadera: '#1A1A1A',
  grisCorporativo: '#4A4A4A',
  grisClaro: '#F2F2F2',
  grisSeparador: '#CCCCCC',
};

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n);

const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const W = 210;
const marginL = 15;
const marginR = 15;
const HEADER_H = 25; // mm
const CONTENT_START_Y = 35; // mm — below header

function drawHeader(doc: jsPDF, numero: number, logoDataUrl: string | null) {
  const [nR, nG, nB] = hexToRgb(COLORS.negroCimadera);
  const [grR, grG, grB] = hexToRgb(COLORS.grisCorporativo);
  const [azR, azG, azB] = hexToRgb(COLORS.azulCimadera);
  const [sepR, sepG, sepB] = hexToRgb(COLORS.grisSeparador);

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, HEADER_H, 'F');

  const baseY = HEADER_H - 8;

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', marginL, 5, 50, 18);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(nR, nG, nB);
    doc.text('CIMAdera', marginL, baseY);
    const cimaderaWidth = doc.getTextWidth('CIMAdera');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(nR, nG, nB);
    doc.text(' S.A.', marginL + cimaderaWidth, baseY);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(grR, grG, grB);
  doc.text(
    'ventas.cimadera.net  ·  coordinacion.general@cimadera.net  ·  261 635-0017',
    marginL, baseY + 5,
  );

  // ── Derecha ────────────────────────────────────────────────────────────
  // "PRESUPUESTO N° XXXX" bold 18pt azul
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(azR, azG, azB);
  doc.text(`PRESUPUESTO N° ${String(numero).padStart(4, '0')}`, W - marginR, baseY, { align: 'right' });

  // "Las Heras, Mendoza, Argentina" normal 7.5pt gris
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(grR, grG, grB);
  doc.text('Las Heras, Mendoza, Argentina', W - marginR, baseY + 5, { align: 'right' });

  // ── Línea separadora ───────────────────────────────────────────────────
  doc.setDrawColor(sepR, sepG, sepB);
  doc.setLineWidth(0.4);
  doc.line(marginL, HEADER_H + 2, W - marginR, HEADER_H + 2);
}

function drawFooter(doc: jsPDF) {
  const [azR, azG, azB] = hexToRgb(COLORS.azulCimadera);
  doc.setFillColor(azR, azG, azB);
  doc.rect(0, 282, W, 15, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(
    'CIMAdera S.A.  ·  Las Heras, Mendoza  ·  coordinacion.general@cimadera.net  ·  261 635-0017',
    W / 2, 288, { align: 'center' },
  );
  doc.text('Certificación ISO 9001:2015  ·  Bureau Veritas', W / 2, 293, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  doc.text(`Página ${pageCount}`, W - marginR, 288, { align: 'right' });
}

export async function generarPresupuestoPDF(p: PresupuestoPDF): Promise<void> {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const contentW = W - marginL - marginR;
  let y = CONTENT_START_Y;

  const [azR, azG, azB] = hexToRgb(COLORS.azulCimadera);
  const [nR, nG, nB] = hexToRgb(COLORS.negroCimadera);
  const [grR, grG, grB] = hexToRgb(COLORS.grisCorporativo);
  const [gcR, gcG, gcB] = hexToRgb(COLORS.grisClaro);

  // Dibujar encabezado en página 1
  drawHeader(doc, p.numero, logoDataUrl);

  const checkPage = (needed: number) => {
    if (y + needed > 275) {
      drawFooter(doc);
      doc.addPage();
      drawHeader(doc, p.numero, logoDataUrl);
      y = CONTENT_START_Y;
    }
  };

  // ── DATOS CLIENTE / EMISOR ─────────────────────────────────────────────
  const col1 = marginL;
  const colMid = marginL + contentW / 2;
  const col2 = colMid + 5;

  doc.setDrawColor(azR, azG, azB);
  doc.setLineWidth(0.5);
  doc.line(colMid, y, colMid, y + 28);

  doc.setTextColor(grR, grG, grB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CLIENTE', col1, y + 4);
  doc.text('ELABORADO POR', col2, y + 4);

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

  doc.setTextColor(azR, azG, azB);
  doc.setFontSize(8);
  if (p.fechaVencimiento) doc.text(`Vence: ${fmtDate(p.fechaVencimiento)}`, col2, y + 15);
  if (p.nombrePresupuesto) {
    doc.setFontSize(7.5);
    doc.setTextColor(grR, grG, grB);
    doc.text(p.nombrePresupuesto, col2, y + 20);
  }

  // ── SEPARADOR AZUL entre datos cliente e ítems ────────────────────────
  y += 30;
  doc.setFillColor(azR, azG, azB);
  doc.setLineWidth(0.5);
  doc.rect(marginL, y, contentW, 0.5, 'F');
  y += 4;

  // ── BLOQUES DE ÍTEMS ──────────────────────────────────────────────────
  const LINE_H = 4.5;
  let altBackground = false;

  const drawBlock = (
    title: string,
    cantidad: number,
    medidas: string | null,
    colorMarca: string | null,
    opciones: { atributo: string; opcion: string; precio?: number }[],
    precioUnitario: number,
    subtotal: number,
  ) => {
    const BLOCK_HEADER_H = 8;
    const BLOCK_FOOTER_H = 7;
    let bodyH = 4;
    if (medidas) bodyH += LINE_H;
    if (colorMarca) bodyH += LINE_H;
    if (opciones.length > 0) {
      bodyH += LINE_H;
      bodyH += opciones.length * LINE_H;
    }
    bodyH += 3;
    const blockH = BLOCK_HEADER_H + bodyH + BLOCK_FOOTER_H;

    checkPage(blockH + 1);

    const [bgR, bgG, bgB] = altBackground ? [248, 248, 248] : [255, 255, 255];
    altBackground = !altBackground;

    doc.setFillColor(bgR, bgG, bgB);
    doc.rect(marginL, y, contentW, blockH, 'F');

    const [bdrR, bdrG, bdrB] = hexToRgb('#E0E0E0');
    doc.setDrawColor(bdrR, bdrG, bdrB);
    doc.setLineWidth(0.3);
    doc.rect(marginL, y, contentW, blockH, 'D');
    doc.line(marginL, y + BLOCK_HEADER_H, marginL + contentW, y + BLOCK_HEADER_H);
    doc.line(marginL, y + BLOCK_HEADER_H + bodyH, marginL + contentW, y + BLOCK_HEADER_H + bodyH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(nR, nG, nB);
    doc.text(title, marginL + 3, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(grR, grG, grB);
    doc.text(`Cantidad: ${cantidad}`, marginL + contentW - 3, y + 5.5, { align: 'right' });

    let bodyY = y + BLOCK_HEADER_H + 4;

    if (medidas) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(grR, grG, grB);
      doc.text(`Medidas: ${medidas}`, marginL + 3, bodyY);
      bodyY += LINE_H;
    }

    if (colorMarca) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(grR, grG, grB);
      doc.text(`Color/terminación: ${colorMarca}`, marginL + 3, bodyY);
      bodyY += LINE_H;
    }

    if (opciones.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(grR, grG, grB);
      doc.text('Herrajes:', marginL + 3, bodyY);
      bodyY += LINE_H;
      doc.setFont('helvetica', 'normal');
      for (const op of opciones) {
        const precioStr = op.precio != null ? `  —  ${fmtCurrency(op.precio)}` : '';
        doc.text(`  • ${op.atributo}: ${op.opcion}${precioStr}`, marginL + 3, bodyY);
        bodyY += LINE_H;
      }
    }

    const footerY = y + BLOCK_HEADER_H + bodyH + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(nR, nG, nB);
    doc.text(`Precio unitario: ${fmtCurrency(precioUnitario)}`, marginL + 3, footerY);
    doc.text(`Subtotal: ${fmtCurrency(subtotal)}`, marginL + contentW - 3, footerY, { align: 'right' });

    y += blockH;
  };

  const hasPuertas = p.puertas && p.puertas.length > 0;
  const hasLineas = p.lineas.length > 0;

  if (!hasPuertas && !hasLineas) {
    checkPage(10);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(grR, grG, grB);
    doc.text('Sin ítems cargados.', marginL, y);
    y += 8;
  }

  if (hasPuertas) {
    for (const pu of p.puertas!) {
      drawBlock(
        pu.tipoPuerta.nombre,
        pu.cantidad,
        `${Number(pu.ancho).toFixed(2)}m × ${Number(pu.alto).toFixed(2)}m`,
        pu.colorMarca ?? null,
        [],
        Number(pu.precioUnitario),
        Number(pu.subtotal),
      );
    }
  }

  if (hasLineas) {
    if (hasPuertas) {
      checkPage(12);
      y += 4;
      doc.setDrawColor(azR, azG, azB);
      doc.setLineWidth(0.5);
      doc.line(marginL, y, marginL + contentW, y);
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(azR, azG, azB);
      doc.text('ÍTEMS ADICIONALES', marginL, y);
      y += 6;
    }

    for (const l of p.lineas) {
      const opciones = (l.opciones ?? []).map((o) => ({
        atributo: o.atributoNombre,
        opcion: o.opcionNombre,
        precio: o.precioUnitario,
      }));
      drawBlock(l.nombre, l.cantidad, null, null, opciones, l.precioUnitario, l.subtotal);
    }
  }

  // ── SEPARADOR AZUL entre ítems y totales ──────────────────────────────
  y += 5;
  doc.setFillColor(azR, azG, azB);
  doc.rect(marginL, y, contentW, 0.8, 'F');
  y += 6;

  // ── TOTALES ────────────────────────────────────────────────────────────
  checkPage(30);
  const totLabelX = W - marginR - 65;
  const totValX = W - marginR;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(grR, grG, grB);
  doc.text('Subtotal:', totLabelX, y, { align: 'right' });
  doc.text(fmtCurrency(Number(p.subtotal)), totValX, y, { align: 'right' });
  y += 5.5;

  if (Number(p.descuento) > 0) {
    doc.setTextColor(200, 40, 40);
    doc.text(`Descuento (${Number(p.descuento)}%):`, totLabelX, y, { align: 'right' });
    doc.text(`- ${fmtCurrency(Number(p.subtotal) * Number(p.descuento) / 100)}`, totValX, y, { align: 'right' });
    y += 5.5;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(grR, grG, grB);
  doc.text('Neto:', totLabelX, y, { align: 'right' });
  doc.text(fmtCurrency(Number(p.totalFinal)), totValX, y, { align: 'right' });
  y += 5.5;

  if (p.tasaIva && p.tasaIva > 0) {
    doc.text(`IVA (${p.tasaIva}%):`, totLabelX, y, { align: 'right' });
    doc.text(fmtCurrency(Number(p.montoIva ?? 0)), totValX, y, { align: 'right' });
    y += 5.5;
  }

  const totalLabel = p.tasaIva === 0 ? 'TOTAL (EXENTO):' : (p.tasaIva ? 'TOTAL c/IVA:' : 'PRECIO TOTAL:');
  const totalValue = p.tasaIva != null ? fmtCurrency(Number(p.totalConIva ?? p.totalFinal)) : fmtCurrency(Number(p.totalFinal));

  doc.setFillColor(azR, azG, azB);
  doc.rect(totLabelX - 35, y - 3.5, totValX - totLabelX + 48, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(totalLabel, totLabelX, y + 2, { align: 'right' });
  doc.text(totalValue, totValX, y + 2, { align: 'right' });
  y += 14;

  // ── OBSERVACIONES ──────────────────────────────────────────────────────
  if (p.observaciones) {
    checkPage(22);
    doc.setFillColor(gcR, gcG, gcB);
    doc.setDrawColor(azR, azG, azB);
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
    y += 22;
  }

  // ── SEPARADOR GRIS entre totales y condiciones ────────────────────────
  checkPage(42);
  y += 4;
  doc.setDrawColor(204, 204, 204);
  doc.setLineWidth(0.5);
  doc.line(marginL, y, marginL + contentW, y);
  y += 6;

  // ── CONDICIONES COMERCIALES ────────────────────────────────────────────
  doc.setFillColor(gcR, gcG, gcB);
  doc.setDrawColor(azR, azG, azB);
  doc.setLineWidth(0.3);
  doc.rect(marginL, y, contentW, 36, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(azR, azG, azB);
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

  const apellido = p.cliente.razonSocial.trim().split(/\s+/).slice(-1)[0].replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ0-9]/g, '');
  const fecha = new Date(p.fechaCreacion);
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const yyyy = fecha.getFullYear();
  doc.save(`Presupuesto-${String(p.numero).padStart(4, '0')}-${apellido}-${dd}${mm}${yyyy}.pdf`);
}
