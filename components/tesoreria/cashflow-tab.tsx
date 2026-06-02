'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';

type CashflowData = {
  saldoARS: number;
  saldoUSD: number;
  tipoCambioActual: number;
  costoMensualARS: number;
  costoMensualUSD: number;
  runwayMesesARS: number;
  runwayMesesUSD: number;
  semaforoARS: 'verde' | 'amarillo' | 'rojo';
  semaforoUSD: 'verde' | 'amarillo' | 'rojo';
  alertaConversion: {
    tipo: 'ARS_BAJO_USD_DISPONIBLE' | 'USD_BAJO_ARS_DISPONIBLE';
    montoSugeridoConvertir: number;
  } | null;
  semanas: {
    semana: number;
    inicio: string;
    fin: string;
    ingresosProyectadosARS: number;
    egresosEstimadosARS: number;
    saldoAcumuladoARS: number;
    semaforo: 'verde' | 'amarillo' | 'rojo';
    esProyectado: boolean;
  }[];
};

const SEMAFORO_COLOR: Record<string, string> = {
  verde: '#22c55e',
  amarillo: '#f59e0b',
  rojo: '#ef4444',
};

function fmtARS(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtUSD(n: number) {
  return `U$D ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtARSShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return fmtARS(n);
}

export function CashflowTab() {
  const [data, setData] = useState<CashflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/tesoreria/cashflow-proyectado')
      .then((r) => r.json())
      .then((d) => { setData(d); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-center text-slate-400 py-8">Error al cargar datos de cashflow.</p>;
  }

  const chartData = data.semanas.map((s) => ({
    name: `S${s.semana}`,
    ingresos: s.ingresosProyectadosARS,
    egresosReales: s.esProyectado ? 0 : s.egresosEstimadosARS,
    egresosProyectados: s.esProyectado ? s.egresosEstimadosARS : 0,
  }));

  const hasProjectedCosts = data.semanas.some((s) => s.esProyectado);

  return (
    <div className="space-y-6">
      {/* Runway cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Runway ARS', meses: data.runwayMesesARS, semaforo: data.semaforoARS, saldo: fmtARS(data.saldoARS), costo: fmtARS(data.costoMensualARS) },
          { label: 'Runway USD', meses: data.runwayMesesUSD, semaforo: data.semaforoUSD, saldo: fmtUSD(data.saldoUSD), costo: fmtUSD(data.costoMensualUSD) },
        ].map((r) => (
          <Card key={r.label} className={`border-2 ${r.semaforo === 'rojo' ? 'border-red-400' : r.semaforo === 'amarillo' ? 'border-amber-400' : 'border-green-400'}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">{r.label}</p>
                  <p className="text-3xl font-bold mt-1" style={{ color: SEMAFORO_COLOR[r.semaforo] }}>
                    {Math.min(r.meses, 99).toFixed(1)} meses
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Saldo: {r.saldo} · Costo/mes: {r.costo}</p>
                </div>
                <div
                  className="h-12 w-12 rounded-full flex-shrink-0"
                  style={{ backgroundColor: SEMAFORO_COLOR[r.semaforo] }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerta conversión */}
      {data.alertaConversion && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            {data.alertaConversion.tipo === 'ARS_BAJO_USD_DISPONIBLE' ? (
              <>
                <p className="font-semibold text-amber-800 text-sm">Runway ARS bajo — Conversión sugerida</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Considerar convertir{' '}
                  <strong>{fmtUSD(data.alertaConversion.montoSugeridoConvertir)}</strong> de la caja USD para cubrir 3 meses de costos en ARS.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-amber-800 text-sm">Runway USD bajo — Conversión sugerida</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Considerar convertir{' '}
                  <strong>{fmtARS(data.alertaConversion.montoSugeridoConvertir)}</strong> de la caja ARS para cubrir 3 meses de costos en USD.
                </p>
              </>
            )}
          </div>
          <ArrowRightLeft className="h-4 w-4 text-amber-600 shrink-0" />
        </div>
      )}

      {/* Cashflow bar chart */}
      <div>
        <h3 className="text-sm font-semibold text-slate-600 mb-3">Gráfico cashflow 12 semanas (ARS)</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="20%" barGap={2}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={fmtARSShort} tick={{ fontSize: 11 }} width={70} />
              <Tooltip
                formatter={(value, name) => [
                  fmtARS(Number(value ?? 0)),
                  name === 'ingresos' ? 'Ingresos proy.' : name === 'egresosReales' ? 'Costos reales' : 'Costos proy.*',
                ]}
              />
              <Legend
                formatter={(value) =>
                  value === 'ingresos' ? 'Ingresos proy.' : value === 'egresosReales' ? 'Costos reales' : 'Costos proy.*'
                }
              />
              <Bar dataKey="ingresos" fill="#22c55e" name="ingresos" />
              <Bar dataKey="egresosReales" fill="#EF4444" name="egresosReales" />
              <Bar dataKey="egresosProyectados" fill="#F59E0B" name="egresosProyectados" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 12-week projection table */}
      <div>
        <h3 className="text-sm font-semibold text-slate-600 mb-3">Proyección 12 semanas (ARS)</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Semana</TableHead>
              <TableHead className="text-right">Ingresos proy.</TableHead>
              <TableHead className="text-right">Egresos est.</TableHead>
              <TableHead className="text-right">Saldo acum.</TableHead>
              <TableHead className="text-center">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.semanas.map((s) => (
              <TableRow key={s.semana} className={s.semaforo === 'rojo' ? 'bg-red-50' : s.semaforo === 'amarillo' ? 'bg-amber-50' : ''}>
                <TableCell className="text-sm">
                  Sem. {s.semana}
                  <span className="text-xs text-slate-400 ml-1">
                    ({format(new Date(s.inicio), 'd MMM', { locale: es })}–{format(new Date(s.fin), 'd MMM', { locale: es })})
                  </span>
                </TableCell>
                <TableCell className="text-right text-green-700 text-sm">
                  {s.ingresosProyectadosARS > 0 ? `+${fmtARS(s.ingresosProyectadosARS)}` : '—'}
                </TableCell>
                <TableCell className="text-right text-sm font-medium" style={{ color: s.esProyectado ? '#F59E0B' : '#EF4444' }}>
                  −{fmtARS(s.egresosEstimadosARS)}{s.esProyectado ? ' *' : ''}
                </TableCell>
                <TableCell className="text-right font-semibold text-sm">
                  {fmtARS(s.saldoAcumuladoARS)}
                </TableCell>
                <TableCell className="text-center">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: SEMAFORO_COLOR[s.semaforo] }}
                    title={s.semaforo}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {hasProjectedCosts && (
          <p className="text-xs text-slate-400 mt-2">* Costos proyectados basados en estimados o promedio de últimos 3 meses</p>
        )}
      </div>
    </div>
  );
}
