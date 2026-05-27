import { prisma } from '../lib/prisma';

async function main() {
  const cuentas = await prisma.cuentaCorriente.findMany({
    include: { movimientos: true },
  });

  let corregidas = 0;

  for (const c of cuentas) {
    const idxInicio    = Number(c.indiceInicio);
    const idxActual    = Number(c.indiceActual);
    const montoOriginal = Number(c.montoOriginal);
    const saldoAlmacenado = Number(c.saldoActualizado);

    const totalPagado = c.movimientos
      .filter((m) => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL')
      .reduce((sum, m) => sum + Number(m.monto), 0);

    const saldoCorrecto = (montoOriginal * idxActual / idxInicio) - totalPagado;
    const diferencia = Math.abs(saldoAlmacenado - saldoCorrecto);

    if (diferencia > 0.01) {
      console.log(`Corrigiendo cuenta ${c.id}:`);
      console.log(`  saldoAlmacenado: ${saldoAlmacenado.toFixed(2)}`);
      console.log(`  saldoCorrecto:   ${saldoCorrecto.toFixed(2)}`);
      console.log(`  diferencia:      ${diferencia.toFixed(2)}`);

      await prisma.cuentaCorriente.update({
        where: { id: c.id },
        data: {
          saldoActualizado: saldoCorrecto,
          estado: saldoCorrecto <= 0 ? 'CANCELADO' : 'SALDO_PENDIENTE',
        },
      });

      console.log(`  ✓ corregida\n`);
      corregidas++;
    }
  }

  if (corregidas === 0) {
    console.log('Todas las cuentas tienen saldo consistente — nada que corregir.');
  } else {
    console.log(`${corregidas} cuenta(s) corregida(s).`);
  }

  await prisma.$disconnect();
}

main();
