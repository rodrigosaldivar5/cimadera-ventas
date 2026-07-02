import { jsPDF } from 'jspdf';
import { loadLogoDataUrl } from './logo';

export type MovimientoPDF = {
  fecha: Date | string;
  tipo: string;
  descripcion: string;
  numeroFactura?: string | null;
  monto: number;
  montoEnARS?: number | null;
  equivalenteUSD?: number | null;
  caja?: string | null;
  tipoCambio?: number | null;
  saldoResultante: number;
};

export type CuentaPDF = {
  id: string;
  moneda?: string;
  fechaInicio: Date | string;
  montoOriginal: number;
  indiceInicio: number;
  indiceActual: number;
  nombreIndice: string;
  saldoActualizado: number;
  estado: string;
  observaciones?: string | null;
  tasaIvaContrato?: number | null;
  montoContratoNeto?: number | null;
  montoContratoIva?: number | null;
  cliente: {
    razonSocial: string;
    cuit?: string | null;
    email?: string | null;
    telefono?: string | null;
  };
  obra?: { nombre: string; direccion?: string | null } | null;
  presupuesto?: { numero: number; nombrePresupuesto?: string | null } | null;
  movimientos: MovimientoPDF[];
};

const COLORS = {
  azulCimadera: '#00ADEF',
  negroCimadera: '#1A1A1A',
  grisCorporativo: '#4A4A4A',
  grisClaro: '#F2F2F2',
  grisSeparador: '#CCCCCC',
};

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const W = 210;
const marginL = 15;
const marginR = 15;
const HEADER_H = 25;
const CONTENT_START_Y = 35;

function drawHeader(doc: jsPDF, titulo: string, logoDataUrl: string | null) {
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

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(azR, azG, azB);
  doc.text(titulo, W - marginR, baseY, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(grR, grG, grB);
  doc.text('Las Heras, Mendoza, Argentina', W - marginR, baseY + 5, { align: 'right' });

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

export async function generarCuentaCorrientePDF(cuenta: CuentaPDF): Promise<void> {
  const logoDataUrl = await loadLogoDataUrl();
  const contentW = W - marginL - marginR;
  const titulo = cuenta.presupuesto
    ? `CUENTA CORRIENTE N° ${String(cuenta.presupuesto.numero).padStart(4, '0')}`
    : 'CUENTA CORRIENTE';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = CONTENT_START_Y;

  const moneda = cuenta.moneda ?? 'ARS';
  const prefijo = moneda === 'USD' ? 'U$D ' : '$ ';
  const formatMonto = (n: number): string =>
    prefijo + Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const [azR, azG, azB] = hexToRgb(COLORS.azulCimadera);
  const [nR, nG, nB] = hexToRgb(COLORS.negroCimadera);
  const [grR, grG, grB] = hexToRgb(COLORS.grisCorporativo);
  const [gcR, gcG, gcB] = hexToRgb(COLORS.grisClaro);

  drawHeader(doc, titulo, logoDataUrl);

  const checkPage = (needed: number) => {
    if (y + needed > 275) {
      drawFooter(doc);
      doc.addPage();
      drawHeader(doc, titulo, logoDataUrl);
      y = CONTENT_START_Y;
    }
  };

  // ── DATOS CLIENTE / OBRA ──────────────────────────────────────────────
  const col1 = marginL;
  const colMid = marginL + contentW / 2;
  const col2 = colMid + 5;

  doc.setDrawColor(azR, azG, azB);
  doc.setLineWidth(0.5);
  doc.line(colMid, y, colMid, y + 32);

  doc.setTextColor(grR, grG, grB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CLIENTE', col1, y + 4);

  doc.setTextColor(nR, nG, nB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(cuenta.cliente.razonSocial, col1, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(grR, grG, grB);
  let clienteY = y + 15;
  if (cuenta.cliente.cuit) { doc.text(`CUIT: ${cuenta.cliente.cuit}`, col1, clienteY); clienteY += 4.5; }
  if (cuenta.cliente.email) { doc.text(cuenta.cliente.email, col1, clienteY); clienteY += 4.5; }
  if (cuenta.cliente.telefono) { doc.text(cuenta.cliente.telefono, col1, clienteY); }

  doc.setTextColor(grR, grG, grB);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('DETALLE', col2, y + 4);
  if (moneda === 'USD') {
    doc.setTextColor(22, 163, 74);
    doc.text('U$D USD', col2 + 22, y + 4);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(nR, nG, nB);
  let detalleY = y + 10;
  if (cuenta.presupuesto) {
    doc.text(
      `Presupuesto N° ${String(cuenta.presupuesto.numero).padStart(4, '0')}`,
      col2, detalleY,
    );
    detalleY += 5;
  }
  if (cuenta.obra) {
    doc.setFontSize(8);
    doc.setTextColor(grR, grG, grB);
    doc.text(`Obra: ${cuenta.obra.nombre}`, col2, detalleY);
    detalleY += 4.5;
    if (cuenta.obra.direccion) {
      doc.text(cuenta.obra.direccion, col2, detalleY);
      detalleY += 4.5;
    }
  }
  doc.setFontSize(8);
  doc.setTextColor(grR, grG, grB);
  doc.text(`Fecha inicio: ${fmtDate(cuenta.fechaInicio)}`, col2, detalleY);
  detalleY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const estadoLabel =
    cuenta.estado === 'CANCELADO' ? 'Saldado' :
    cuenta.estado === 'SALDO_PENDIENTE' ? 'Saldo Pendiente' : 'Pendiente';
  doc.text(`Estado: ${estadoLabel}`, col2, detalleY);

  y += 36;

  // ── SEPARADOR ─────────────────────────────────────────────────────────
  doc.setFillColor(azR, azG, azB);
  doc.rect(marginL, y, contentW, 0.5, 'F');
  y += 6;

  // ── SECCIÓN ÍNDICES ───────────────────────────────────────────────────
  checkPage(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(azR, azG, azB);
  doc.text('ÍNDICES', marginL, y);
  y += 5;

  const colW = contentW / 3;
  const labels = ['Índice inicio', 'Índice actual', 'Variación'];
  const variacion = ((cuenta.indiceActual / cuenta.indiceInicio - 1) * 100).toFixed(2);
  const values = [
    `${Number(cuenta.indiceInicio).toFixed(4)} (${cuenta.nombreIndice})`,
    `${Number(cuenta.indiceActual).toFixed(4)} (${cuenta.nombreIndice})`,
    `${variacion}%`,
  ];

  doc.setFillColor(azR, azG, azB);
  doc.rect(marginL, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  labels.forEach((lbl, i) => {
    doc.text(lbl, marginL + colW * i + 3, y + 4);
  });
  y += 6;

  doc.setFillColor(gcR, gcG, gcB);
  doc.rect(marginL, y, contentW, 7, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(nR, nG, nB);
  values.forEach((val, i) => {
    doc.text(val, marginL + colW * i + 3, y + 5);
  });
  y += 10;

  // ── RESUMEN FINANCIERO ────────────────────────────────────────────────
  checkPage(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(azR, azG, azB);
  doc.text('RESUMEN FINANCIERO', marginL, y);
  y += 5;

  const colW2 = contentW / 3;
  const totalCobrado = cuenta.movimientos
    .filter((m) => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL')
    .reduce((sum, m) => {
      if (moneda === 'USD' && m.equivalenteUSD != null) return sum + Math.abs(m.equivalenteUSD);
      return sum + Math.abs(Number(m.montoEnARS ?? m.monto));
    }, 0);

  const finLabels = ['Monto original', 'Total cobrado', 'Saldo actualizado'];
  const finValues = [
    formatMonto(Number(cuenta.montoOriginal)),
    formatMonto(totalCobrado),
    formatMonto(Number(cuenta.saldoActualizado)),
  ];
  const finColors: Array<[number, number, number]> = [
    hexToRgb(COLORS.negroCimadera),
    [22, 101, 52],
    [153, 27, 27],
  ];

  doc.setFillColor(azR, azG, azB);
  doc.rect(marginL, y, contentW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  finLabels.forEach((lbl, i) => {
    doc.text(lbl, marginL + colW2 * i + 3, y + 4);
  });
  y += 6;

  doc.setFillColor(gcR, gcG, gcB);
  doc.rect(marginL, y, contentW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  finValues.forEach((val, i) => {
    doc.setTextColor(...finColors[i]);
    doc.text(val, marginL + colW2 * i + 3, y + 5);
  });
  y += 7;

  // ── IVA breakdown (solo cuando aplica) ───────────────────────────────
  if (cuenta.tasaIvaContrato != null && cuenta.tasaIvaContrato > 0) {
    checkPage(14);
    const [amberR, amberG, amberB] = [146, 64, 14] as [number, number, number];
    const ivaRows = [
      { label: `Incluye IVA ${cuenta.tasaIvaContrato}%`, value: cuenta.montoContratoIva != null ? formatMonto(cuenta.montoContratoIva) : '—' },
      { label: 'Neto s/IVA', value: cuenta.montoContratoNeto != null ? formatMonto(cuenta.montoContratoNeto) : '—' },
    ];
    for (const row of ivaRows) {
      doc.setFillColor(255, 251, 235);
      doc.rect(marginL, y, contentW, 5.5, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(amberR, amberG, amberB);
      doc.text(row.label, marginL + 3, y + 4);
      doc.text(row.value, marginL + contentW - 3, y + 4, { align: 'right' });
      y += 5.5;
    }
    y += 1;
  }

  y += 5;

  // ── TABLA MOVIMIENTOS ─────────────────────────────────────────────────
  checkPage(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(azR, azG, azB);
  doc.text('MOVIMIENTOS', marginL, y);
  y += 4;

  const cols = {
    fecha: 22,
    tipo: 28,
    descripcion: 50,
    factura: 22,
    monto: 30,
    saldo: 28,
  };
  const colX = {
    fecha: marginL,
    tipo: marginL + cols.fecha,
    descripcion: marginL + cols.fecha + cols.tipo,
    factura: marginL + cols.fecha + cols.tipo + cols.descripcion,
    monto: marginL + cols.fecha + cols.tipo + cols.descripcion + cols.factura,
    saldo: marginL + cols.fecha + cols.tipo + cols.descripcion + cols.factura + cols.monto,
  };

  doc.setFillColor(azR, azG, azB);
  doc.rect(marginL, y, contentW, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Fecha', colX.fecha + 1, y + 4.5);
  doc.text('Tipo', colX.tipo + 1, y + 4.5);
  doc.text('Descripción', colX.descripcion + 1, y + 4.5);
  doc.text('N° Factura', colX.factura + 1, y + 4.5);
  doc.text('Monto', colX.monto + cols.monto - 2, y + 4.5, { align: 'right' });
  doc.text('Saldo', colX.saldo + cols.saldo - 2, y + 4.5, { align: 'right' });
  y += 6.5;

  const tipoLabel: Record<string, string> = {
    CARGO_INICIAL: 'Cargo inicial',
    ANTICIPO: 'Anticipo',
    PAGO_PARCIAL: 'Pago parcial',
    ACTUALIZACION: 'Actualización',
  };

  let altBg = false;
  for (const mov of cuenta.movimientos) {
    const hasTCDetail = !!(mov.tipoCambio && mov.caja && (
      (moneda === 'USD' && mov.caja === 'ARS') ||
      (moneda === 'ARS' && mov.caja === 'USD')
    ));
    checkPage(hasTCDetail ? 12 : 8);
    const rowH = 6.5;
    const [bgR, bgG, bgB] = altBg ? [248, 248, 248] : [255, 255, 255];
    doc.setFillColor(bgR, bgG, bgB);
    doc.rect(marginL, y, contentW, rowH, 'F');
    altBg = !altBg;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(grR, grG, grB);
    doc.text(fmtDate(mov.fecha), colX.fecha + 1, y + 4.5);
    doc.text(tipoLabel[mov.tipo] ?? mov.tipo, colX.tipo + 1, y + 4.5);

    const descLines = doc.splitTextToSize(mov.descripcion, cols.descripcion - 2);
    doc.text(descLines[0] ?? '', colX.descripcion + 1, y + 4.5);
    doc.text(mov.numeroFactura ?? '—', colX.factura + 1, y + 4.5);

    const isReduccion = mov.tipo === 'ANTICIPO' || mov.tipo === 'PAGO_PARCIAL';
    // Para cuenta ARS con pago en caja USD: mostrar USD original (solo display).
    // montoPesos = montoEnARS ?? monto; montoUsd = montoPesos / tipoCambio.
    const esCobroUSDEnPesos = isReduccion && moneda === 'ARS' && mov.caja === 'USD' && mov.tipoCambio != null;
    let montoStr: string;
    if (esCobroUSDEnPesos) {
      const montoPesos = Math.abs(Number(mov.montoEnARS ?? mov.monto));
      const montoUsd = montoPesos / Number(mov.tipoCambio);
      montoStr = '-U$D ' + montoUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
      const montoDisplay = isReduccion
        ? (moneda === 'USD' && mov.equivalenteUSD != null
            ? Math.abs(mov.equivalenteUSD)
            : Math.abs(Number(mov.montoEnARS ?? mov.monto)))
        : Math.abs(Number(mov.monto));
      montoStr = (isReduccion ? '-' : '+') + prefijo +
        montoDisplay.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    doc.setTextColor(isReduccion ? 22 : nR, isReduccion ? 101 : nG, isReduccion ? 52 : nB);
    doc.text(montoStr, colX.monto + cols.monto - 2, y + 4.5, { align: 'right' });

    doc.setTextColor(nR, nG, nB);
    doc.text(formatMonto(Number(mov.saldoResultante)), colX.saldo + cols.saldo - 2, y + 4.5, { align: 'right' });

    y += rowH;

    if (hasTCDetail) {
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      const tcVal = Number(mov.tipoCambio);
      let tcLine = '';
      if (moneda === 'USD' && mov.caja === 'ARS') {
        const arsAmt = Math.abs(Number(mov.montoEnARS ?? mov.monto));
        tcLine = `$ ${arsAmt.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS ÷ TC $${tcVal.toLocaleString('es-AR')}`;
      } else if (moneda === 'ARS' && mov.caja === 'USD') {
        const montoPesos = Math.abs(Number(mov.montoEnARS ?? mov.monto));
        tcLine = `Equiv.: $ ${montoPesos.toLocaleString('es-AR', { minimumFractionDigits: 2 })} · TC $${tcVal.toLocaleString('es-AR')}`;
      }
      if (tcLine) {
        doc.text(tcLine, colX.descripcion + 1, y);
        y += 3.5;
      }
    }
  }

  const [sepR, sepG, sepB] = hexToRgb(COLORS.grisSeparador);
  doc.setDrawColor(sepR, sepG, sepB);
  doc.setLineWidth(0.3);
  doc.line(marginL, y, marginL + contentW, y);
  y += 8;

  // ── OBSERVACIONES ─────────────────────────────────────────────────────
  if (cuenta.observaciones) {
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
    const lines = doc.splitTextToSize(cuenta.observaciones, contentW - 6);
    doc.text(lines, marginL + 3, y + 10);
    y += 22;
  }

  drawFooter(doc);

  const clienteSlug = cuenta.cliente.razonSocial
    .trim()
    .split(/\s+/)
    .slice(-1)[0]
    .replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ0-9]/g, '');
  const numStr = cuenta.presupuesto
    ? String(cuenta.presupuesto.numero).padStart(4, '0')
    : cuenta.id.slice(-6);
  doc.save(`cuenta-corriente-${numStr}-${clienteSlug}.pdf`);
}
