import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL no está definida en .env.local');
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const cuentas = await prisma.cuentaCorriente.findMany({
    include: { movimientos: { orderBy: { fecha: 'asc' } } },
  });

  console.log(`Procesando ${cuentas.length} cuentas...`);

  for (const cuenta of cuentas) {
    const montoOriginal = parseFloat(cuenta.montoOriginal.toString());
    const idxInicio     = parseFloat(cuenta.indiceInicio.toString());
    let   currentIdx    = idxInicio;
    let   totalPagado   = 0;

    const movsSorted = [...cuenta.movimientos].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
    );

    for (const mov of movsSorted) {
      let nuevoSaldoResultante: number;

      if (mov.tipo === 'CARGO_INICIAL') {
        nuevoSaldoResultante = montoOriginal;
      } else if (mov.tipo === 'ANTICIPO' || mov.tipo === 'PAGO_PARCIAL') {
        const montoARS = mov.montoEnARS != null
          ? parseFloat(mov.montoEnARS.toString())
          : parseFloat(mov.monto.toString());
        totalPagado += montoARS;
        nuevoSaldoResultante = (montoOriginal - totalPagado) * (currentIdx / idxInicio);
      } else if (mov.tipo === 'ACTUALIZACION' && mov.indiceValor) {
        const idx = parseFloat(mov.indiceValor.toString());
        currentIdx = idx;
        nuevoSaldoResultante = (montoOriginal - totalPagado) * (idx / idxInicio);
      } else {
        continue;
      }

      if (Math.abs(nuevoSaldoResultante - parseFloat(mov.saldoResultante.toString())) > 0.01) {
        console.log(
          `  [mov ${mov.id}] ${mov.tipo} ${mov.fecha.toISOString().slice(0, 10)}: ` +
          `${parseFloat(mov.saldoResultante.toString()).toFixed(2)} → ${nuevoSaldoResultante.toFixed(2)}`,
        );
        await prisma.movimientoCuenta.update({
          where: { id: mov.id },
          data: { saldoResultante: nuevoSaldoResultante },
        });
      }
    }

    // Actualizar saldoActualizado en la cuenta con la nueva fórmula
    const saldoActualizado = (montoOriginal - totalPagado) * (currentIdx / idxInicio);
    const saldoGuardado    = parseFloat(cuenta.saldoActualizado.toString());

    if (Math.abs(saldoActualizado - saldoGuardado) > 0.01) {
      console.log(
        `Cuenta ${cuenta.id}: saldoActualizado ${saldoGuardado.toFixed(2)} → ${saldoActualizado.toFixed(2)}`,
      );
      await prisma.cuentaCorriente.update({
        where: { id: cuenta.id },
        data: {
          saldoActualizado,
          estado: saldoActualizado <= 0 ? 'CANCELADO' : 'SALDO_PENDIENTE',
        },
      });
    }
  }

  console.log('Fix completado.');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
