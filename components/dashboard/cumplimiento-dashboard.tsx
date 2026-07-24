'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Timer,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from 'lucide-react';

function formatDuracion(minutosCalendario: number, minutosHabiles: number): { calendario: string; habiles: string } {
  return {
    calendario: fmtMinutos(minutosCalendario),
    habiles: fmtMinutos(minutosHabiles),
  };
}

function fmtMinutos(min: number): string {
  if (min <= 0) return 'menos de 1 hora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  if (rh === 0) return `${d} día${d > 1 ? 's' : ''}`;
  return `${d} día${d > 1 ? 's' : ''} ${rh} h`;
}

function fmtHoras(horasHabiles: number): string {
  const h = Math.floor(horasHabiles);
  const m = Math.round((horasHabiles - h) * 60);
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/* ── Tipos ─────────────────────────────────────────────────────────────── */

type EstandarResumen = {
  finalizados: number;
  enTermino: number;
  demorados: number;
  abiertosVencidos: number;
  sinTrazabilidad: number;
  cumplimiento: number | null;
};

type EstandarRow = {
  id: string;
  numero: number;
  cliente: string;
  obra: string | null;
  responsable: string | null;
  estado: string;
  horasHabiles: number;
  inicio: string | null;
  ultimoFinalizado: string | null;
  resultado: string;
  excesoHoras?: number;
};

type EntregaResumen = {
  conFecha: number;
  enTermino: number;
  fueraDeTermino: number;
  vencidosSinEnviar: number;
  pendientes: number;
  sinTrazabilidad: number;
  cumplimiento: number | null;
};

type EntregaRow = {
  id: string;
  numero: number;
  cliente: string;
  obra: string | null;
  responsable: string | null;
  estado: string;
  fechaPrometida: string | null;
  primeraFechaEnviado: string | null;
  minutosDemoraCalendario: number;
  minutosDemoraHabiles: number;
  resultado: string;
};

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  FRENADO: 'Frenado',
  FINALIZADO: 'Finalizado',
  PARA_ENVIAR: 'Para enviar',
  ENVIADO: 'Enviado',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
};

/* ── Props ─────────────────────────────────────────────────────────────── */

interface Props {
  desde?: string;
  hasta?: string;
  responsableId?: string;
}

/* ── Componente principal ──────────────────────────────────────────────── */

export function CumplimientoDashboard({ desde, hasta, responsableId }: Props) {
  const [estandar, setEstandar] = useState<{ resumen: EstandarResumen; demorados: EstandarRow[]; abiertosVencidos: EstandarRow[] } | null>(null);
  const [entrega, setEntrega] = useState<{ resumen: EntregaResumen; vencidosSinEnviar: EntregaRow[]; fueraDeTermino: EntregaRow[]; sinTrazabilidad: EntregaRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    if (responsableId) params.set('responsableId', responsableId);
    const qs = params.toString();

    const opts = { cache: 'no-store' as const };

    Promise.allSettled([
      fetch(`/api/dashboard/estandar?${qs}`, opts).then(r => { if (!r.ok) throw new Error(`Estándar: ${r.status}`); return r.json(); }),
      fetch(`/api/dashboard/cumplimiento-entrega?${qs}`, opts).then(r => { if (!r.ok) throw new Error(`Entrega: ${r.status}`); return r.json(); }),
    ]).then(([eRes, entRes]) => {
      if (eRes.status === 'fulfilled') setEstandar(eRes.value);
      else setEstandar(null);
      if (entRes.status === 'fulfilled') setEntrega(entRes.value);
      else setEntrega(null);
      if (eRes.status === 'rejected' && entRes.status === 'rejected') {
        setError('No se pudieron cargar los indicadores de cumplimiento.');
      } else if (eRes.status === 'rejected') {
        setError('No se pudo cargar cumplimiento estándar.');
      } else if (entRes.status === 'rejected') {
        setError('No se pudo cargar cumplimiento de entregas.');
      }
      setLoading(false);
    });
  }, [desde, hasta, responsableId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          Calculando cumplimiento…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {estandar && <EstandarBlock data={estandar} />}
      {entrega && <EntregaBlock data={entrega} />}
    </div>
  );
}

/* ── Bloque Estándar ──────────────────────────────────────────────────── */

function EstandarBlock({ data }: { data: { resumen: EstandarResumen; demorados: EstandarRow[]; abiertosVencidos: EstandarRow[] } }) {
  const { resumen } = data;
  const [seccionVisible, setSeccionVisible] = useState<'demorados' | 'abiertos' | null>(
    data.demorados.length > 0 ? 'demorados' : data.abiertosVencidos.length > 0 ? 'abiertos' : null,
  );
  const [limDemorados, setLimDemorados] = useState(10);
  const [limAbiertos, setLimAbiertos] = useState(10);

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Cumplimiento de presupuestos estándar
      </h3>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-4">
        <MetricCard label="Finalizados" value={resumen.finalizados} icon={<Clock className="h-4 w-4" />} color="slate" />
        <MetricCard
          label="En término" value={resumen.enTermino} icon={<CheckCircle2 className="h-4 w-4" />} color="green"
          onClick={() => setSeccionVisible(null)}
        />
        <MetricCard
          label="Demorados" value={resumen.demorados} icon={<XCircle className="h-4 w-4" />} color="red"
          onClick={() => setSeccionVisible('demorados')}
          active={seccionVisible === 'demorados'}
        />
        <MetricCard
          label="Abiertos vencidos" value={resumen.abiertosVencidos} icon={<AlertTriangle className="h-4 w-4" />} color="amber"
          onClick={() => setSeccionVisible('abiertos')}
          active={seccionVisible === 'abiertos'}
        />
        <MetricCard
          label="Cumplimiento"
          value={resumen.cumplimiento != null ? `${resumen.cumplimiento}%` : '—'}
          icon={<TrendingUp className="h-4 w-4" />}
          color={resumen.cumplimiento != null && resumen.cumplimiento >= 80 ? 'green' : resumen.cumplimiento != null && resumen.cumplimiento >= 50 ? 'amber' : 'red'}
          isText
        />
        <MetricCard
          label="Sin trazabilidad" value={resumen.sinTrazabilidad} icon={<HelpCircle className="h-4 w-4" />} color="gray"
        />
      </div>

      {seccionVisible === 'demorados' && data.demorados.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Estándares demorados
              <span className="text-xs font-normal text-slate-400">({data.demorados.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-4 py-2">Nro</th>
                    <th className="px-4 py-2">Cliente</th>
                    <th className="px-4 py-2">Obra</th>
                    <th className="px-4 py-2">Responsable</th>
                    <th className="px-4 py-2 text-right">Horas hábiles</th>
                    <th className="px-4 py-2">Inicio</th>
                    <th className="px-4 py-2">Últ. finalizado</th>
                    <th className="px-4 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.demorados.slice(0, limDemorados).map((r) => (
                    <tr key={r.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <Link href={`/presupuestos/${r.id}`} className="font-semibold text-sky-600 hover:underline">#{r.numero}</Link>
                      </td>
                      <td className="px-4 py-2 max-w-[150px] truncate">{r.cliente}</td>
                      <td className="px-4 py-2 text-slate-500 max-w-[120px] truncate">{r.obra ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-500">{r.responsable ?? '—'}</td>
                      <td className="px-4 py-2 text-right font-mono text-red-600">{fmtHoras(r.horasHabiles)}</td>
                      <td className="px-4 py-2 text-slate-500">{fmtFecha(r.inicio)}</td>
                      <td className="px-4 py-2 text-slate-500">{fmtFecha(r.ultimoFinalizado)}</td>
                      <td className="px-4 py-2 text-xs">{ESTADO_LABEL[r.estado] ?? r.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.demorados.length > limDemorados && (
              <div className="p-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setLimDemorados(prev => prev + 20)}>
                  Ver más ({data.demorados.length - limDemorados} restantes)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {seccionVisible === 'abiertos' && data.abiertosVencidos.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Estándares abiertos vencidos
              <span className="text-xs font-normal text-slate-400">Snapshot actual</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-4 py-2">Nro</th>
                    <th className="px-4 py-2">Cliente</th>
                    <th className="px-4 py-2">Obra</th>
                    <th className="px-4 py-2">Responsable</th>
                    <th className="px-4 py-2">Estado</th>
                    <th className="px-4 py-2 text-right">Horas hábiles</th>
                    <th className="px-4 py-2 text-right">Exceso s/ 27h</th>
                    <th className="px-4 py-2">Inicio</th>
                  </tr>
                </thead>
                <tbody>
                  {data.abiertosVencidos.slice(0, limAbiertos).map((r) => (
                    <tr key={r.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <Link href={`/presupuestos/${r.id}`} className="font-semibold text-sky-600 hover:underline">#{r.numero}</Link>
                      </td>
                      <td className="px-4 py-2 max-w-[150px] truncate">{r.cliente}</td>
                      <td className="px-4 py-2 text-slate-500 max-w-[120px] truncate">{r.obra ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-500">{r.responsable ?? '—'}</td>
                      <td className="px-4 py-2 text-xs">{ESTADO_LABEL[r.estado] ?? r.estado}</td>
                      <td className="px-4 py-2 text-right font-mono text-amber-600">{fmtHoras(r.horasHabiles)}</td>
                      <td className="px-4 py-2 text-right font-mono text-red-600">+{fmtHoras(r.excesoHoras ?? 0)}</td>
                      <td className="px-4 py-2 text-slate-500">{fmtFecha(r.inicio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.abiertosVencidos.length > limAbiertos && (
              <div className="p-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setLimAbiertos(prev => prev + 20)}>
                  Ver más ({data.abiertosVencidos.length - limAbiertos} restantes)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Bloque Entrega ───────────────────────────────────────────────────── */

function EntregaBlock({ data }: { data: { resumen: EntregaResumen; vencidosSinEnviar: EntregaRow[]; fueraDeTermino: EntregaRow[]; sinTrazabilidad: EntregaRow[] } }) {
  const { resumen } = data;
  const [seccionVisible, setSeccionVisible] = useState<'vencidos' | 'tarde' | 'sinTraz' | null>(
    data.vencidosSinEnviar.length > 0 ? 'vencidos' : data.fueraDeTermino.length > 0 ? 'tarde' : null,
  );
  const [limVencidos, setLimVencidos] = useState(10);
  const [limTarde, setLimTarde] = useState(10);
  const [limSinTraz, setLimSinTraz] = useState(10);

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Cumplimiento de fechas prometidas
      </h3>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 mb-4">
        <MetricCard label="Con fecha" value={resumen.conFecha} icon={<Clock className="h-4 w-4" />} color="slate" />
        <MetricCard
          label="A tiempo" value={resumen.enTermino} icon={<CheckCircle2 className="h-4 w-4" />} color="green"
          onClick={() => setSeccionVisible(null)}
        />
        <MetricCard
          label="Entregados tarde" value={resumen.fueraDeTermino} icon={<Timer className="h-4 w-4" />} color="red"
          onClick={() => setSeccionVisible('tarde')}
          active={seccionVisible === 'tarde'}
        />
        <MetricCard
          label="Vencidos sin enviar" value={resumen.vencidosSinEnviar} icon={<XCircle className="h-4 w-4" />} color="red"
          onClick={() => setSeccionVisible('vencidos')}
          active={seccionVisible === 'vencidos'}
        />
        <MetricCard
          label="Por vencer" value={resumen.pendientes} icon={<AlertTriangle className="h-4 w-4" />} color="amber"
        />
        <MetricCard
          label="Sin trazabilidad" value={resumen.sinTrazabilidad} icon={<HelpCircle className="h-4 w-4" />} color="gray"
          onClick={() => setSeccionVisible('sinTraz')}
          active={seccionVisible === 'sinTraz'}
        />
        <MetricCard
          label="Cumplimiento"
          value={resumen.cumplimiento != null ? `${resumen.cumplimiento}%` : '—'}
          icon={<TrendingUp className="h-4 w-4" />}
          color={resumen.cumplimiento != null && resumen.cumplimiento >= 80 ? 'green' : resumen.cumplimiento != null && resumen.cumplimiento >= 50 ? 'amber' : 'red'}
          isText
        />
      </div>

      {seccionVisible === 'vencidos' && data.vencidosSinEnviar.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Vencidos sin enviar
              <span className="text-xs font-normal text-red-400">Urgente actual</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-4 py-2">Nro</th>
                    <th className="px-4 py-2">Cliente</th>
                    <th className="px-4 py-2">Obra</th>
                    <th className="px-4 py-2">Responsable</th>
                    <th className="px-4 py-2">Prometida</th>
                    <th className="px-4 py-2">Estado</th>
                    <th className="px-4 py-2 text-right">Demora calendario</th>
                    <th className="px-4 py-2 text-right">Demora hábil</th>
                  </tr>
                </thead>
                <tbody>
                  {data.vencidosSinEnviar.slice(0, limVencidos).map((r) => {
                    const dur = formatDuracion(r.minutosDemoraCalendario, r.minutosDemoraHabiles);
                    return (
                      <tr key={r.id} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <Link href={`/presupuestos/${r.id}`} className="font-semibold text-sky-600 hover:underline">#{r.numero}</Link>
                        </td>
                        <td className="px-4 py-2 max-w-[150px] truncate">{r.cliente}</td>
                        <td className="px-4 py-2 text-slate-500 max-w-[120px] truncate">{r.obra ?? '—'}</td>
                        <td className="px-4 py-2 text-slate-500">{r.responsable ?? '—'}</td>
                        <td className="px-4 py-2 text-slate-500">{fmtFecha(r.fechaPrometida)}</td>
                        <td className="px-4 py-2 text-xs">{ESTADO_LABEL[r.estado] ?? r.estado}</td>
                        <td className="px-4 py-2 text-right font-mono text-red-600">{dur.calendario}</td>
                        <td className="px-4 py-2 text-right font-mono text-red-500">{dur.habiles}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data.vencidosSinEnviar.length > limVencidos && (
              <div className="p-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setLimVencidos(prev => prev + 20)}>
                  Ver más ({data.vencidosSinEnviar.length - limVencidos} restantes)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {seccionVisible === 'tarde' && data.fueraDeTermino.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Timer className="h-4 w-4 text-red-500" />
              Entregados fuera de término
              <span className="text-xs font-normal text-slate-400">Histórico</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-4 py-2">Nro</th>
                    <th className="px-4 py-2">Cliente</th>
                    <th className="px-4 py-2">Obra</th>
                    <th className="px-4 py-2">Responsable</th>
                    <th className="px-4 py-2">Prometida</th>
                    <th className="px-4 py-2">Primer envío</th>
                    <th className="px-4 py-2 text-right">Demora calendario</th>
                    <th className="px-4 py-2 text-right">Demora hábil</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fueraDeTermino.slice(0, limTarde).map((r) => {
                    const dur = formatDuracion(r.minutosDemoraCalendario, r.minutosDemoraHabiles);
                    return (
                      <tr key={r.id} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-2">
                          <Link href={`/presupuestos/${r.id}`} className="font-semibold text-sky-600 hover:underline">#{r.numero}</Link>
                        </td>
                        <td className="px-4 py-2 max-w-[150px] truncate">{r.cliente}</td>
                        <td className="px-4 py-2 text-slate-500 max-w-[120px] truncate">{r.obra ?? '—'}</td>
                        <td className="px-4 py-2 text-slate-500">{r.responsable ?? '—'}</td>
                        <td className="px-4 py-2 text-slate-500">{fmtFecha(r.fechaPrometida)}</td>
                        <td className="px-4 py-2 text-slate-500">{fmtFecha(r.primeraFechaEnviado)}</td>
                        <td className="px-4 py-2 text-right font-mono text-red-600">{dur.calendario}</td>
                        <td className="px-4 py-2 text-right font-mono text-red-500">{dur.habiles}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data.fueraDeTermino.length > limTarde && (
              <div className="p-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setLimTarde(prev => prev + 20)}>
                  Ver más ({data.fueraDeTermino.length - limTarde} restantes)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {seccionVisible === 'sinTraz' && data.sinTrazabilidad.length > 0 && (
        <Card className="border-gray-200">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-gray-400" />
              Históricos sin trazabilidad
              <span className="text-xs font-normal text-gray-400">Sin transición ENVIADO registrada</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-4 py-2">Nro</th>
                    <th className="px-4 py-2">Cliente</th>
                    <th className="px-4 py-2">Responsable</th>
                    <th className="px-4 py-2">Prometida</th>
                    <th className="px-4 py-2">Estado actual</th>
                    <th className="px-4 py-2">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sinTrazabilidad.slice(0, limSinTraz).map((r) => (
                    <tr key={r.id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <Link href={`/presupuestos/${r.id}`} className="font-semibold text-sky-600 hover:underline">#{r.numero}</Link>
                      </td>
                      <td className="px-4 py-2 max-w-[150px] truncate">{r.cliente}</td>
                      <td className="px-4 py-2 text-slate-500">{r.responsable ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-500">{fmtFecha(r.fechaPrometida)}</td>
                      <td className="px-4 py-2 text-xs">{ESTADO_LABEL[r.estado] ?? r.estado}</td>
                      <td className="px-4 py-2 text-xs text-gray-400">Sin transición ENVIADO registrada</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.sinTrazabilidad.length > limSinTraz && (
              <div className="p-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setLimSinTraz(prev => prev + 20)}>
                  Ver más ({data.sinTrazabilidad.length - limSinTraz} restantes)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── MetricCard ────────────────────────────────────────────────────────── */

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  green: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', icon: 'text-emerald-500' },
  red: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', icon: 'text-red-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', icon: 'text-amber-500' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-200', icon: 'text-slate-400' },
  gray: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', icon: 'text-gray-400' },
};

function MetricCard({
  label,
  value,
  icon,
  color,
  onClick,
  active,
  isText,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
  active?: boolean;
  isText?: boolean;
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.slate;
  return (
    <div
      className={`rounded-lg border ${c.border} ${c.bg} px-4 py-3 ${onClick ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''} ${active ? 'ring-2 ring-sky-400' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={c.icon}>{icon}</span>
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
      <p className={`text-xl font-bold ${c.text}`}>
        {isText ? value : value}
      </p>
    </div>
  );
}
