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
  // Paso 1: completar montoEnARS en movimientos USD que no lo tienen bien
  const movs = await prisma.movimientoCuenta.findMany({
    where: { caja: 'USD', tipoCambio: { not: null } },
  });

  console.log(`Encontrados ${movs.length} movimientos USD con tipoCambio`);

  for (const m of movs) {
    const tc       = parseFloat(m.tipoCambio!.toString());
    const montoUSD = parseFloat(m.monto.toString());
    const montoARS = montoUSD * tc;

    const montoEnARSGuardado = m.montoEnARS != null ? parseFloat(m.montoEnARS.toString()) : null;
    if (montoEnARSGuardado == null || Math.abs(montoEnARSGuardado - montoARS) > 0.01) {
      console.log(`  Mov ${m.id}: montoEnARS ${montoEnARSGuardado ?? 'null'} → ${montoARS}`);
      await prisma.movimientoCuenta.update({
        where: { id: m.id },
        data: { montoEnARS: montoARS },
      });
    }
  }

  // Paso 2: recalcular saldoResultante y saldoActualizado por cuenta afectada
  const cuentaIds = Array.from(new Set(movs.map((m) => m.cuentaId)));

  for (const cuentaId of cuentaIds) {
    const cuenta = await prisma.cuentaCorriente.findUnique({
      where: { id: cuentaId },
      include: { movimientos: { orderBy: { fecha: 'asc' } } },
    });
    if (!cuenta) continue;

    const idxInicio     = parseFloat(cuenta.indiceInicio.toString());
    const idxActual     = parseFloat(cuenta.indiceActual.toString());
    const montoOriginal = parseFloat(cuenta.montoOriginal.toString());

    let totalPagAcum = 0;
    let currentIdx   = idxInicio;

    for (const m of cuenta.movimientos) {
      let nuevoSaldo: number;

      if (m.tipo === 'CARGO_INICIAL') {
        nuevoSaldo = montoOriginal;
      } else if (m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL') {
        const valorARS = m.montoEnARS != null
          ? parseFloat(m.montoEnARS.toString())
          : parseFloat(m.monto.toString());
        totalPagAcum += valorARS;
        nuevoSaldo = (montoOriginal - totalPagAcum) * (currentIdx / idxInicio);
      } else if (m.tipo === 'ACTUALIZACION' && m.indiceValor) {
        const idx  = parseFloat(m.indiceValor.toString());
        currentIdx = idx;
        nuevoSaldo = (montoOriginal - totalPagAcum) * (idx / idxInicio);
      } else {
        continue;
      }

      const saldoGuardado = parseFloat(m.saldoResultante.toString());
      if (Math.abs(nuevoSaldo - saldoGuardado) > 0.01) {
        console.log(`  [mov ${m.id}] ${m.tipo}: saldoResultante ${saldoGuardado.toFixed(2)} → ${nuevoSaldo.toFixed(2)}`);
        await prisma.movimientoCuenta.update({
          where: { id: m.id },
          data: { saldoResultante: nuevoSaldo },
        });
      }
    }

    const saldoActualizado = (montoOriginal - totalPagAcum) * (idxActual / idxInicio);
    const saldoGuardado    = parseFloat(cuenta.saldoActualizado.toString());

    console.log(`\nCuenta ${cuentaId}:`);
    console.log(`  montoOriginal:   ${montoOriginal}`);
    console.log(`  totalPagado ARS: ${totalPagAcum}`);
    console.log(`  saldoBase:       ${montoOriginal - totalPagAcum}`);
    console.log(`  saldoActualizado: ${saldoGuardado.toFixed(2)} → ${saldoActualizado.toFixed(2)}`);

    await prisma.cuentaCorriente.update({
      where: { id: cuentaId },
      data: {
        saldoActualizado,
        estado: saldoActualizado <= 0 ? 'CANCELADO' : 'SALDO_PENDIENTE',
      },
    });
    console.log(`  ✓ ${cuenta.movimientos.length} movimientos recalculados`);
  }

  await prisma.$disconnect();
  console.log('\n=== DONE ===');
}

main().catch((e) => { console.error(e); process.exit(1); });
