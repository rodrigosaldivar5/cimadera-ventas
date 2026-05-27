import { prisma } from '../lib/prisma';

async function main() {
  const cuentas = await prisma.cuentaCorriente.findMany({
    include: {
      cliente: { select: { razonSocial: true } },
      movimientos: { orderBy: { fecha: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\n=== CHECK CUENTAS CORRIENTES (${cuentas.length} cuentas) ===\n`);

  let errores = 0;
  let advertencias = 0;

  for (const c of cuentas) {
    const idxInicio    = parseFloat(c.indiceInicio.toString());
    const idxActual    = parseFloat(c.indiceActual.toString());
    const montoOriginal = parseFloat(c.montoOriginal.toString());
    const saldoAlmacenado = parseFloat(c.saldoActualizado.toString());

    // Calcular total pagado
    const movimientosPago = c.movimientos.filter(
      (m) => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL',
    );
    const totalPagado = movimientosPago.reduce(
      (sum, m) => sum + parseFloat(m.monto.toString()),
      0,
    );

    const saldoEsperado = (montoOriginal * idxActual / idxInicio) - totalPagado;
    const diferencia = Math.abs(saldoAlmacenado - saldoEsperado);

    const tieneActualizaciones = c.movimientos.some((m) => m.tipo === 'ACTUALIZACION');
    const indicesIguales = idxInicio === idxActual;

    console.log(`Cliente: ${c.cliente.razonSocial}`);
    console.log(`  ID:             ${c.id}`);
    console.log(`  Estado:         ${c.estado}`);
    console.log(`  montoOriginal:  ${montoOriginal.toFixed(2)}`);
    console.log(`  indiceInicio:   ${idxInicio}`);
    console.log(`  indiceActual:   ${idxActual}`);
    console.log(`  totalPagado:    ${totalPagado.toFixed(2)} (${movimientosPago.length} movimiento/s)`);
    for (const p of movimientosPago) {
      const fecha = new Date(p.fecha).toLocaleDateString('es-AR');
      console.log(`    [${p.tipo}] ${fecha}  $${parseFloat(p.monto.toString()).toFixed(2)}`);
    }
    console.log(`  saldoAlmacenado:${saldoAlmacenado.toFixed(2)}`);
    console.log(`  saldoEsperado:  ${saldoEsperado.toFixed(2)}`);
    console.log(`  diferencia:     ${diferencia.toFixed(2)}`);

    // Detectar anomalías
    if (tieneActualizaciones && indicesIguales) {
      console.log(`  ⚠ SOSPECHOSO: hay ACTUALIZACION pero indiceInicio === indiceActual (${idxInicio})`);
      advertencias++;
    }

    if (diferencia > 0.01) {
      console.log(`  ✗ ERROR: saldo almacenado difiere del esperado por ${diferencia.toFixed(2)}`);
      errores++;
    } else {
      console.log(`  ✓ saldo consistente con la fórmula`);
    }

    // Verificar continuidad del saldoResultante en movimientos
    let saldoAcumulado = 0;
    for (const m of c.movimientos) {
      const monto = parseFloat(m.monto.toString());
      const saldoMov = parseFloat(m.saldoResultante.toString());

      if (m.tipo === 'CARGO_INICIAL') {
        saldoAcumulado = monto;
      } else if (m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL') {
        // No verificamos continuidad directa porque depende del índice vigente en ese momento
      } else if (m.tipo === 'ACTUALIZACION') {
        // El saldoResultante debe ser >= 0 (puede ser negativo si pagaron de más)
      }

      if (saldoMov < -0.01 && c.estado !== 'CANCELADO') {
        console.log(`  ⚠ movimiento ${m.id} tiene saldoResultante negativo (${saldoMov.toFixed(2)}) pero estado no es CANCELADO`);
        advertencias++;
      }
    }

    console.log(`  movimientos: ${c.movimientos.length} (${c.movimientos.map((m) => m.tipo).join(', ')})`);
    console.log('');
  }

  console.log(`=== RESUMEN ===`);
  console.log(`  Total cuentas:   ${cuentas.length}`);
  console.log(`  Errores:         ${errores}`);
  console.log(`  Advertencias:    ${advertencias}`);

  if (errores === 0 && advertencias === 0) {
    console.log('\n  Todo OK — ninguna anomalía detectada.\n');
  } else {
    console.log('\n  Revisar los items marcados arriba.\n');
  }

  await prisma.$disconnect();
}

main();
