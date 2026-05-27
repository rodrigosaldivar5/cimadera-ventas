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

  // Estado antes del update
  const indiceInicioAntes = cuenta.indiceInicio.toString();
  const indiceActualAntes = cuenta.indiceActual.toString();

  // Simular una actualización directo en DB para verificar la lógica
  const indiceNuevo   = parseFloat(indiceActualAntes) * 1.05  // +5%
  const montoOriginal = parseFloat(cuenta.montoOriginal.toString())
  const indiceInicio  = parseFloat(cuenta.indiceInicio.toString())

  const totalPagado = cuenta.movimientos
    .filter((m) => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL')
    .reduce((sum, m) => sum + parseFloat(m.monto.toString()), 0);

  const saldoConIndiceAnterior = (montoOriginal * parseFloat(indiceActualAntes) / indiceInicio) - totalPagado;
  const saldoConIndiceNuevo    = (montoOriginal * indiceNuevo / indiceInicio) - totalPagado;
  const montoAjuste = saldoConIndiceNuevo - saldoConIndiceAnterior; // puede ser negativo

  console.log(`\nCuenta:               ${cuenta.id}`);
  console.log(`indiceInicio (antes):  ${indiceInicioAntes}`);
  console.log(`indiceActual (antes):  ${indiceActualAntes}`);
  console.log(`indiceNuevo  (+5%):    ${indiceNuevo.toFixed(4)}`);
  console.log(`montoOriginal:         ${montoOriginal.toFixed(2)}`);
  console.log(`totalPagado:           ${totalPagado.toFixed(2)}`);
  console.log(`saldoAntes:            ${saldoConIndiceAnterior.toFixed(2)}`);
  console.log(`saldoNuevo:            ${saldoConIndiceNuevo.toFixed(2)}`);
  console.log(`montoAjuste (signed):  ${montoAjuste.toFixed(2)}`);
  console.log('');

  let testPassed = false;

  try {
    await prisma.$transaction(async (tx) => {
      // Replicar exactamente lo que hace aplicar-actualizacion/route.ts
      await tx.movimientoCuenta.create({
        data: {
          cuentaId: cuenta.id,
          tipo: 'ACTUALIZACION',
          descripcion: `TEST: ${indiceActualAntes} → ${indiceNuevo.toFixed(4)}`,
          monto: montoAjuste,
          saldoResultante: saldoConIndiceNuevo,
          fecha: new Date(),
          indiceValor: indiceNuevo,
        },
      });

      await tx.cuentaCorriente.update({
        where: { id: cuenta.id },
        data: {
          indiceActual: indiceNuevo,
          saldoActualizado: saldoConIndiceNuevo,
          estado: saldoConIndiceNuevo <= 0 ? 'CANCELADO' : 'SALDO_PENDIENTE',
          // indiceInicio nunca aparece aquí
        },
      });

      const cuentaDespues = await tx.cuentaCorriente.findUnique({
        where: { id: cuenta.id },
      });

      console.log(`indiceInicio (después): ${cuentaDespues!.indiceInicio.toString()}`);
      console.log(`indiceActual (después): ${cuentaDespues!.indiceActual.toString()}`);
      console.log('');

      if (cuentaDespues!.indiceInicio.toString() !== indiceInicioAntes) {
        console.log('ERROR: indiceInicio fue modificado!')
        process.exit(1)
      } else {
        console.log('OK: indiceInicio no fue modificado')
        testPassed = true;
      }

      // Siempre revertir — sin datos sucios en la DB
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

  await prisma.$disconnect()
}

main()
