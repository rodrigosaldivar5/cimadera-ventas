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
 * Etiquetas de resultado por cuenta:
 *   CANDIDATO   — montoOriginal coincide con el neto; cargo inicial identificado; se puede corregir
 *   YA_CORRECTO — montoOriginal ya coincide con totalConIva
 *   REVISAR     — montoOriginal ≈ neto pero no se puede identificar el cargo inicial con certeza
 *   ERROR       — montoOriginal no coincide ni con neto ni con totalConIva (monto manual?)
 *   SIN_IVA     — presupuesto sin IVA, no aplica corrección
 *
 * Uso:
 *   npm run fix:cc:iva -- --dry-run --presupuesto 1278
 *   npm run fix:cc:iva -- --execute --presupuesto 1278 --yes
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
function fmt(n: number, moneda = 'ARS') {
  const sym = moneda === 'USD' ? 'U$D ' : '$ ';
  return sym + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(tasa: number | null | undefined) {
  if (tasa == null) return '—';
  return `${Number(tasa)}%`;
}

function sep() {
  console.log('─'.repeat(72));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`  fix-cuentas-corrientes-iva  [${isDryRun ? 'DRY-RUN' : 'EXECUTE'}]`);
  console.log(`${'═'.repeat(72)}\n`);

  const where: Record<string, unknown> = {
    presupuestoId: { not: null },
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
          cliente: { select: { razonSocial: true } },
          obra:   { select: { nombre: true } },
        },
      },
      movimientos: {
        orderBy: { fecha: 'asc' },
      },
    },
  });

  // Filtrar por número de presupuesto si se pidió
  const filtradas = filtroPresupuestoNumero
    ? cuentas.filter((c) => c.presupuesto?.numero === filtroPresupuestoNumero)
    : cuentas;

  if (filtradas.length === 0) {
    console.log('No se encontraron cuentas con los filtros indicados.');
    await prisma.$disconnect();
    return;
  }

  // ── Clasificar cada cuenta ────────────────────────────────────────────────
  type Etiqueta = 'CANDIDATO' | 'YA_CORRECTO' | 'REVISAR' | 'ERROR' | 'SIN_IVA';

  type Resultado = {
    etiqueta: Etiqueta;
    cuentaId: string;
    presupuestoNumero: number;
    cliente: string;
    obra: string;
    moneda: string;
    neto: number;
    ivaAmt: number;
    tasa: number;
    montoConIva: number;
    montoActual: number;
    diferencia: number;
    saldoActual: number;
    totalPagado: number;
    saldoCorregido: number;
    ratio: number;
    cargoInicialId: string | null;
    cargoInicialMonto: number | null;
    motivoRevision?: string;
  };

  const resultados: Resultado[] = [];
  const counters: Record<Etiqueta, number> = {
    CANDIDATO: 0, YA_CORRECTO: 0, REVISAR: 0, ERROR: 0, SIN_IVA: 0,
  };

  for (const cuenta of filtradas) {
    const pres = cuenta.presupuesto;
    if (!pres) continue;

    const moneda      = cuenta.moneda ?? 'ARS';
    const tasaIva     = Number(pres.tasaIva ?? 0);
    const pfVal       = pres.precioFinal != null ? Number(pres.precioFinal) : 0;
    const neto        = pfVal > 0 ? pfVal : Number(pres.totalFinal ?? 0);
    const conIva      = Number(pres.totalConIva ?? 0);
    const ivaAmt      = Number(pres.montoIva ?? 0);
    const montoActual = Number(cuenta.montoOriginal);
    const saldoActual = Number(cuenta.saldoActualizado ?? 0);
    const cliente     = pres.cliente?.razonSocial ?? '(sin cliente)';
    const obra        = pres.obra?.nombre ?? '(sin obra)';

    // Índice para ajuste de valor (ratio = 1 cuando no hay variación)
    const idxInicio = Number(cuenta.indiceInicio ?? 1);
    const idxActual = Number(cuenta.indiceActual ?? 1);
    const ratio     = idxInicio > 0 ? idxActual / idxInicio : 1;

    // Pagos reales: solo ANTICIPO y PAGO_PARCIAL
    const pagos = cuenta.movimientos.filter(
      (m) => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL',
    );
    const totalPagado = pagos.reduce((sum, m) => sum + Number(m.monto), 0);

    // Cargo inicial
    const cargosIniciales = cuenta.movimientos.filter(
      (m) => (m as { tipo: string }).tipo === 'CARGO_INICIAL',
    );

    // SIN_IVA
    if (tasaIva <= 0) {
      counters.SIN_IVA++;
      continue;
    }

    if (conIva <= 0 || neto <= 0) {
      counters.ERROR++;
      resultados.push({
        etiqueta: 'ERROR', cuentaId: cuenta.id, presupuestoNumero: pres.numero,
        cliente, obra, moneda, neto, ivaAmt, tasa: tasaIva, montoConIva: conIva,
        montoActual, diferencia: 0, saldoActual, totalPagado, ratio,
        saldoCorregido: saldoActual, cargoInicialId: null, cargoInicialMonto: null,
        motivoRevision: `totalConIva=${conIva} o neto=${neto} inválido en el presupuesto`,
      });
      continue;
    }

    const diferencia = montoActual - conIva; // negativo si falta IVA
    const absDif     = Math.abs(diferencia);

    // YA_CORRECTO
    if (absDif < 1) {
      counters.YA_CORRECTO++;
      resultados.push({
        etiqueta: 'YA_CORRECTO', cuentaId: cuenta.id, presupuestoNumero: pres.numero,
        cliente, obra, moneda, neto, ivaAmt, tasa: tasaIva, montoConIva: conIva,
        montoActual, diferencia: 0, saldoActual, totalPagado, ratio,
        saldoCorregido: saldoActual, cargoInicialId: null, cargoInicialMonto: null,
      });
      continue;
    }

    // Coincide con neto → es el bug
    const coincideNeto = Math.abs(montoActual - neto) < 1;
    if (!coincideNeto) {
      counters.ERROR++;
      resultados.push({
        etiqueta: 'ERROR', cuentaId: cuenta.id, presupuestoNumero: pres.numero,
        cliente, obra, moneda, neto, ivaAmt, tasa: tasaIva, montoConIva: conIva,
        montoActual, diferencia: absDif, saldoActual, totalPagado, ratio,
        saldoCorregido: saldoActual, cargoInicialId: null, cargoInicialMonto: null,
        motivoRevision: `monto actual ${montoActual.toFixed(2)} no coincide ni con neto ${neto.toFixed(2)} ni con totalConIva ${conIva.toFixed(2)}`,
      });
      continue;
    }

    // Saldo corregido: se agrega el IVA faltante ajustado por el índice actual
    // saldoCorregido = saldoActual + ivaAmt * ratio
    // (ratio = indiceActual / indiceInicio; = 1 si sin ajuste de valor)
    const saldoCorregido = saldoActual + ivaAmt * ratio;

    // Verificar cargo inicial
    if (cargosIniciales.length !== 1) {
      counters.REVISAR++;
      resultados.push({
        etiqueta: 'REVISAR', cuentaId: cuenta.id, presupuestoNumero: pres.numero,
        cliente, obra, moneda, neto, ivaAmt, tasa: tasaIva, montoConIva: conIva,
        montoActual, diferencia: absDif, saldoActual, totalPagado, ratio, saldoCorregido,
        cargoInicialId: null, cargoInicialMonto: null,
        motivoRevision: cargosIniciales.length === 0
          ? 'no se encontró el movimiento CARGO_INICIAL'
          : `hay ${cargosIniciales.length} movimientos CARGO_INICIAL (ambiguo)`,
      });
      continue;
    }

    const cargoInicial = cargosIniciales[0];
    counters.CANDIDATO++;
    resultados.push({
      etiqueta: 'CANDIDATO', cuentaId: cuenta.id, presupuestoNumero: pres.numero,
      cliente, obra, moneda, neto, ivaAmt, tasa: tasaIva, montoConIva: conIva,
      montoActual, diferencia: absDif, saldoActual, totalPagado, ratio, saldoCorregido,
      cargoInicialId: cargoInicial.id,
      cargoInicialMonto: Number(cargoInicial.monto),
    });
  }

  // ── Resumen de contadores ─────────────────────────────────────────────────
  console.log(`Analizadas  : ${filtradas.length} cuentas`);
  console.log(`SIN_IVA     : ${counters.SIN_IVA}`);
  console.log(`YA_CORRECTO : ${counters.YA_CORRECTO}`);
  console.log(`CANDIDATO   : ${counters.CANDIDATO}  ← se pueden corregir`);
  console.log(`REVISAR     : ${counters.REVISAR}   ← requieren revisión manual`);
  console.log(`ERROR       : ${counters.ERROR}`);
  console.log('');

  // ── Detalle por cuenta ────────────────────────────────────────────────────
  for (const r of resultados) {
    sep();
    const etiquetaPad = r.etiqueta.padEnd(11);
    console.log(`[ ${etiquetaPad} ]  Presupuesto N°${String(r.presupuestoNumero).padStart(4, '0')}  |  CC: ${r.cuentaId}`);
    console.log(`  Cliente      : ${r.cliente}`);
    console.log(`  Obra         : ${r.obra}`);
    console.log(`  Moneda       : ${r.moneda}`);
    console.log('');
    console.log(`  Neto         : ${fmt(r.neto, r.moneda)}`);
    console.log(`  IVA (${String(r.tasa).padStart(2)}%)   : ${fmt(r.ivaAmt, r.moneda)}`);
    console.log(`  Total c/IVA  : ${fmt(r.montoConIva, r.moneda)}`);
    console.log('');
    console.log(`  montoContrato ACTUAL   : ${fmt(r.montoActual, r.moneda)}`);
    if (r.etiqueta === 'CANDIDATO' || r.etiqueta === 'REVISAR') {
      console.log(`  montoContrato CORRECTO : ${fmt(r.montoConIva, r.moneda)}`);
      console.log(`  Diferencia             : ${fmt(r.diferencia, r.moneda)}`);
      console.log('');
      const ratioStr = r.ratio !== 1 ? `  (índice: ×${r.ratio.toFixed(6)})` : '';
      console.log(`  saldo ACTUAL           : ${fmt(r.saldoActual, r.moneda)}`);
      console.log(`  saldo CORREGIDO        : ${fmt(r.saldoCorregido, r.moneda)}${ratioStr}`);
      console.log(`  Total pagado (ant+pp)  : ${fmt(r.totalPagado, r.moneda)}`);
    }
    console.log('');
    if (r.cargoInicialId) {
      console.log(`  Movimiento inicial  : id=${r.cargoInicialId}  monto actual=${fmt(r.cargoInicialMonto ?? 0, r.moneda)}`);
      console.log(`  Movimiento CORRECTO : monto=${fmt(r.montoConIva, r.moneda)}  saldoResultante=${fmt(r.montoConIva, r.moneda)}`);
    } else if (r.motivoRevision) {
      console.log(`  ⚠  ${r.motivoRevision}`);
    }
    console.log('');
  }
  sep();
  console.log('');

  if (isDryRun) {
    const candidatos = resultados.filter((r) => r.etiqueta === 'CANDIDATO');
    if (candidatos.length > 0) {
      console.log(`[DRY-RUN] ${candidatos.length} cuenta(s) listas para corregir.`);
      console.log('  Pasa --execute --yes para aplicar los cambios.\n');
    } else {
      console.log('[DRY-RUN] No hay cuentas para corregir.\n');
    }
    await prisma.$disconnect();
    return;
  }

  if (!skipConfirm) {
    console.error('Pasa --yes para confirmar la ejecución, o usa --dry-run para solo ver cambios.');
    await prisma.$disconnect();
    process.exit(1);
  }

  // ── Ejecución ─────────────────────────────────────────────────────────────
  const candidatos = resultados.filter((r) => r.etiqueta === 'CANDIDATO');
  if (candidatos.length === 0) {
    console.log('Nada que corregir (no hay CANDIDATO).');
    await prisma.$disconnect();
    return;
  }

  console.log(`Aplicando correcciones sobre ${candidatos.length} cuenta(s)...\n`);
  let corregidas = 0;
  let errores = 0;

  for (const c of candidatos) {
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Corregir montoOriginal, snapshot IVA y saldoActualizado
        await tx.cuentaCorriente.update({
          where: { id: c.cuentaId },
          data: {
            montoOriginal:     c.montoConIva,
            tasaIvaContrato:   c.tasa,
            montoContratoNeto: c.neto,
            montoContratoIva:  c.ivaAmt,
            saldoActualizado:  c.saldoCorregido,
          },
        });

        // 2. Corregir cargo inicial (monto + saldoResultante)
        if (c.cargoInicialId) {
          await tx.movimientoCuenta.update({
            where: { id: c.cargoInicialId },
            data: {
              monto:           c.montoConIva,
              saldoResultante: c.montoConIva,
            },
          });
        }
      });

      console.log(
        `  ✓ CC ${c.cuentaId} (pres ${c.presupuestoNumero}) ` +
        `montoOriginal ${fmt(c.montoActual, c.moneda)} → ${fmt(c.montoConIva, c.moneda)} | ` +
        `saldo ${fmt(c.saldoActual, c.moneda)} → ${fmt(c.saldoCorregido, c.moneda)}`,
      );
      corregidas++;
    } catch (err) {
      console.error(`  ✗ CC ${c.cuentaId} (pres ${c.presupuestoNumero}): ${String(err)}`);
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
