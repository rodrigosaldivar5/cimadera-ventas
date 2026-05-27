import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function dentroDeXDias(fecha: Date | null, dias: number): boolean {
  if (!fecha) return false;
  const hoy = new Date();
  const limite = new Date(hoy);
  limite.setDate(hoy.getDate() + dias);
  return fecha >= hoy && fecha <= limite;
}

const pesos: Record<string, number> = { ALTA: 1.0, MEDIA: 0.6, BAJA: 0.3 };

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const [ultimoSaldo, costosFijos, cuentas] = await Promise.all([
    prisma.saldoCaja.findFirst({ orderBy: { fecha: 'desc' } }),
    prisma.costoFijo.findMany({ where: { activo: true } }),
    prisma.cuentaCorriente.findMany({
      where: { estado: 'SALDO_PENDIENTE' },
      include: {
        cliente: { select: { razonSocial: true } },
        obra: { select: { nombre: true } },
      },
    }),
  ]);

  const saldoActual = ultimoSaldo?.saldo ?? 0;
  const totalEgresosMensuales = costosFijos.reduce((sum, c) => sum + c.monto, 0);
  const egresosSemanal = totalEgresosMensuales / 4.33;

  const cuentasConFecha = cuentas.filter((c) => c.proximoCobro !== null);
  const saldo = (c: typeof cuentas[0]) => Number(c.saldoActualizado);
  const prob  = (c: typeof cuentas[0]) => pesos[c.probabilidadCobro] ?? 0.6;

  const ingresos30 = cuentasConFecha
    .filter((c) => dentroDeXDias(c.proximoCobro, 30))
    .reduce((s, c) => s + saldo(c) * prob(c), 0);
  const ingresos60 = cuentasConFecha
    .filter((c) => dentroDeXDias(c.proximoCobro, 60))
    .reduce((s, c) => s + saldo(c) * prob(c), 0);
  const ingresos90 = cuentasConFecha
    .filter((c) => dentroDeXDias(c.proximoCobro, 90))
    .reduce((s, c) => s + saldo(c) * prob(c), 0);

  const runway = egresosSemanal > 0 ? (saldoActual + ingresos30) / egresosSemanal : 999;
  const semaforo = runway >= 12 ? 'VERDE' : runway >= 6 ? 'AMARILLO' : 'ROJO';

  // Proyección semanal (8 semanas) para el gráfico
  const proyeccionSemanal = Array.from({ length: 8 }, (_, i) => {
    const desde = i * 7;
    const hasta = (i + 1) * 7;
    const semana = cuentasConFecha.filter((c) => {
      const dias = c.proximoCobro
        ? Math.ceil((c.proximoCobro.getTime() - Date.now()) / 86400000)
        : -1;
      return dias > desde && dias <= hasta;
    });
    return {
      semana: `S${i + 1}`,
      alta:  semana.filter((c) => c.probabilidadCobro === 'ALTA').reduce((s, c) => s + saldo(c), 0),
      media: semana.filter((c) => c.probabilidadCobro === 'MEDIA').reduce((s, c) => s + saldo(c), 0),
      baja:  semana.filter((c) => c.probabilidadCobro === 'BAJA').reduce((s, c) => s + saldo(c), 0),
      egresosSemanal,
    };
  });

  return NextResponse.json({
    saldoActual,
    ingresos30,
    ingresos60,
    ingresos90,
    totalEgresosMensuales,
    egresosSemanal,
    runway: Math.round(runway * 10) / 10,
    semaforo,
    proyeccionSemanal,
    ultimoSaldo,
    totalCuentasPendientes: cuentas.length,
    cuentasSinFecha: cuentas.length - cuentasConFecha.length,
  });
}
