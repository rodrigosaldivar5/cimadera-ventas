import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSaldoCaja, isTesoreriaAuthorized } from '@/lib/tesoreria';
import { subMonths, startOfMonth, endOfMonth, addDays, startOfWeek, endOfWeek } from 'date-fns';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!isTesoreriaAuthorized(session.user.email))
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });

  const now = new Date();

  const [saldoARS, saldoUSD, tipoCambioRec, registrosCostos, cuentasConProyeccion] = await Promise.all([
    getSaldoCaja('ARS'),
    getSaldoCaja('USD'),
    prisma.tipoCambio.findFirst({ orderBy: { fecha: 'desc' } }),
    // Last 3 months of cost records to compute monthly average
    prisma.registroCostoFijo.findMany({
      where: {
        anio: { gte: now.getFullYear() - 1 },
      },
      include: { costoFijo: { select: { moneda: true } } },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    }),
    // Accounts with cashflow projection fields
    prisma.cuentaCorriente.findMany({
      where: {
        estado: 'SALDO_PENDIENTE',
        fechaEstimadaCobro: { not: null },
      },
      select: {
        id: true,
        fechaEstimadaCobro: true,
        montoEstimadoCobro: true,
        saldoActualizado: true,
        cliente: { select: { razonSocial: true } },
      },
    }),
  ]);

  const tc = tipoCambioRec ? Number(tipoCambioRec.valor) : 1;

  // Compute monthly cost averages from last 3 months
  const last3Months: { mes: number; anio: number }[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = subMonths(now, i);
    last3Months.push({ mes: d.getMonth() + 1, anio: d.getFullYear() });
  }

  let totalCostosARS = 0;
  let totalCostosUSD = 0;
  let countMeses = 0;

  for (const { mes, anio } of last3Months) {
    const registrosMes = registrosCostos.filter((r) => r.mes === mes && r.anio === anio);
    if (registrosMes.length === 0) continue;
    countMeses++;
    for (const r of registrosMes) {
      const monto = r.montoReal != null ? Number(r.montoReal) : 0;
      if (r.costoFijo.moneda === 'USD') totalCostosUSD += monto;
      else totalCostosARS += monto;
    }
  }

  const divisor = countMeses || 1;
  const costoMensualARS = totalCostosARS / divisor;
  const costoMensualUSD = totalCostosUSD / divisor;

  // Runway
  const runwayMesesARS = costoMensualARS > 0 ? saldoARS / costoMensualARS : 99;
  const runwayMesesUSD = costoMensualUSD > 0 ? saldoUSD / costoMensualUSD : 99;

  // Semáforo helper
  const semaforo = (meses: number) =>
    meses >= 3 ? 'verde' : meses >= 1.5 ? 'amarillo' : 'rojo';

  // Alert: low ARS runway but USD available (or vice versa)
  const alertaConversion =
    runwayMesesARS < 1.5 && saldoUSD > 0
      ? {
          tipo: 'ARS_BAJO_USD_DISPONIBLE' as const,
          montoSugeridoConvertir: Math.min(saldoUSD, (costoMensualARS * 3) / tc),
        }
      : runwayMesesUSD < 1.5 && saldoARS > 0
      ? {
          tipo: 'USD_BAJO_ARS_DISPONIBLE' as const,
          montoSugeridoConvertir: Math.min(saldoARS, costoMensualUSD * 3 * tc),
        }
      : null;

  // 12-week projection table
  const costoSemanalARS = costoMensualARS / 4.33;
  const costoSemanalUSD = costoMensualUSD / 4.33;

  const semanas = Array.from({ length: 12 }, (_, i) => {
    const semanaInicio = startOfWeek(addDays(now, i * 7), { weekStartsOn: 1 });
    const semanaFin = endOfWeek(addDays(now, i * 7), { weekStartsOn: 1 });

    const ingresosProyectados = cuentasConProyeccion
      .filter((c) => {
        if (!c.fechaEstimadaCobro) return false;
        const f = new Date(c.fechaEstimadaCobro);
        return f >= semanaInicio && f <= semanaFin;
      })
      .reduce((s, c) => s + Number(c.montoEstimadoCobro ?? c.saldoActualizado), 0);

    return {
      semana: i + 1,
      inicio: semanaInicio.toISOString(),
      fin: semanaFin.toISOString(),
      ingresosProyectadosARS: ingresosProyectados,
      egresosEstimadosARS: costoSemanalARS,
      egresosEstimadosUSD: costoSemanalUSD,
    };
  });

  // Add cumulative saldo
  let acumARS = saldoARS;
  const semanasConAcum = semanas.map((s) => {
    acumARS = acumARS + s.ingresosProyectadosARS - s.egresosEstimadosARS;
    return { ...s, saldoAcumuladoARS: acumARS, semaforo: semaforo(acumARS / (costoMensualARS || 1)) };
  });

  const cuentasConProyeccionSerializable = cuentasConProyeccion.map((c) => ({
    id: c.id,
    clienteNombre: c.cliente.razonSocial,
    fechaEstimadaCobro: c.fechaEstimadaCobro?.toISOString() ?? null,
    montoEstimadoCobro: c.montoEstimadoCobro != null ? Number(c.montoEstimadoCobro) : null,
    saldoActualizado: Number(c.saldoActualizado),
  }));

  return NextResponse.json({
    saldoARS,
    saldoUSD,
    tipoCambioActual: tc,
    costoMensualARS,
    costoMensualUSD,
    runwayMesesARS,
    runwayMesesUSD,
    semaforoARS: semaforo(runwayMesesARS),
    semaforoUSD: semaforo(runwayMesesUSD),
    alertaConversion,
    semanas: semanasConAcum,
    cuentasConProyeccion: cuentasConProyeccionSerializable,
  });
}
