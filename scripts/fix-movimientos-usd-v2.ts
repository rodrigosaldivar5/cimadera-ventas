import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  // Find all USD movements where monto ≠ montoEnARS (i.e. monto stored as USD, not ARS)
  // These are payments (ANTICIPO/PAGO_PARCIAL) in USD caja with a tipoCambio set
  const movs = await (prisma as any).movimientoCuenta.findMany({
    where: {
      caja: 'USD',
      tipo: { in: ['ANTICIPO', 'PAGO_PARCIAL'] },
      tipoCambio: { not: null },
    },
  });

  console.log(`Movimientos USD encontrados: ${movs.length}`);

  let fixed = 0;
  let skipped = 0;

  for (const m of movs) {
    const montoOriginal = parseFloat(m.monto.toString());
    const tc = parseFloat(m.tipoCambio.toString());
    const montoEnARSStored = m.montoEnARS ? parseFloat(m.montoEnARS.toString()) : null;
    const montoEnARSEsperado = montoOriginal * tc;

    // Check if monto looks like it was stored as USD (not ARS)
    // Heuristic: if montoEnARS is null OR montoEnARS ≈ monto (same value, not converted)
    const needsFix =
      montoEnARSStored === null ||
      Math.abs(montoEnARSStored - montoOriginal) < 0.01; // montoEnARS same as monto = bug

    if (!needsFix) {
      console.log(`  SKIP id=${m.id} | monto=${montoOriginal} ARS(stored)=${montoEnARSStored} → ya convertido`);
      skipped++;
      continue;
    }

    // monto was stored as USD → correct value is montoOriginal (USD), ARS = montoOriginal * tc
    const montoUSD = montoOriginal;
    const montoARS = montoUSD * tc;

    console.log(`  FIX  id=${m.id} | USD=${montoUSD} × TC=${tc} → ARS=${montoARS.toFixed(2)}`);

    await (prisma as any).movimientoCuenta.update({
      where: { id: m.id },
      data: {
        monto: montoARS,
        montoEnARS: montoARS,
        equivalenteUSD: montoUSD,
      },
    });
    fixed++;
  }

  console.log(`\nResumen: ${fixed} corregidos, ${skipped} omitidos (ya estaban bien)`);

  // Recalculate saldoActualizado for affected cuentas
  const cuentaIdsSet = new Set(movs.map((m: any) => m.cuentaId as string));
  const cuentaIds = Array.from(cuentaIdsSet);
  console.log(`\nRecalculando saldos para ${cuentaIds.length} cuenta(s)...`);

  for (const cuentaId of cuentaIds) {
    const cuenta = await (prisma as any).cuentaCorriente.findUnique({
      where: { id: cuentaId },
      include: { movimientos: true },
    });
    if (!cuenta) continue;

    const idxInicio = parseFloat(cuenta.indiceInicio.toString());
    const idxActual = parseFloat(cuenta.indiceActual.toString());
    const montoOriginal = parseFloat(cuenta.montoOriginal.toString());

    const totalPagado = cuenta.movimientos
      .filter((m: any) => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL')
      .reduce((sum: number, m: any) => sum + parseFloat((m.montoEnARS ?? m.monto).toString()), 0);

    const saldoBase = montoOriginal - totalPagado;
    const nuevoSaldo = saldoBase * (idxActual / idxInicio);
    const nuevoEstado = nuevoSaldo <= 0 ? 'CANCELADO' : 'SALDO_PENDIENTE';

    console.log(`  CC id=${cuentaId} | totalPagado=${totalPagado.toFixed(2)} | nuevoSaldo=${nuevoSaldo.toFixed(2)} | estado=${nuevoEstado}`);

    await (prisma as any).cuentaCorriente.update({
      where: { id: cuentaId },
      data: {
        saldoActualizado: nuevoSaldo,
        estado: nuevoEstado,
      },
    });
  }

  console.log('\nDone.');
  await prisma.$disconnect();
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
