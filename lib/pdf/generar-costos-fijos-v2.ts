import { jsPDF } from 'jspdf';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const W = 210, ML = 15, MR = 15, CW = W - ML - MR, HEADER_H = 25, CS = 35;

type MesData = { mes: number; estimadoARS: number; realARS: number; estimadoUSD: number; realUSD: number };
type CatCosto = { id: string; nombre: string; moneda: string; registros: { mes: number; montoEstimado: number | null; montoReal: number | null }[] };
type CatData = { categoria: string; costos: CatCosto[]; mesTotales: { mes: number; estARS: number; realARS: number; estUSD: number; realUSD: number }[] };
export type InformeData = { anio: number; mesDesde: number; mesHasta: number; tipoCambio: number; resumenMensual: MesData[]; porCategoria: CatData[]; totalCostos: number };

const fmtARS = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const fmtUSD = (n: number) => `U$D ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)}`;

function hex(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
const AZ = hex('#00ADEF'), NK = hex('#1A1A1A'), GR = hex('#4A4A4A'), GC = hex('#F5F5F5'), SP = hex('#CCCCCC');

function drawHeader(doc: jsPDF, titulo: string) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, HEADER_H, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...NK);
  doc.text('CIMAdera', ML, HEADER_H - 8);
  const cw = doc.getTextWidth('CIMAdera');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
  doc.text(' S.A.', ML + cw, HEADER_H - 8);
  doc.setFontSize(7.5); doc.setTextColor(...GR);
  doc.text('ventas.cimadera.net  ·  coordinacion.general@cimadera.net  ·  261 635-0017', ML, HEADER_H - 3);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...AZ);
  doc.text(titulo, W - MR, HEADER_H - 8, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GR);
  doc.text('Las Heras, Mendoza, Argentina', W - MR, HEADER_H - 3, { align: 'right' });
  doc.setDrawColor(...SP); doc.setLineWidth(0.4);
  doc.line(ML, HEADER_H + 2, W - MR, HEADER_H + 2);
}

function drawFooter(doc: jsPDF) {
  doc.setFillColor(...AZ);
  doc.rect(0, 282, W, 15, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
  doc.text('CIMAdera S.A.  ·  Las Heras, Mendoza  ·  coordinacion.general@cimadera.net  ·  261 635-0017', W / 2, 288, { align: 'center' });
  doc.text('Certificación ISO 9001:2015  ·  Bureau Veritas', W / 2, 293, { align: 'center' });
  const pg = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages();
  doc.setFont('helvetica', 'bold');
  doc.text(`Página ${pg}`, W - MR, 288, { align: 'right' });
}

function pct(est: number, real: number): string {
  if (!est) return '—';
  const d = ((real - est) / est) * 100;
  return `${d > 0 ? '+' : ''}${d.toFixed(1)}%`;
}
function pctColor(est: number, real: number): [number, number, number] {
  if (!est) return GR;
  const d = ((real - est) / est) * 100;
  return d <= -5 ? [39, 120, 10] : d <= 5 ? [180, 130, 0] : [180, 30, 30];
}

export function generarPDFCostosFijosV2(data: InformeData): void {
  const { anio, mesDesde, mesHasta, tipoCambio, resumenMensual, porCategoria, totalCostos } = data;
  const rango = mesDesde === mesHasta
    ? `${MESES[mesDesde - 1]} ${anio}`
    : `${MESES[mesDesde - 1]}–${MESES[mesHasta - 1]} ${anio}`;
  const titulo = `INFORME DE COSTOS FIJOS — ${rango.toUpperCase()}`;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const newPage = () => { drawFooter(doc); doc.addPage(); drawHeader(doc, titulo); return CS; };
  const check = (y: number, needed: number) => (y + needed > 275 ? newPage() : y);

  // ── PORTADA ───────────────────────────────────────────────────────────────
  drawHeader(doc, titulo);
  let y = CS + 10;

  doc.setFillColor(...AZ);
  doc.rect(ML, y, CW, 28, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(255, 255, 255);
  doc.text('CIMAdera S.A.', W / 2, y + 9, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`INFORME DE COSTOS FIJOS — ${rango.toUpperCase()}`, W / 2, y + 17, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text(`TC usado: $${tipoCambio.toLocaleString('es-AR')} ARS/USD`, W / 2, y + 24, { align: 'center' });
  y += 34;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GR);
  doc.text(`Generado el ${new Date().toLocaleDateString('es-AR')} a las ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`, ML, y);
  y += 10;

  // ── RESUMEN EJECUTIVO ─────────────────────────────────────────────────────
  const totEstARS = resumenMensual.reduce((s, m) => s + m.estimadoARS, 0);
  const totRealARS = resumenMensual.reduce((s, m) => s + m.realARS, 0);
  const totEstUSD = resumenMensual.reduce((s, m) => s + m.estimadoUSD, 0);
  const totRealUSD = resumenMensual.reduce((s, m) => s + m.realUSD, 0);
  const totEstTotal = totEstARS + totEstUSD * tipoCambio;
  const totRealTotal = totRealARS + totRealUSD * tipoCambio;

  y = check(y, 36);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...NK);
  doc.text('RESUMEN EJECUTIVO', ML, y); y += 6;

  const kpis = [
    { label: 'Acumulado real (ARS eq.)', valor: fmtARS(totRealTotal) },
    { label: 'Acumulado estimado (ARS eq.)', valor: fmtARS(totEstTotal) },
    { label: 'Costos activos', valor: String(totalCostos) },
    { label: 'Desvío total', valor: pct(totEstTotal, totRealTotal) },
  ];
  const cardW = CW / 4 - 2;
  kpis.forEach((k, i) => {
    const x = ML + i * (cardW + 2.67);
    doc.setFillColor(...GC); doc.roundedRect(x, y, cardW, 20, 2, 2, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...GR);
    doc.text(k.label, x + cardW / 2, y + 7, { align: 'center' });
    const isDesvio = i === 3;
    const color: [number, number, number] = isDesvio ? pctColor(totEstTotal, totRealTotal) : NK;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...color);
    doc.text(k.valor, x + cardW / 2, y + 15, { align: 'center' });
  });
  y += 26;

  // ── TABLA POR MES ─────────────────────────────────────────────────────────
  y = check(y, 16);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...NK);
  doc.text('DETALLE POR MES', ML, y); y += 5;

  // Header row
  const colsMes = { mes: 0, estARS: 30, realARS: 65, estUSD: 100, realUSD: 128, total: 155, dev: 178 };
  doc.setFillColor(...AZ);
  doc.rect(ML, y, CW, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
  ['Mes', 'Est. ARS', 'Real ARS', 'Est. USD', 'Real USD', 'Total ARS eq.', 'Desvío'].forEach((h, i) => {
    const x = ML + Object.values(colsMes)[i];
    doc.text(h, x + 2, y + 5);
  });
  y += 7;

  resumenMensual.forEach((m, idx) => {
    y = check(y, 7);
    if (idx % 2 === 0) { doc.setFillColor(...GC); doc.rect(ML, y, CW, 6, 'F'); }
    const totARS = m.realARS + m.realUSD * tipoCambio;
    const totEst = m.estimadoARS + m.estimadoUSD * tipoCambio;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...NK);
    doc.text(MESES[m.mes - 1], ML + colsMes.mes + 2, y + 4.5);
    doc.text(m.estimadoARS > 0 ? fmtARS(m.estimadoARS) : '—', ML + colsMes.estARS + 2, y + 4.5);
    doc.text(m.realARS > 0 ? fmtARS(m.realARS) : '—', ML + colsMes.realARS + 2, y + 4.5);
    doc.text(m.estimadoUSD > 0 ? fmtUSD(m.estimadoUSD) : '—', ML + colsMes.estUSD + 2, y + 4.5);
    doc.text(m.realUSD > 0 ? fmtUSD(m.realUSD) : '—', ML + colsMes.realUSD + 2, y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.text(totARS > 0 ? fmtARS(totARS) : '—', ML + colsMes.total + 2, y + 4.5);
    const dStr = pct(totEst, totARS);
    doc.setTextColor(...(totEst > 0 ? pctColor(totEst, totARS) : GR));
    doc.text(dStr, ML + colsMes.dev + 2, y + 4.5);
    doc.setTextColor(...NK);
    y += 6;
  });
  y += 4;

  // ── GRÁFICO DE BARRAS ─────────────────────────────────────────────────────
  y = check(y, 60);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...NK);
  doc.text('FLUJO TOTAL MES A MES (ARS equivalente)', ML, y); y += 6;

  const chartH = 40;
  const barW = Math.min(18, (CW - 4) / resumenMensual.length - 2);
  const maxVal = Math.max(...resumenMensual.flatMap((m) => [
    m.estimadoARS + m.estimadoUSD * tipoCambio,
    m.realARS + m.realUSD * tipoCambio,
  ]), 1);

  resumenMensual.forEach((m, i) => {
    const estTotal = m.estimadoARS + m.estimadoUSD * tipoCambio;
    const realTotal = m.realARS + m.realUSD * tipoCambio;
    const x = ML + i * (barW * 2 + 3);
    const hEst = (estTotal / maxVal) * chartH;
    const hReal = (realTotal / maxVal) * chartH;

    // Estimado bar (grey)
    doc.setFillColor(200, 200, 200);
    doc.rect(x, y + chartH - hEst, barW, hEst, 'F');
    // Real bar (blue)
    doc.setFillColor(...AZ);
    doc.rect(x + barW + 1, y + chartH - hReal, barW, hReal, 'F');
    // Label
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(...GR);
    doc.text(MESES[m.mes - 1].slice(0, 3), x, y + chartH + 4);
  });

  // Legend
  y += chartH + 8;
  doc.setFillColor(200, 200, 200); doc.rect(ML, y, 6, 4, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...GR);
  doc.text('Estimado', ML + 8, y + 3.5);
  doc.setFillColor(...AZ); doc.rect(ML + 32, y, 6, 4, 'F');
  doc.text('Real', ML + 40, y + 3.5);
  y += 10;

  // ── SECCIÓN POR CATEGORÍA ─────────────────────────────────────────────────
  y = check(y, 16);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...NK);
  doc.text('DETALLE POR CATEGORÍA', ML, y); y += 5;

  for (const cat of porCategoria) {
    y = check(y, 18);
    doc.setFillColor(...AZ); doc.rect(ML, y, CW, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
    doc.text(`${cat.categoria.toUpperCase()}  (${cat.costos.length} ítem${cat.costos.length !== 1 ? 's' : ''})`, ML + 3, y + 5);
    y += 7;

    // Sub-header
    doc.setFillColor(230, 235, 245); doc.rect(ML, y, CW, 6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...GR);
    doc.text('Nombre', ML + 3, y + 4.5);
    doc.text('Moneda', ML + 73, y + 4.5);
    resumenMensual.forEach((m, i) => {
      doc.text(MESES[m.mes - 1].slice(0, 3), ML + 90 + i * 18, y + 4.5);
    });
    y += 6;

    for (const costo of cat.costos) {
      y = check(y, 7);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...NK);
      doc.text(costo.nombre.length > 34 ? costo.nombre.slice(0, 31) + '…' : costo.nombre, ML + 3, y + 4.5);
      doc.setTextColor(...GR);
      doc.text(costo.moneda, ML + 73, y + 4.5);
      resumenMensual.forEach((m, i) => {
        const reg = costo.registros.find((r) => r.mes === m.mes);
        const val = reg?.montoReal ?? reg?.montoEstimado;
        doc.setFont('helvetica', val != null && reg?.montoReal == null ? 'italic' : 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(val != null && reg?.montoReal == null ? 150 : 30, 30, 30);
        doc.text(val != null ? (costo.moneda === 'USD' ? fmtUSD(val) : fmtARS(val)).replace('$ ', '').replace('$', '') : '—', ML + 90 + i * 18, y + 4.5);
      });
      y += 6;
    }

    // Subtotales por mes
    y = check(y, 7);
    doc.setDrawColor(...SP); doc.setLineWidth(0.2); doc.line(ML, y, W - MR, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...NK);
    doc.text('Subtotal:', ML + 3, y + 5);
    cat.mesTotales.forEach((mt, i) => {
      const t = mt.realARS + mt.realUSD * tipoCambio;
      doc.text(t > 0 ? fmtARS(t).replace('$ ', '').replace('$', '') : '—', ML + 90 + i * 18, y + 5);
    });
    y += 9;
  }

  drawFooter(doc);

  const d = new Date();
  const fecha = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  doc.save(`CostosFijos-${rango.replace(/\s/g, '')}-${fecha}.pdf`);
}
