import { jsPDF } from 'jspdf';

export type CostoPDF = {
  id: string;
  nombre: string;
  categoria: string;
  moneda: string;
  monto: number;
  observacion?: string | null;
};

export type SnapshotDatos = {
  totalesPorCategoria: Record<string, { ARS: number; USD: number }>;
  totalARS: number;
  totalUSD: number;
};

const COLORS = {
  azulCimadera: '#00ADEF',
  negroCimadera: '#1A1A1A',
  grisCorporativo: '#4A4A4A',
  grisSeparador: '#CCCCCC',
  grisClaro: '#F5F5F5',
};

function hex(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

const W = 210;
const ML = 15;
const MR = 15;
const CW = W - ML - MR;
const HEADER_H = 25;
const CS = 35;

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
const fmtUSD = (n: number) =>
  `U$D ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)}`;

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Paleta de colores para categorías en el gráfico de barras
const CAT_COLORS: [number, number, number][] = [
  [0, 173, 239],   // azul cimadera
  [39, 80, 10],    // verde oscuro
  [121, 31, 31],   // rojo oscuro
  [99, 153, 34],   // verde
  [180, 120, 0],   // naranja
  [80, 40, 120],   // violeta
  [40, 100, 160],  // azul medio
];

function drawHeader(doc: jsPDF, titulo: string) {
  const [nR, nG, nB] = hex(COLORS.negroCimadera);
  const [grR, grG, grB] = hex(COLORS.grisCorporativo);
  const [azR, azG, azB] = hex(COLORS.azulCimadera);
  const [sepR, sepG, sepB] = hex(COLORS.grisSeparador);
  const baseY = HEADER_H - 8;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, HEADER_H, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(nR, nG, nB);
  doc.text('CIMAdera', ML, baseY);
  const cw = doc.getTextWidth('CIMAdera');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(' S.A.', ML + cw, baseY);
  doc.setFontSize(7.5);
  doc.setTextColor(grR, grG, grB);
  doc.text('ventas.cimadera.net  ·  coordinacion.general@cimadera.net  ·  261 635-0017', ML, baseY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(azR, azG, azB);
  doc.text(titulo, W - MR, baseY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(grR, grG, grB);
  doc.text('Las Heras, Mendoza, Argentina', W - MR, baseY + 5, { align: 'right' });
  doc.setDrawColor(sepR, sepG, sepB);
  doc.setLineWidth(0.4);
  doc.line(ML, HEADER_H + 2, W - MR, HEADER_H + 2);
}

function drawFooter(doc: jsPDF) {
  const [azR, azG, azB] = hex(COLORS.azulCimadera);
  doc.setFillColor(azR, azG, azB);
  doc.rect(0, 282, W, 15, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('CIMAdera S.A.  ·  Las Heras, Mendoza  ·  coordinacion.general@cimadera.net  ·  261 635-0017', W / 2, 288, { align: 'center' });
  doc.text('Certificación ISO 9001:2015  ·  Bureau Veritas', W / 2, 293, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  const pgs = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  doc.text(`Página ${pgs}`, W - MR, 288, { align: 'right' });
}

export function generarPDFCostosFijos(
  costos: CostoPDF[],
  prevSnapshot: SnapshotDatos | null,
): void {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const anio = now.getFullYear();
  const titulo = `INFORME DE COSTOS FIJOS — ${MESES[mes - 1].toUpperCase()} ${anio}`;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const [azR, azG, azB] = hex(COLORS.azulCimadera);
  const [nR, nG, nB] = hex(COLORS.negroCimadera);
  const [grR, grG, grB] = hex(COLORS.grisCorporativo);
  const [gcR, gcG, gcB] = hex(COLORS.grisClaro);
  const [sepR, sepG, sepB] = hex(COLORS.grisSeparador);

  drawHeader(doc, titulo);
  let y = CS;

  const checkPage = (needed: number) => {
    if (y + needed > 275) {
      drawFooter(doc);
      doc.addPage();
      drawHeader(doc, titulo);
      y = CS;
    }
  };

  // ── Totales ────────────────────────────────────────────────────────────────
  const costosActivos = costos.filter(() => true);
  const totalARS = costosActivos.filter((c) => c.moneda === 'ARS').reduce((s, c) => s + c.monto, 0);
  const totalUSD = costosActivos.filter((c) => c.moneda === 'USD').reduce((s, c) => s + c.monto, 0);

  // Agrupa por categoría
  const categorias = Array.from(new Set(costosActivos.map((c) => c.categoria))).sort();
  type CatTotal = { ARS: number; USD: number; costos: CostoPDF[] };
  const porCategoria: Record<string, CatTotal> = {};
  for (const cat of categorias) {
    const items = costosActivos.filter((c) => c.categoria === cat);
    porCategoria[cat] = {
      ARS: items.filter((c) => c.moneda === 'ARS').reduce((s, c) => s + c.monto, 0),
      USD: items.filter((c) => c.moneda === 'USD').reduce((s, c) => s + c.monto, 0),
      costos: items,
    };
  }

  // ── RESUMEN EJECUTIVO ──────────────────────────────────────────────────────
  checkPage(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(nR, nG, nB);
  doc.text('RESUMEN EJECUTIVO', ML, y);
  y += 6;

  const kpis = [
    { label: 'Total mensual ARS', valor: fmtARS(totalARS) },
    { label: 'Total mensual USD', valor: fmtUSD(totalUSD) },
    { label: 'Costos activos', valor: String(costosActivos.length) },
    { label: 'Costo semanal ARS', valor: fmtARS(totalARS / 4.33) },
  ];
  const cardW = CW / 4 - 2;
  kpis.forEach((kpi, i) => {
    const x = ML + i * (cardW + 2.67);
    doc.setFillColor(gcR, gcG, gcB);
    doc.roundedRect(x, y, cardW, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(grR, grG, grB);
    doc.text(kpi.label, x + cardW / 2, y + 6, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(nR, nG, nB);
    doc.text(kpi.valor, x + cardW / 2, y + 14, { align: 'center' });
  });
  y += 24;

  // ── TABLA POR CATEGORÍA ────────────────────────────────────────────────────
  checkPage(12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(nR, nG, nB);
  doc.text('DETALLE POR CATEGORÍA', ML, y);
  y += 5;

  for (const cat of categorias) {
    const data = porCategoria[cat];
    checkPage(16);

    // Header categoría
    doc.setFillColor(azR, azG, azB);
    doc.rect(ML, y, CW, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`${cat.toUpperCase()}  (${data.costos.length} ítem${data.costos.length !== 1 ? 's' : ''})`, ML + 3, y + 5);
    y += 7;

    // Columnas
    const cols = { nombre: 0, moneda: 80, monto: 110, obs: 140 };
    data.costos.forEach((c, idx) => {
      checkPage(8);
      if (idx % 2 === 0) {
        doc.setFillColor(gcR, gcG, gcB);
        doc.rect(ML, y, CW, 6, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(nR, nG, nB);
      doc.text(c.nombre, ML + 3 + cols.nombre, y + 4.5);
      doc.text(c.moneda, ML + 3 + cols.moneda, y + 4.5);
      doc.setFont('helvetica', 'bold');
      doc.text(c.moneda === 'ARS' ? fmtARS(c.monto) : fmtUSD(c.monto), ML + 3 + cols.monto, y + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(grR, grG, grB);
      const obs = c.observacion ?? '';
      doc.text(obs.length > 28 ? obs.slice(0, 25) + '…' : obs, ML + 3 + cols.obs, y + 4.5);
      y += 6;
    });

    // Subtotal categoría
    checkPage(8);
    doc.setDrawColor(sepR, sepG, sepB);
    doc.setLineWidth(0.2);
    doc.line(ML, y, W - MR, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(nR, nG, nB);
    doc.text('Subtotal:', ML + 3, y + 5);
    const stParts: string[] = [];
    if (data.ARS > 0) stParts.push(fmtARS(data.ARS));
    if (data.USD > 0) stParts.push(fmtUSD(data.USD));
    doc.text(stParts.join('  /  '), ML + 3 + cols.monto, y + 5);
    y += 9;
  }

  // ── GRÁFICO DE BARRAS (texto) ──────────────────────────────────────────────
  checkPage(20);
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(nR, nG, nB);
  doc.text('DISTRIBUCIÓN POR CATEGORÍA (ARS)', ML, y);
  y += 6;

  const totalARSCats = Object.values(porCategoria).reduce((s, d) => s + d.ARS, 0) || 1;
  categorias.forEach((cat, i) => {
    const data = porCategoria[cat];
    if (data.ARS === 0) return;
    checkPage(8);
    const pct = Math.round((data.ARS / totalARSCats) * 100);
    const blocks = Math.max(1, Math.round(pct / 4));
    const bar = '█'.repeat(blocks);
    const color = CAT_COLORS[i % CAT_COLORS.length];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...color);
    doc.text(`${bar.padEnd(26)} ${cat} ${pct}% — ${fmtARS(data.ARS)}`, ML, y);
    y += 6;
  });

  // ── ANÁLISIS DE INCREMENTOS ────────────────────────────────────────────────
  checkPage(20);
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(nR, nG, nB);
  doc.text('ANÁLISIS RESPECTO AL PERÍODO ANTERIOR', ML, y);
  y += 6;

  if (!prevSnapshot) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(grR, grG, grB);
    doc.text('Sin datos del período anterior para comparar.', ML, y);
    y += 6;
  } else {
    const prev = prevSnapshot.totalesPorCategoria ?? {};
    let hayComparacion = false;
    categorias.forEach((cat) => {
      const curr = porCategoria[cat].ARS;
      const prevVal = (prev[cat]?.ARS ?? 0);
      if (prevVal === 0) return;
      const diff = ((curr - prevVal) / prevVal) * 100;
      if (Math.abs(diff) < 0.5) return;
      checkPage(7);
      hayComparacion = true;
      const isUp = diff > 0;
      const color: [number, number, number] = isUp ? [180, 100, 0] : [39, 80, 10];
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...color);
      const arrow = isUp ? '↑' : '↓';
      const sign = isUp ? '+' : '';
      doc.text(`${arrow} ${cat}: ${sign}${diff.toFixed(1)}% (${fmtARS(prevVal)} → ${fmtARS(curr)})`, ML, y);
      y += 6;
    });
    if (!hayComparacion) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(grR, grG, grB);
      doc.text('Sin variaciones significativas respecto al período anterior.', ML, y);
      y += 6;
    }
  }

  drawFooter(doc);

  const mm = String(mes).padStart(2, '0');
  doc.save(`CostosFijos-${mm}${anio}.pdf`);
}

export function buildSnapshotDatos(costos: CostoPDF[]): SnapshotDatos {
  const categorias = Array.from(new Set(costos.map((c) => c.categoria)));
  const totalesPorCategoria: Record<string, { ARS: number; USD: number }> = {};
  for (const cat of categorias) {
    const items = costos.filter((c) => c.categoria === cat);
    totalesPorCategoria[cat] = {
      ARS: items.filter((c) => c.moneda === 'ARS').reduce((s, c) => s + c.monto, 0),
      USD: items.filter((c) => c.moneda === 'USD').reduce((s, c) => s + c.monto, 0),
    };
  }
  return {
    totalesPorCategoria,
    totalARS: costos.filter((c) => c.moneda === 'ARS').reduce((s, c) => s + c.monto, 0),
    totalUSD: costos.filter((c) => c.moneda === 'USD').reduce((s, c) => s + c.monto, 0),
  };
}
