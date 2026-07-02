/**
 * fix-cuentas-corrientes-iva.ts
 *
 * Detecta cuentas corrientes cuyo montoOriginal fue grabado con el neto
 * del presupuesto en lugar del total con IVA, y opcionalmente las corrige.
 *
 * Flags:
 *   --dry-run              Solo muestra qué cambiaría (default si no se pasa --execute)
 *   --execute              Aplica los cambios (requiere --yes para saltear confirmación)
 *   --yes                  Confirma la ejecución sin prompt interactivo
 *   --id <cuentaId>        Limita a una sola cuenta
 *   --presupuesto <n>      Limita al presupuesto con ese número
 *   --limit <n>            Máximo de cuentas a procesar (default: 1000)
 *
 * Nota: usa PrismaClient directo (no lib/prisma) para que dotenv.config() se ejecute
 * antes de inicializar el cliente.
 *
 * Uso:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fix-cuentas-corrientes-iva.ts --dry-run
 *   npm run fix:cc:iva -- --execute --yes
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDryRun = !args.includes('--execute');
const skipConfirm = args.includes('--yes');

const idxId = args.indexOf('--id');
const filterId = idxId !== -1 ? args[idxId + 1] : undefined;

const idxPres = args.indexOf('--presupuesto');
const filtroPresupuestoNumero = idxPres !== -1 ? Number(args[idxPres + 1]) : undefined;

const idxLimit = args.indexOf('--limit');
const limit = idxLimit !== -1 ? Number(args[idxLimit + 1]) : 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(tasa: number | null | undefined) {
  if (tasa == null) return '—';
  return `${Number(tasa)}%`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== fix-cuentas-corrientes-iva  [${isDryRun ? 'DRY-RUN' : 'EXECUTE'}] ===\n`);

  // Fetch cuentas con presupuesto vinculado
  const where: Record<string, unknown> = {
    presupuestoId: { not: null },
    moneda: 'ARS', // USD cuentas no aplica este fix
  };
  if (filterId) where.id = filterId;

  const cuentas = await prisma.cuentaCorriente.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'asc' },
    include: {
      presupuesto: {
        select: {
          id: true,
          numero: true,
          totalFinal: true,
          precioFinal: true,
          totalConIva: true,
          tasaIva: true,
          montoIva: true,
        },
      },
      movimientos: {
        where: { tipo: 'CARGO_INICIAL' },
        take: 1,
        orderBy: { fecha: 'asc' },
      },
    },
  });

  // Opcional: filtrar por número de presupuesto
  const filtradas = filtroPresupuestoNumero
    ? cuentas.filter((c) => c.presupuesto?.numero === filtroPresupuestoNumero)
    : cuentas;

  if (filtradas.length === 0) {
    console.log('No se encontraron cuentas con los filtros indicados.');
    await prisma.$disconnect();
    return;
  }

  type Candidata = {
    id: string;
    presupuestoNumero: number;
    montoActual: number;
    montoConIva: number;
    neto: number;
    iva: number;
    tasa: number;
    diferencia: number;
    cargoInicialId: string | null;
    saldoActualizado: number;
  };

  const candidatas: Candidata[] = [];
  let sinIva = 0;
  let yaCorrectas = 0;

  for (const cuenta of filtradas) {
    const pres = cuenta.presupuesto;
    if (!pres) continue;

    const tasaIva = Number(pres.tasaIva ?? 0);
    if (tasaIva <= 0) {
      sinIva++;
      continue;
    }

    const neto = Number(pres.precioFinal ?? pres.totalFinal ?? 0);
    const conIva = Number(pres.totalConIva ?? 0);
    const ivaAmt = Number(pres.montoIva ?? 0);

    if (conIva <= 0 || neto <= 0) {
      console.warn(`  [SKIP] CC ${cuenta.id}: totalConIva=${conIva} o neto=${neto} inválido`);
      continue;
    }

    const montoActual = Number(cuenta.montoOriginal);
    const diferencia = Math.abs(montoActual - conIva);

    // Si el monto ya es el total con IVA (diferencia < $1), está correcta
    if (diferencia < 1) {
      yaCorrectas++;
      continue;
    }

    // Si el monto coincide con el neto, es el bug buscado
    const coincideNeto = Math.abs(montoActual - neto) < 1;
    if (!coincideNeto) {
      // Monto diferente tanto del neto como del total c/IVA — manual, no tocar
      console.warn(
        `  [SKIP] CC ${cuenta.id} (pres ${pres.numero}): monto ${fmt(montoActual)} ` +
          `no coincide ni con neto ${fmt(neto)} ni con totalConIva ${fmt(conIva)} — se omite`,
      );
      continue;
    }

    const cargoInicial = cuenta.movimientos[0] ?? null;

    candidatas.push({
      id: cuenta.id,
      presupuestoNumero: pres.numero,
      montoActual,
      montoConIva: conIva,
      neto,
      iva: ivaAmt,
      tasa: tasaIva,
      diferencia,
      cargoInicialId: cargoInicial?.id ?? null,
      saldoActualizado: Number(cuenta.saldoActualizado),
    });
  }

  // ── Reporte ───────────────────────────────────────────────────────────────
  console.log(`Analizadas : ${filtradas.length} cuentas`);
  console.log(`Sin IVA    : ${sinIva}`);
  console.log(`Ya correctas: ${yaCorrectas}`);
  console.log(`Candidatas a corregir: ${candidatas.length}\n`);

  if (candidatas.length === 0) {
    console.log('Nada que corregir.');
    await prisma.$disconnect();
    return;
  }

  for (const c of candidatas) {
    console.log(`─── Presupuesto N°${String(c.presupuestoNumero).padStart(4, '0')}  CC: ${c.id}`);
    console.log(`    montoOriginal actual : ${fmt(c.montoActual)}`);
    console.log(`    montoOriginal correcto: ${fmt(c.montoConIva)}  (incluye IVA ${pct(c.tasa)})`);
    console.log(`    neto                 : ${fmt(c.neto)}`);
    console.log(`    IVA                  : ${fmt(c.iva)}`);
    if (c.cargoInicialId) {
      console.log(`    cargo inicial id     : ${c.cargoInicialId}  → monto: ${fmt(c.montoConIva)}`);
    } else {
      console.log(`    cargo inicial        : no encontrado — NO se actualizará`);
    }
    console.log('');
  }

  if (isDryRun) {
    console.log('[DRY-RUN] No se realizaron cambios. Pasa --execute --yes para aplicar.\n');
    await prisma.$disconnect();
    return;
  }

  if (!skipConfirm) {
    // En entorno no-interactivo, exigir --yes
    console.error('Pasa --yes para confirmar la ejecución, o usa --dry-run para solo ver cambios.');
    await prisma.$disconnect();
    process.exit(1);
  }

  // ── Ejecución ─────────────────────────────────────────────────────────────
  console.log('Aplicando correcciones...\n');
  let corregidas = 0;
  let errores = 0;

  for (const c of candidatas) {
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Corregir montoOriginal y snapshot IVA
        await tx.cuentaCorriente.update({
          where: { id: c.id },
          data: {
            montoOriginal: c.montoConIva,
            tasaIvaContrato: c.tasa,
            montoContratoNeto: c.neto,
            montoContratoIva: c.iva,
          },
        });

        // 2. Corregir cargo inicial (monto + saldoResultante)
        if (c.cargoInicialId) {
          await tx.movimientoCuenta.update({
            where: { id: c.cargoInicialId },
            data: {
              monto: c.montoConIva,
              saldoResultante: c.montoConIva,
            },
          });
        }
      });

      console.log(`  ✓ CC ${c.id} (pres ${c.presupuestoNumero}) → montoOriginal ${fmt(c.montoConIva)}`);
      corregidas++;
    } catch (err) {
      console.error(`  ✗ CC ${c.id}: ${String(err)}`);
      errores++;
    }
  }

  console.log(`\nResumen: ${corregidas} corregidas, ${errores} errores.\n`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
