import { jsPDF } from 'jspdf';
import { loadLogoDataUrl } from './logo';

export interface MovimientoClientePDF {
  fecha: string;
  tipo: string;
  descripcion: string;
  monto: number;
  montoEnARS?: number | null;
  equivalenteUSD?: number | null;
  saldoResultante: number;
  numeroFactura?: string | null;
  tipoCambio?: number | null;
  caja?: string | null;
}

export interface CuentaClientePDF {
  id: string;
  moneda?: string;
  montoOriginal: number;
  indiceInicio: number;
  indiceActual: number;
  nombreIndice: string;
  saldoActualizado: number;
  estado: string;
  fechaInicio: string;
  obra: { nombre: string; codigoObra?: string | null } | null;
  presupuesto: { numero: number } | null;
  movimientos: MovimientoClientePDF[];
}

export interface ClienteConsolidadoPDF {
  razonSocial: string;
  tipoCliente: string;
  cuit?: string | null;
  email?: string | null;
  telefono?: string | null;
}

const TIPO_LABELS: Record<string, string> = {
  CARGO_INICIAL: 'Cargo inicial',
  ANTICIPO: 'Anticipo',
  PAGO_PARCIAL: 'Pago parcial',
  ACTUALIZACION: 'Actualización',
};

function fmtCuenta(cuenta: CuentaClientePDF, n: number): string {
  const prefijo = cuenta.moneda === 'USD' ? 'U$D ' : '$ ';
  return prefijo + Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function cobradoCuenta(cuenta: CuentaClientePDF): number {
  return cuenta.movimientos
    .filter(m => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL')
    .reduce((sum, m) => {
      if (cuenta.moneda === 'USD' && m.equivalenteUSD != null) return sum + Math.abs(m.equivalenteUSD);
      return sum + Math.abs(Number(m.montoEnARS ?? m.monto));
    }, 0);
}

export async function generarPDFClienteConsolidado(
  cliente: ClienteConsolidadoPDF,
  cuentas: CuentaClientePDF[]
): Promise<void> {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 15;

  let pagina = 1;

  function drawHeader() {
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', M, 5, 50, 18);
    } else {
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 26, 26);
      doc.text('CIMAdera S.A.', M, 14);
    }
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(74, 74, 74);
    doc.text('ventas.cimadera.net  ·  coordinacion.general@cimadera.net  ·  261 635-0017', M, 20);
    doc.setDrawColor(0, 173, 239);
    doc.setLineWidth(0.4);
    doc.line(M, 23, W - M, 23);
  }

  function drawFooter() {
    doc.setDrawColor(0, 173, 239);
    doc.setLineWidth(0.4);
    doc.line(M, H - 18, W - M, H - 18);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(74, 74, 74);
    doc.text(
      'CIMAdera S.A.  ·  Las Heras, Mendoza  ·  Certificación ISO 9001:2015  ·  Bureau Veritas',
      W / 2, H - 13, { align: 'center' }
    );
    doc.text('Página ' + pagina, W - M, H - 13, { align: 'right' });
  }

  function nuevaPagina() {
    drawFooter();
    doc.addPage();
    pagina++;
    drawHeader();
  }

  // === PÁGINA 1: PORTADA Y RESUMEN ===
  drawHeader();
  let y = 30;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 173, 239);
  doc.text('ESTADO DE CUENTA CORRIENTE', M, y); y += 6;

  doc.setFontSize(12);
  doc.setTextColor(26, 26, 26);
  doc.text(cliente.razonSocial, M, y); y += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(74, 74, 74);
  const infoStartY = y;
  if (cliente.cuit) { doc.text('CUIT: ' + cliente.cuit, M, y); y += 4; }
  if (cliente.email) { doc.text(cliente.email, M, y); y += 4; }
  if (cliente.telefono) { doc.text(cliente.telefono, M, y); y += 4; }

  const ahora = new Date();
  const fechaGen = ahora.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaGen = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  doc.text('Generado el ' + fechaGen + ' ' + horaGen, W - M, infoStartY, { align: 'right' });

  y += 6;

  doc.setDrawColor(0, 173, 239);
  doc.setLineWidth(0.5);
  doc.line(M, y, W - M, y); y += 8;

  // Separar cuentas por moneda
  const arsCuentas = cuentas.filter(c => (c.moneda ?? 'ARS') === 'ARS');
  const usdCuentas = cuentas.filter(c => c.moneda === 'USD');

  const totalFacturadoARS = arsCuentas.reduce((s, c) => s + c.montoOriginal, 0);
  const totalFacturadoUSD = usdCuentas.reduce((s, c) => s + c.montoOriginal, 0);
  const totalCobradoARS = arsCuentas.reduce((s, c) => s + cobradoCuenta(c), 0);
  const totalCobradoUSD = usdCuentas.reduce((s, c) => s + cobradoCuenta(c), 0);
  const saldoTotalARS = arsCuentas.filter(c => c.estado !== 'CANCELADO').reduce((s, c) => s + c.saldoActualizado, 0);
  const saldoTotalUSD = usdCuentas.filter(c => c.estado !== 'CANCELADO').reduce((s, c) => s + c.saldoActualizado, 0);
  const activas = cuentas.filter(c => c.estado !== 'CANCELADO').length;
  const saldadas = cuentas.filter(c => c.estado === 'CANCELADO').length;

  const fmtARS = (n: number) => '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtUSD = (n: number) => 'U$D ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Resumen general
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 26, 26);
  doc.text('RESUMEN GENERAL', M, y); y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  doc.setTextColor(26, 26, 26);
  doc.text('Total facturado:', M, y);
  doc.text(fmtARS(totalFacturadoARS), W - M, y, { align: 'right' }); y += 5;
  if (totalFacturadoUSD > 0) {
    doc.setFontSize(9);
    doc.setTextColor(74, 74, 74);
    doc.text(fmtUSD(totalFacturadoUSD), W - M, y, { align: 'right' }); y += 5;
    doc.setFontSize(10);
  }

  doc.setTextColor(26, 26, 26);
  doc.text('Total cobrado:', M, y);
  doc.setTextColor(22, 101, 52);
  doc.text(fmtARS(totalCobradoARS), W - M, y, { align: 'right' }); y += 5;
  if (totalCobradoUSD > 0) {
    doc.setFontSize(9);
    doc.setTextColor(22, 101, 52);
    doc.text(fmtUSD(totalCobradoUSD), W - M, y, { align: 'right' }); y += 5;
    doc.setFontSize(10);
  }

  doc.setTextColor(153, 27, 27);
  doc.setFont('helvetica', 'bold');
  doc.text('Saldo pendiente:', M, y);
  doc.text(fmtARS(saldoTotalARS), W - M, y, { align: 'right' }); y += 5;
  if (saldoTotalUSD > 0) {
    doc.setFontSize(9);
    doc.text(fmtUSD(saldoTotalUSD), W - M, y, { align: 'right' }); y += 5;
    doc.setFontSize(10);
  }

  doc.setTextColor(74, 74, 74);
  doc.setFont('helvetica', 'normal');
  doc.text('Cuentas activas: ' + activas + '  ·  Saldadas: ' + saldadas, M, y);
  y += 12;

  // Tabla resumen — header
  doc.setFillColor(0, 173, 239);
  doc.rect(M, y - 3.5, W - 2 * M, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('#', M + 2, y);
  doc.text('Obra', M + 10, y);
  doc.text('Presup.', M + 65, y);
  doc.text('Contrato', M + 85, y);
  doc.text('Cobrado', M + 115, y);
  doc.text('Saldo', M + 140, y);
  doc.text('Estado', M + 165, y);
  y += 5;

  // Tabla resumen — filas
  cuentas.forEach((c, i) => {
    if (y > H - 30) { nuevaPagina(); y = 32; }
    const cobrado = cobradoCuenta(c);

    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(M, y - 3, W - 2 * M, 6, 'F');
    }

    doc.setTextColor(26, 26, 26);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(String(i + 1), M + 2, y);
    doc.text((c.obra?.nombre ?? 'Sin obra').slice(0, 28), M + 10, y);
    doc.text('#' + (c.presupuesto?.numero ?? '—'), M + 65, y);
    doc.text(fmtCuenta(c, c.montoOriginal), M + 85, y);
    doc.setTextColor(22, 101, 52);
    doc.text(fmtCuenta(c, cobrado), M + 115, y);
    doc.setTextColor(153, 27, 27);
    doc.text(fmtCuenta(c, c.saldoActualizado), M + 140, y);
    doc.setTextColor(74, 74, 74);
    doc.text(c.estado === 'CANCELADO' ? 'Saldado' : 'Pendiente', M + 165, y);
    y += 6;
  });

  // Fila totales
  y += 2;
  doc.setDrawColor(0, 173, 239);
  doc.setLineWidth(0.5);
  doc.line(M, y, W - M, y); y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);

  doc.setTextColor(26, 26, 26);
  doc.text('TOTAL ARS', M + 10, y);
  doc.text(fmtARS(totalFacturadoARS), M + 85, y);
  doc.setTextColor(22, 101, 52);
  doc.text(fmtARS(totalCobradoARS), M + 115, y);
  doc.setTextColor(153, 27, 27);
  doc.text(fmtARS(saldoTotalARS), M + 140, y);

  if (totalFacturadoUSD > 0) {
    y += 6;
    doc.setTextColor(26, 26, 26);
    doc.text('TOTAL USD', M + 10, y);
    doc.text(fmtUSD(totalFacturadoUSD), M + 85, y);
    doc.setTextColor(22, 101, 52);
    doc.text(fmtUSD(totalCobradoUSD), M + 115, y);
    doc.setTextColor(153, 27, 27);
    doc.text(fmtUSD(saldoTotalUSD), M + 140, y);
  }

  // === PÁGINAS SIGUIENTES: DETALLE POR OBRA ===
  for (const cuenta of cuentas) {
    nuevaPagina();
    y = 32;

    const cuentaMoneda = cuenta.moneda ?? 'ARS';
    const cuentaPrefijo = cuentaMoneda === 'USD' ? 'U$D ' : '$ ';
    const fmt = (n: number) =>
      cuentaPrefijo + Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Encabezado de obra
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 173, 239);
    doc.text('OBRA: ' + (cuenta.obra?.nombre ?? 'Sin obra').toUpperCase(), M, y);
    if (cuentaMoneda === 'USD') {
      doc.setFontSize(9);
      doc.setTextColor(22, 163, 74);
      doc.text('U$D', W - M, y, { align: 'right' });
    }
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(74, 74, 74);
    doc.setFont('helvetica', 'normal');
    let obraInfo = 'Presupuesto N° ' + (cuenta.presupuesto?.numero ?? '—');
    if (cuenta.obra?.codigoObra) obraInfo += '  ·  Código: ' + cuenta.obra.codigoObra;
    doc.text(obraInfo, M, y);
    y += 8;

    doc.setDrawColor(0, 173, 239);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y); y += 6;

    const idxInicio = cuenta.indiceInicio;
    const idxActual = cuenta.indiceActual;
    const variacion = idxInicio > 0 ? ((idxActual / idxInicio - 1) * 100).toFixed(2) : '0.00';
    const cobradoObra = cobradoCuenta(cuenta);
    const montoAjustado = idxInicio > 0
      ? cuenta.montoOriginal * (idxActual / idxInicio)
      : cuenta.montoOriginal;

    doc.setFontSize(9);
    doc.setTextColor(74, 74, 74);
    doc.text('Fecha inicio: ' + new Date(cuenta.fechaInicio).toLocaleDateString('es-AR'), M, y); y += 4;
    doc.text(
      cuenta.nombreIndice + ' inicio: ' + idxInicio.toFixed(4) +
      '  ·  actual: ' + idxActual.toFixed(4) +
      '  ·  variación: +' + variacion + '%',
      M, y
    ); y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(26, 26, 26);
    doc.text('Monto contrato:', M, y); doc.text(fmt(cuenta.montoOriginal), M + 70, y); y += 4;
    doc.text('Monto ajustado:', M, y); doc.text(fmt(montoAjustado), M + 70, y); y += 4;
    doc.setTextColor(22, 101, 52);
    doc.text('Total cobrado:', M, y); doc.text(fmt(cobradoObra), M + 70, y); y += 4;
    doc.setTextColor(153, 27, 27);
    doc.setFont('helvetica', 'bold');
    doc.text('Saldo pendiente:', M, y); doc.text(fmt(cuenta.saldoActualizado), M + 70, y); y += 4;

    doc.setTextColor(74, 74, 74);
    doc.setFont('helvetica', 'normal');
    const pct = cuenta.montoOriginal > 0 ? (cobradoObra / cuenta.montoOriginal * 100) : 0;
    doc.text('Cobranza: ' + pct.toFixed(1) + '%', M, y);
    doc.setFillColor(226, 232, 240);
    doc.rect(M + 35, y - 3, 60, 4, 'F');
    doc.setFillColor(0, 173, 239);
    doc.rect(M + 35, y - 3, Math.min(60, 60 * pct / 100), 4, 'F');
    y += 10;

    // Tabla de movimientos
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 26, 26);
    doc.text('MOVIMIENTOS', M, y); y += 5;

    doc.setFillColor(0, 173, 239);
    doc.rect(M, y - 3.5, W - 2 * M, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.text('Fecha', M + 2, y);
    doc.text('Tipo', M + 22, y);
    doc.text('Descripción', M + 50, y);
    doc.text('N° Fact.', M + 105, y);
    doc.text('Monto', M + 128, y);
    doc.text('Saldo', M + 158, y);
    y += 5;

    const movsSorted = [...cuenta.movimientos].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
    );

    for (let i = 0; i < movsSorted.length; i++) {
      const mov = movsSorted[i];
      const hasTCDetail = !!(mov.tipoCambio && mov.caja && (
        (cuentaMoneda === 'USD' && mov.caja === 'ARS') ||
        (cuentaMoneda === 'ARS' && mov.caja === 'USD')
      ));
      if (y > H - 30) { nuevaPagina(); y = 32; }

      if (i % 2 === 1) {
        doc.setFillColor(248, 248, 248);
        doc.rect(M, y - 3, W - 2 * M, 5, 'F');
      }

      doc.setTextColor(74, 74, 74);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      doc.text(new Date(mov.fecha).toLocaleDateString('es-AR'), M + 2, y);
      doc.text(TIPO_LABELS[mov.tipo] ?? mov.tipo, M + 22, y);
      doc.text((mov.descripcion ?? '').slice(0, 35), M + 50, y);
      doc.text(mov.numeroFactura ?? '—', M + 105, y);

      const esPositivo = mov.tipo === 'CARGO_INICIAL' || mov.tipo === 'ACTUALIZACION';
      const isReduccion = !esPositivo;
      const montoDisplay = isReduccion
        ? (cuentaMoneda === 'USD' && mov.equivalenteUSD != null
            ? Math.abs(mov.equivalenteUSD)
            : Math.abs(Number(mov.montoEnARS ?? mov.monto)))
        : Math.abs(Number(mov.monto));
      const montoStr = (esPositivo ? '+' : '-') + cuentaPrefijo +
        montoDisplay.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      doc.setTextColor(esPositivo ? 153 : 22, esPositivo ? 27 : 101, esPositivo ? 27 : 52);
      doc.text(montoStr, M + 128, y);

      doc.setTextColor(26, 26, 26);
      doc.text(fmt(mov.saldoResultante), M + 158, y);
      y += 5;

      if (hasTCDetail) {
        if (y > H - 30) { nuevaPagina(); y = 32; }
        doc.setFontSize(6.5);
        doc.setTextColor(148, 163, 184);
        const tcVal = Number(mov.tipoCambio);
        let tcLine = '';
        if (cuentaMoneda === 'USD' && mov.caja === 'ARS') {
          const arsAmt = Math.abs(Number(mov.montoEnARS ?? mov.monto));
          tcLine = `$ ${arsAmt.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS ÷ TC $${tcVal.toLocaleString('es-AR')}`;
        } else if (cuentaMoneda === 'ARS' && mov.caja === 'USD') {
          const usdAmt = Math.abs(Number(mov.monto));
          tcLine = `U$D ${usdAmt.toLocaleString('es-AR', { minimumFractionDigits: 2 })} × TC $${tcVal.toLocaleString('es-AR')}`;
        }
        if (tcLine) {
          doc.text(tcLine, M + 50, y);
          y += 4;
        }
      }
    }
  }

  // Nota al pie
  y += 10;
  if (y > H - 50) { nuevaPagina(); y = 32; }
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Fórmula de actualización: Saldo actualizado = (Monto contrato − Total cobrado) × (Índice actual / Índice inicio)',
    M, y
  ); y += 5;
  doc.text('Este documento es un resumen informativo generado automáticamente.', M, y); y += 4;
  doc.text(
    'Fecha: ' + fechaGen + ' ' + horaGen + '  —  CIMAdera S.A.',
    M, y
  );

  drawFooter();

  const slug = cliente.razonSocial.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20);
  doc.save(`CC-consolidado-${slug}-${ahora.toISOString().split('T')[0]}.pdf`);
}
