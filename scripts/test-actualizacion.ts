import { prisma } from '../lib/prisma';

async function main() {
  const cuenta = await prisma.cuentaCorriente.findFirst({
    where: { estado: 'SALDO_PENDIENTE' },
    include: { movimientos: true },
  });

  if (!cuenta) {
    console.log('No hay cuentas con saldo pendiente para testear');
    await prisma.$disconnect();
    return;
  }

  const indiceInicioAntes = cuenta.indiceInicio.toString();
  const idxInicio    = parseFloat(cuenta.indiceInicio.toString());
  const idxAnterior  = parseFloat(cuenta.indiceActual.toString());
  const montoOriginal = parseFloat(cuenta.montoOriginal.toString());

  const totalPagado = cuenta.movimientos
    .filter((m) => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL')
    .reduce((sum, m) => sum + parseFloat(m.monto.toString()), 0);

  const idxNuevo = idxAnterior * 1.05; // 5% aumento de prueba
  const saldoConIndiceAnterior = (montoOriginal * idxAnterior / idxInicio) - totalPagado;
  const saldoConIndiceNuevo    = (montoOriginal * idxNuevo    / idxInicio) - totalPagado;
  const montoAjuste = saldoConIndiceNuevo - saldoConIndiceAnterior;

  console.log(`\nCuenta: ${cuenta.id}`);
  console.log(`indiceInicio (antes):  ${indiceInicioAntes}`);
  console.log(`indiceActual (antes):  ${idxAnterior}`);
  console.log(`indiceNuevo  (test):   ${idxNuevo.toFixed(4)}`);
  console.log(`totalPagado:           ${totalPagado.toFixed(2)}`);
  console.log(`saldoAntes:            ${saldoConIndiceAnterior.toFixed(2)}`);
  console.log(`saldoNuevo:            ${saldoConIndiceNuevo.toFixed(2)}`);
  console.log(`montoAjuste (signed):  ${montoAjuste.toFixed(2)}`);
  console.log('');

  // Ejecutar en transacción y revertir siempre — sin datos sucios en la DB
  let testPassed = false;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.movimientoCuenta.create({
        data: {
          cuentaId: cuenta.id,
          tipo: 'ACTUALIZACION',
          descripcion: `TEST: actualización ${idxAnterior} → ${idxNuevo.toFixed(4)}`,
          monto: montoAjuste,
          saldoResultante: saldoConIndiceNuevo,
          fecha: new Date(),
          indiceValor: idxNuevo,
        },
      });

      await tx.cuentaCorriente.update({
        where: { id: cuenta.id },
        data: {
          indiceActual: idxNuevo,
          saldoActualizado: saldoConIndiceNuevo,
          estado: saldoConIndiceNuevo <= 0 ? 'CANCELADO' : 'SALDO_PENDIENTE',
          // indiceInicio NO debe aparecer aquí jamás
        },
      });

      const cuentaDespues = await tx.cuentaCorriente.findUnique({
        where: { id: cuenta.id },
      });

      console.log(`indiceInicio (después): ${cuentaDespues!.indiceInicio.toString()}`);
      console.log(`indiceActual (después): ${cuentaDespues!.indiceActual.toString()}`);
      console.log('');

      if (cuentaDespues!.indiceInicio.toString() !== indiceInicioAntes) {
        console.log('ERROR: indiceInicio fue modificado!');
        process.exit(1);
      } else {
        console.log('OK: indiceInicio no fue modificado');
        testPassed = true;
      }

      // Revertir siempre para no ensuciar la DB
      throw new Error('__ROLLBACK__');
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message !== '__ROLLBACK__') {
      console.error('Error inesperado:', err);
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  if (testPassed) {
    console.log('\nTest OK — cambios revertidos (DB sin modificar)');
  }

  await prisma.$disconnect();
}

main();
