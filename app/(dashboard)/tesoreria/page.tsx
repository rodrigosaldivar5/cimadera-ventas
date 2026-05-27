export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Semaforo } from '@/components/tesoreria/semaforo';
import { CashflowChart } from '@/components/tesoreria/cashflow-chart';
import { CobrosTable } from '@/components/tesoreria/cobros-table';
import { ExternalLink } from 'lucide-react';

const ROLES_PERMITIDOS = ['ADMIN', 'COORDINACION_ADMIN', 'COORDINACION_GENERAL'];

function dentroDeXDias(fecha: Date | null, dias: number) {
  if (!fecha) return false;
  const hoy = new Date();
  const limite = new Date(hoy);
  limite.setDate(hoy.getDate() + dias);
  return fecha >= hoy && fecha <= limite;
}

const pesos: Record<string, number> = { ALTA: 1.0, MEDIA: 0.6, BAJA: 0.3 };

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

export default async function TesoreriaPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!ROLES_PERMITIDOS.includes(session.user.rolNombre ?? '')) redirect('/dashboard');

  const [ultimoSaldo, costosFijos, cuentas] = await Promise.all([
    prisma.saldoCaja.findFirst({ orderBy: { fecha: 'desc' } }),
    prisma.costoFijo.findMany({ where: { activo: true } }),
    prisma.cuentaCorriente.findMany({
      where: { estado: 'SALDO_PENDIENTE' },
      include: {
        cliente: { select: { razonSocial: true } },
        obra: { select: { nombre: true } },
      },
      orderBy: { proximoCobro: 'asc' },
    }),
  ]);

  const saldoActual = ultimoSaldo?.saldo ?? 0;
  const totalEgresosMensuales = costosFijos.reduce((sum, c) => sum + c.monto, 0);
  const egresosSemanal = totalEgresosMensuales / 4.33;

  const cuentasConFecha = cuentas.filter((c) => c.proximoCobro !== null);
  const saldo = (c: typeof cuentas[0]) => Number(c.saldoActualizado);
  const prob  = (c: typeof cuentas[0]) => pesos[c.probabilidadCobro] ?? 0.6;

  const ingresos30 = cuentasConFecha.filter((c) => dentroDeXDias(c.proximoCobro, 30)).reduce((s, c) => s + saldo(c) * prob(c), 0);
  const ingresos60 = cuentasConFecha.filter((c) => dentroDeXDias(c.proximoCobro, 60)).reduce((s, c) => s + saldo(c) * prob(c), 0);
  const ingresos90 = cuentasConFecha.filter((c) => dentroDeXDias(c.proximoCobro, 90)).reduce((s, c) => s + saldo(c) * prob(c), 0);

  const runway = egresosSemanal > 0 ? (saldoActual + ingresos30) / egresosSemanal : 999;
  const runwayDisplay = Math.min(runway, 99);
  const semaforo: 'VERDE' | 'AMARILLO' | 'ROJO' = runway >= 12 ? 'VERDE' : runway >= 6 ? 'AMARILLO' : 'ROJO';

  const proyeccionSemanal = Array.from({ length: 8 }, (_, i) => {
    const desde = i * 7;
    const hasta = (i + 1) * 7;
    const semana = cuentasConFecha.filter((c) => {
      const dias = c.proximoCobro ? Math.ceil((c.proximoCobro.getTime() - Date.now()) / 86400000) : -1;
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

  const cuentasSerializadas = cuentas.map((c) => ({
    ...c,
    saldoActualizado: Number(c.saldoActualizado),
    proximoCobro: c.proximoCobro?.toISOString() ?? null,
  }));

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tesorería</h1>
          <p className="text-slate-500 text-sm">Cashflow proyectado en 30 / 60 / 90 días</p>
        </div>
        <div className="flex gap-2">
          <Link href="/tesoreria/costos" className="text-sm text-sky-600 hover:underline flex items-center gap-1">
            Costos fijos <ExternalLink className="h-3 w-3" />
          </Link>
          <span className="text-slate-300">·</span>
          <Link href="/tesoreria/saldo" className="text-sm text-sky-600 hover:underline flex items-center gap-1">
            Registrar saldo <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* HERO — Semáforo */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 flex justify-center">
        <Semaforo estado={semaforo} runway={Math.round(runwayDisplay * 10) / 10} />
      </div>

      {/* ROW 1 — KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Saldo actual en caja', value: fmt(saldoActual), color: 'text-slate-800' },
          { label: 'Ingresos proyectados 30d', value: fmt(ingresos30), color: 'text-sky-700' },
          { label: 'Ingresos proyectados 60d', value: fmt(ingresos60), color: 'text-sky-600' },
          { label: 'Egresos del mes', value: fmt(totalEgresosMensuales), color: 'text-red-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500 mb-1">{kpi.label}</p>
            <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ROW 2 — Gráfico */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Proyección semanal — próximas 8 semanas</h2>
        <CashflowChart data={proyeccionSemanal} />
      </div>

      {/* ROW 3 — Tabla de cobros */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-semibold text-slate-700">Cobros pendientes</h2>
          <span className="text-xs text-slate-400">
            {cuentas.length - cuentasConFecha.length} sin fecha asignada
          </span>
        </div>
        <CobrosTable cuentasIniciales={cuentasSerializadas} />
      </div>

      {/* ROW 4 — Footer */}
      {ultimoSaldo && (
        <div className="text-sm text-slate-500 flex items-center gap-2">
          <span>Último saldo registrado: {new Date(ultimoSaldo.fecha).toLocaleDateString('es-AR')}</span>
          <span>·</span>
          <Link href="/tesoreria/saldo" className="text-sky-600 hover:underline">Actualizar</Link>
        </div>
      )}
      {!ultimoSaldo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No hay saldo de caja registrado.{' '}
          <Link href="/tesoreria/saldo" className="underline font-medium">Registrá el saldo actual</Link> para que el runway sea preciso.
        </div>
      )}
    </div>
  );
}
