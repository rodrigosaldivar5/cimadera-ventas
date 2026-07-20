'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Users,
  Activity,
  BarChart3,
  Shield,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/* ── Tipos ─────────────────────────────────────────────────────────────── */

type EstadoCounts = {
  PENDIENTE: number;
  EN_PROCESO: number;
  FRENADO: number;
  FINALIZADO: number;
  PARA_ENVIAR: number;
  ENVIADO: number;
  APROBADO: number;
  RECHAZADO: number;
};

type Alerta = {
  tipo: string;
  mensaje: string;
  presupuestoId?: string;
  numero?: number;
  cantidad?: number;
  fuenteFecha: 'ultima_transicion' | 'fecha_actividad_comercial' | 'estado_actual';
};

type LeanIndicator = {
  tipo: string;
  label: string;
  cantidad: number;
  responsables: string[];
  ultimos: { id: string; numero: number; nombre: string | null }[];
};

type CargaResponsable = {
  id: string;
  nombre: string;
  pendientes: number;
  enProceso: number;
  frenados: number;
  finalizados: number;
  paraEnviar: number;
  enviados: number;
  abiertos: number;
  aTerminarHoy: number;
  completadosHoy: number;
  efectividadHoy: number | null;
};

type CalidadComercial = {
  enviados: number;
  conQueja: number;
  pctSatisfaccion: number;
  motivosPrincipales: { motivo: string; cantidad: number }[];
  responsablesMasQuejas: { nombre: string; cantidad: number }[];
};

type ResumenDireccion = {
  enviadoPeriodoARS: number;
  enviadoPeriodoUSD: number;
  aprobadoARS: number;
  aprobadoUSD: number;
  pendienteRespuestaARS: number;
  pendienteRespuestaUSD: number;
  grandesAbiertos: { id: string; numero: number; nombre: string | null; monto: number; moneda: string; cliente: string }[];
};

interface Props {
  estadoCounts: EstadoCounts;
  alertas: Alerta[];
  leanIndicators: LeanIndicator[];
  cargaResponsables: CargaResponsable[];
  calidadComercial: CalidadComercial;
  resumenDireccion: ResumenDireccion;
}

const ESTADO_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PENDIENTE: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  EN_PROCESO: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  FRENADO: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  FINALIZADO: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  PARA_ENVIAR: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  ENVIADO: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  APROBADO: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  RECHAZADO: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendientes',
  EN_PROCESO: 'En proceso',
  FRENADO: 'Frenados',
  FINALIZADO: 'Finalizados',
  PARA_ENVIAR: 'Para enviar',
  ENVIADO: 'Enviados',
  APROBADO: 'Aprobados',
  RECHAZADO: 'Rechazados',
};

function fmtARS(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtUSD(n: number) {
  return `U$D ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ── Componente principal ──────────────────────────────────────────────── */

export function DashboardOperativo({
  estadoCounts,
  alertas,
  leanIndicators,
  cargaResponsables,
  calidadComercial,
  resumenDireccion,
}: Props) {
  const abiertos =
    estadoCounts.PENDIENTE + estadoCounts.EN_PROCESO + estadoCounts.FRENADO +
    estadoCounts.FINALIZADO + estadoCounts.PARA_ENVIAR + estadoCounts.ENVIADO;

  return (
    <div className="space-y-6">
      {/* 1. Estado general comercial */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Estado general comercial</h3>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Abiertos" value={abiertos} bg="bg-slate-50" text="text-slate-800" border="border-slate-200" />
          {(['PENDIENTE', 'EN_PROCESO', 'FRENADO', 'FINALIZADO', 'PARA_ENVIAR', 'ENVIADO', 'APROBADO', 'RECHAZADO'] as const).map((estado) => {
            const c = ESTADO_COLORS[estado];
            return (
              <StatCard
                key={estado}
                label={ESTADO_LABELS[estado]}
                value={estadoCounts[estado]}
                bg={c.bg}
                text={c.text}
                border={c.border}
              />
            );
          })}
        </div>
      </div>

      {/* 2. Alertas operativas */}
      {alertas.length > 0 && <AlertasCard alertas={alertas} />}

      {/* 3. Indicadores Lean */}
      {leanIndicators.some((l) => l.cantidad > 0) && <LeanCard indicators={leanIndicators} />}

      {/* 4. Carga por responsable */}
      {cargaResponsables.length > 0 && <CargaResponsableCard data={cargaResponsables} />}

      {/* 5. Calidad comercial */}
      {calidadComercial.enviados > 0 && <CalidadCard data={calidadComercial} />}

      {/* 6. Resumen dirección */}
      <ResumenDireccionCard data={resumenDireccion} />
    </div>
  );
}

/* ── Sub-componentes ───────────────────────────────────────────────────── */

function StatCard({ label, value, bg, text, border }: { label: string; value: number; bg: string; text: string; border: string }) {
  return (
    <div className={`rounded-lg border ${border} ${bg} px-4 py-3`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`text-2xl font-bold ${text}`}>{value}</p>
    </div>
  );
}

const FUENTE_FECHA_LABEL: Record<string, string> = {
  ultima_transicion: 'Fecha: última transición al estado',
  fecha_actividad_comercial: 'Fecha: última actividad comercial',
  estado_actual: '',
};

function AlertasCard({ alertas }: { alertas: Alerta[] }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setOpen(!open)}>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            Alertas operativas
            <Badge variant="outline" className="ml-1 text-xs border-amber-300 text-amber-700">{alertas.length}</Badge>
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {alertas.map((a, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-amber-600 shrink-0">●</span>
                  <span className="text-slate-700 truncate" title={FUENTE_FECHA_LABEL[a.fuenteFecha] || undefined}>
                    {a.mensaje}
                  </span>
                  {a.cantidad && a.cantidad > 1 && (
                    <Badge variant="outline" className="text-[10px] shrink-0">{a.cantidad}</Badge>
                  )}
                  {FUENTE_FECHA_LABEL[a.fuenteFecha] && (
                    <span className="text-[10px] text-slate-400 shrink-0 hidden lg:inline" title={FUENTE_FECHA_LABEL[a.fuenteFecha]}>
                      ⓘ
                    </span>
                  )}
                </div>
                {a.presupuestoId && (
                  <Link href={`/presupuestos/${a.presupuestoId}`} className="text-[#00ADEF] hover:underline text-xs shrink-0 ml-2">
                    #{a.numero}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function LeanCard({ indicators }: { indicators: LeanIndicator[] }) {
  const [open, setOpen] = useState(true);
  const activos = indicators.filter((l) => l.cantidad > 0);
  if (activos.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setOpen(!open)}>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-orange-500" />
            Indicadores Lean
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activos.map((ind) => (
              <div key={ind.tipo} className="rounded-lg border border-orange-100 bg-orange-50/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-700">{ind.label}</p>
                  <span className="text-lg font-bold text-orange-600">{ind.cantidad}</span>
                </div>
                {ind.responsables.length > 0 && (
                  <p className="text-xs text-slate-500 mb-1">
                    Responsables: {ind.responsables.slice(0, 3).join(', ')}
                  </p>
                )}
                {ind.ultimos.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ind.ultimos.slice(0, 5).map((p) => (
                      <Link key={p.id} href={`/presupuestos/${p.id}`}>
                        <Badge variant="outline" className="text-[10px] cursor-pointer hover:border-orange-400">
                          #{p.numero}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function efectividadColor(pct: number): string {
  if (pct >= 80) return 'text-green-600';
  if (pct >= 50) return 'text-yellow-600';
  return 'text-red-600';
}

function CargaResponsableCard({ data }: { data: CargaResponsable[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-[#00ADEF]" />
          Carga por responsable
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="pb-2 pr-3 font-medium">Responsable</th>
                <th className="pb-2 pr-2 font-medium text-center">Abiertos</th>
                <th className="pb-2 pr-2 font-medium text-center"><span className="text-red-600">Pend.</span></th>
                <th className="pb-2 pr-2 font-medium text-center"><span className="text-yellow-600">En proc.</span></th>
                <th className="pb-2 pr-2 font-medium text-center"><span className="text-purple-600">Fren.</span></th>
                <th className="pb-2 pr-2 font-medium text-center"><span className="text-amber-600">Final.</span></th>
                <th className="pb-2 pr-2 font-medium text-center"><span className="text-blue-600">P/enviar</span></th>
                <th className="pb-2 pr-2 font-medium text-center"><span className="text-sky-600">Env.</span></th>
                <th className="pb-2 pr-2 font-medium text-center">Hoy</th>
                <th className="pb-2 pr-2 font-medium text-center"><span className="text-green-600">Compl.</span></th>
                <th className="pb-2 font-medium text-center">Efect.</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-2 pr-3 font-medium text-slate-700">
                    <Link href="/presupuestos/mi-trabajo" className="hover:text-[#00ADEF]">
                      {r.nombre}
                    </Link>
                  </td>
                  <td className="py-2 pr-2 text-center font-semibold">{r.abiertos}</td>
                  <Cell n={r.pendientes} color="red" />
                  <Cell n={r.enProceso} color="yellow" />
                  <Cell n={r.frenados} color="purple" />
                  <Cell n={r.finalizados} color="amber" />
                  <Cell n={r.paraEnviar} color="blue" />
                  <Cell n={r.enviados} color="sky" />
                  <td className="py-2 pr-2 text-center">{r.aTerminarHoy || '-'}</td>
                  <td className="py-2 pr-2 text-center">
                    {r.aTerminarHoy > 0 ? (
                      <span className="text-green-600 font-medium">{r.completadosHoy}/{r.aTerminarHoy}</span>
                    ) : '-'}
                  </td>
                  <td className="py-2 text-center font-semibold">
                    {r.efectividadHoy != null ? (
                      <span className={efectividadColor(r.efectividadHoy)}>{r.efectividadHoy}%</span>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Cell({ n, color }: { n: number; color: string }) {
  if (n === 0) return <td className="py-2 pr-2 text-center text-slate-300">-</td>;
  return <td className={`py-2 pr-2 text-center font-medium text-${color}-600`}>{n}</td>;
}

function CalidadCard({ data }: { data: CalidadComercial }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-emerald-500" />
          Calidad comercial
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-100 p-3 text-center">
            <p className="text-xs text-slate-500">Enviados</p>
            <p className="text-2xl font-bold text-slate-800">{data.enviados}</p>
          </div>
          <div className="rounded-lg border border-red-100 p-3 text-center">
            <p className="text-xs text-slate-500">Con queja</p>
            <p className="text-2xl font-bold text-red-600">{data.conQueja}</p>
          </div>
          <div className="rounded-lg border border-green-100 p-3 text-center">
            <p className="text-xs text-slate-500">Satisfacción</p>
            <p className="text-2xl font-bold text-green-600">{data.pctSatisfaccion}%</p>
          </div>
        </div>
        {data.motivosPrincipales.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">Motivos principales de queja</p>
            <div className="flex flex-wrap gap-2">
              {data.motivosPrincipales.map((m) => (
                <Badge key={m.motivo} variant="outline" className="text-xs">
                  {m.motivo} ({m.cantidad})
                </Badge>
              ))}
            </div>
          </div>
        )}
        {data.responsablesMasQuejas.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-500 mb-1">Más quejas por responsable</p>
            <div className="flex flex-wrap gap-2">
              {data.responsablesMasQuejas.map((r) => (
                <Badge key={r.nombre} variant="outline" className="text-xs border-red-200 text-red-600">
                  {r.nombre} ({r.cantidad})
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResumenDireccionCard({ data }: { data: ResumenDireccion }) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setOpen(!open)}>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-500" />
            Resumen dirección
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MontoCard label="Enviado en período ARS" monto={fmtARS(data.enviadoPeriodoARS)} color="text-sky-700" />
            <MontoCard label="Enviado en período USD" monto={fmtUSD(data.enviadoPeriodoUSD)} color="text-sky-700" />
            <MontoCard label="Aprobado ARS" monto={fmtARS(data.aprobadoARS)} color="text-green-700" />
            <MontoCard label="Aprobado USD" monto={fmtUSD(data.aprobadoUSD)} color="text-green-700" />
            <MontoCard label="Pend. respuesta actual ARS" monto={fmtARS(data.pendienteRespuestaARS)} color="text-amber-700" />
            <MontoCard label="Pend. respuesta actual USD" monto={fmtUSD(data.pendienteRespuestaUSD)} color="text-amber-700" />
          </div>
          {data.grandesAbiertos.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500 mb-2">Presupuestos grandes abiertos</p>
              {data.grandesAbiertos.filter((p) => p.moneda === 'ARS').length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">ARS (umbral: $5.000.000)</p>
                  <div className="space-y-1.5">
                    {data.grandesAbiertos.filter((p) => p.moneda === 'ARS').map((p) => (
                      <GrandeAbiertoRow key={p.id} p={p} />
                    ))}
                  </div>
                </div>
              )}
              {data.grandesAbiertos.filter((p) => p.moneda === 'USD').length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">USD (umbral: U$D 5.000)</p>
                  <div className="space-y-1.5">
                    {data.grandesAbiertos.filter((p) => p.moneda === 'USD').map((p) => (
                      <GrandeAbiertoRow key={p.id} p={p} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function GrandeAbiertoRow({ p }: { p: { id: string; numero: number; nombre: string | null; monto: number; moneda: string; cliente: string } }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Link href={`/presupuestos/${p.id}`} className="font-medium text-[#00ADEF] hover:underline shrink-0">
          #{p.numero}
        </Link>
        <span className="text-slate-600 truncate">{p.nombre ?? 'Sin nombre'}</span>
        <span className="text-xs text-slate-400 truncate">{p.cliente}</span>
      </div>
      <span className="text-sm font-semibold text-slate-700 shrink-0 ml-2">
        {p.moneda === 'USD' ? fmtUSD(p.monto) : fmtARS(p.monto)}
      </span>
    </div>
  );
}

function MontoCard({ label, monto, color }: { label: string; monto: string; color: string }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{monto}</p>
    </div>
  );
}
