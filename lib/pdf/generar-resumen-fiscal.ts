import { jsPDF } from 'jspdf';

type FilaFiscal = {
  periodo: string;
  neto0: number;
  neto105: number;
  neto21: number;
  iva105: number;
  iva21: number;
  totalConIva: number;
};

type TotalesFiscal = {
  netoTotal: number;
  neto0Total: number;
  neto105Total: number;
  neto21Total: number;
  iva105Total: number;
  iva21Total: number;
  ivaTotal: number;
  totalConIvaTotal: number;
};

type ResumenFiscalPDFParams = {
  filas: FilaFiscal[];
  totales: TotalesFiscal;
  has105: boolean;
  periodo: string;
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

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n);

function periodoLabel(key: string): string {
  if (/^\d{4}$/.test(key)) return key;
  const [yyyy, mm] = key.split('-');
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${meses[Number(mm) - 1]} ${yyyy}`;
}

const W = 210;
const marginL = 12;
const marginR = 12;
const HEADER_H = 25;
const CONTENT_START_Y = 35;

function drawHeader(doc: jsPDF, periodo: string) {
  const [nR, nG, nB] = hexToRgb(COLORS.negroCimadera);
  const [grR, grG, grB] = hexToRgb(COLORS.grisCorporativo);
  const [azR, azG, azB] = hexToRgb(COLORS.azulCimadera);
  const [sepR, sepG, sepB] = hexToRgb(COLORS.grisSeparador);

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, HEADER_H, 'F');

  const baseY = HEADER_H - 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(nR, nG, nB);
  doc.text('CIMAdera', marginL, baseY);

  const cimaderaWidth = doc.getTextWidth('CIMAdera');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(nR, nG, nB);
  doc.text(' S.A.', marginL + cimaderaWidth, baseY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(grR, grG, grB);
  doc.text(
    'ventas.cimadera.net  ·  coordinacion.general@cimadera.net  ·  261 635-0017',
    marginL, baseY + 5,
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(azR, azG, azB);
  doc.text('RESUMEN FISCAL', W - marginR, baseY - 3, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(grR, grG, grB);
  doc.text(periodo, W - marginR, baseY + 3, { align: 'right' });

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
  doc.text('Incluye únicamente presupuestos en estado Aprobado', W / 2, 293, { align: 'center' });
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  doc.setFont('helvetica', 'bold');
  doc.text(`Página ${pageCount}`, W - marginR, 288, { align: 'right' });
}

export function generarResumenFiscalPDF({ filas, totales, has105, periodo }: ResumenFiscalPDFParams): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = 297;
  const contentW = pageW - marginL - marginR;

  const [azR, azG, azB] = hexToRgb(COLORS.azulCimadera);
  const [nR, nG, nB] = hexToRgb(COLORS.negroCimadera);
  const [grR, grG, grB] = hexToRgb(COLORS.grisCorporativo);
  const [gcR, gcG, gcB] = hexToRgb(COLORS.grisClaro);

  drawHeader(doc, periodo);
  let y = CONTENT_START_Y;

  const checkPage = (needed: number) => {
    if (y + needed > 190) {
      drawFooter(doc);
      doc.addPage();
      drawHeader(doc, periodo);
      y = CONTENT_START_Y;
    }
  };

  // Column layout
  const cols = has105
    ? ['Período', 'Neto 0%', 'Neto 10,5%', 'IVA 10,5%', 'Neto 21%', 'IVA 21%', 'Total c/IVA']
    : ['Período', 'Neto 0%', 'Neto 21%', 'IVA 21%', 'Total c/IVA'];

  const colCount = cols.length;
  const periodoColW = 40;
  const remainingW = contentW - periodoColW;
  const numColW = remainingW / (colCount - 1);

  const colX = (i: number) => {
    if (i === 0) return marginL;
    return marginL + periodoColW + numColW * (i - 1);
  };

  // Table header
  checkPage(12);
  doc.setFillColor(azR, azG, azB);
  doc.rect(marginL, y, contentW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);

  cols.forEach((col, i) => {
    if (i === 0) {
      doc.text(col, colX(i) + 2, y + 4.8);
    } else {
      doc.text(col, colX(i) + numColW - 2, y + 4.8, { align: 'right' });
    }
  });
  y += 7;

  // Rows
  let altBg = false;
  for (const f of filas) {
    checkPage(7);

    const [bgR, bgG, bgB] = altBg ? [248, 248, 248] : [255, 255, 255];
    altBg = !altBg;
    doc.setFillColor(bgR, bgG, bgB);
    doc.rect(marginL, y, contentW, 6.5, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(nR, nG, nB);
    doc.text(periodoLabel(f.periodo), colX(0) + 2, y + 4.3);

    const rowValues = has105
      ? [f.neto0, f.neto105, f.iva105, f.neto21, f.iva21, f.totalConIva]
      : [f.neto0, f.neto21, f.iva21, f.totalConIva];

    rowValues.forEach((val, i) => {
      const colIdx = i + 1;
      const isTotal = colIdx === colCount - 1;
      doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
      doc.setTextColor(isTotal ? azR : (val > 0 ? nR : grR), isTotal ? azG : (val > 0 ? nG : grG), isTotal ? azB : (val > 0 ? nB : grB));
      doc.text(val > 0 ? fmtCurrency(val) : '—', colX(colIdx) + numColW - 2, y + 4.3, { align: 'right' });
    });

    // Row border
    const [bdrR, bdrG, bdrB] = hexToRgb(COLORS.grisSeparador);
    doc.setDrawColor(bdrR, bdrG, bdrB);
    doc.setLineWidth(0.2);
    doc.line(marginL, y + 6.5, marginL + contentW, y + 6.5);

    y += 6.5;
  }

  // Totals row (only if more than 1 fila)
  if (filas.length > 1) {
    checkPage(9);
    doc.setFillColor(gcR, gcG, gcB);
    doc.rect(marginL, y, contentW, 8, 'F');
    doc.setDrawColor(azR, azG, azB);
    doc.setLineWidth(0.5);
    doc.line(marginL, y, marginL + contentW, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(nR, nG, nB);
    doc.text('TOTAL', colX(0) + 2, y + 5.3);

    const totValues = has105
      ? [totales.neto0Total, totales.neto105Total, totales.iva105Total, totales.neto21Total, totales.iva21Total, totales.totalConIvaTotal]
      : [totales.neto0Total, totales.neto21Total, totales.iva21Total, totales.totalConIvaTotal];

    totValues.forEach((val, i) => {
      const colIdx = i + 1;
      const isTotal = colIdx === colCount - 1;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(isTotal ? azR : nR, isTotal ? azG : nG, isTotal ? azB : nB);
      doc.text(fmtCurrency(val), colX(colIdx) + numColW - 2, y + 5.3, { align: 'right' });
    });

    y += 8;
  }

  // Summary box
  checkPage(30);
  y += 6;
  const boxW = 100;
  const boxX = marginL + contentW - boxW;

  doc.setFillColor(gcR, gcG, gcB);
  doc.setDrawColor(azR, azG, azB);
  doc.setLineWidth(0.3);
  doc.rect(boxX, y, boxW, has105 ? 28 : 22, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(azR, azG, azB);
  doc.text('RESUMEN', boxX + 3, y + 5);

  const labelX = boxX + 3;
  const valX = boxX + boxW - 3;
  let sy = y + 10;
  const rowH = 5;

  const summaryRows: [string, number][] = [
    ['Neto total vendido:', totales.netoTotal],
    ['Neto exento (0%):', totales.neto0Total],
    ...(has105 ? [['Neto gravado 10,5%:', totales.neto105Total] as [string, number]] : []),
    ['Neto gravado 21%:', totales.neto21Total],
    ['IVA generado total:', totales.ivaTotal],
  ];

  summaryRows.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(grR, grG, grB);
    doc.text(label, labelX, sy);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(nR, nG, nB);
    doc.text(fmtCurrency(val), valX, sy, { align: 'right' });
    sy += rowH;
  });

  drawFooter(doc);

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  doc.save(`ResumenFiscal-${periodo.replace(/\s+/g, '-')}-${dd}${mm}${yyyy}.pdf`);
}
