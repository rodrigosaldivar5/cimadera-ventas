'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#00ADEF', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

type SeriesItem = {
  id: string;
  nombre: string;
  data: { label: string; count: number }[];
};

type ResumenItem = {
  id: string;
  nombre: string;
  asignados: number;
  finalizados: number;
  abiertos: number;
  pctFinalizacion: number;
};

interface Props {
  desde?: string;
  hasta?: string;
}

export function DashboardVendedores({ desde, hasta }: Props) {
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [resumen, setResumen] = useState<ResumenItem[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    fetch(`/api/dashboard/vendedores?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setSeries(d.series ?? []);
        setResumen(d.resumen ?? []);
        setLabels(d.labels ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [desde, hasta]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const chartData = labels.map((label, i) => {
    const point: Record<string, string | number> = { mes: label };
    for (const s of series) {
      point[s.nombre] = s.data[i]?.count ?? 0;
    }
    return point;
  });

  return (
    <div className="space-y-6">
      {series.length > 0 && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-slate-500" />
              Finalizados por cotizador (por mes)
            </CardTitle>
            <p className="text-xs text-slate-400">
              Presupuestos que llegaron a FINALIZADO o estado superior, agrupados por responsable asignado
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {series.map((s, i) => (
                  <Line
                    key={s.id}
                    type="monotone"
                    dataKey={s.nombre}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-slate-500" />
            Resumen por cotizador
          </CardTitle>
          <p className="text-xs text-slate-400">
            Finalizados = presupuestos en estado FINALIZADO, PARA_ENVIAR, ENVIADO, APROBADO o RECHAZADO
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Responsable</TableHead>
                <TableHead className="text-right">Asignados</TableHead>
                <TableHead className="text-right">Finalizados+</TableHead>
                <TableHead className="text-right">Pendientes</TableHead>
                <TableHead className="text-right">% Finalización</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumen.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    {r.nombre}
                  </TableCell>
                  <TableCell className="text-right">{r.asignados}</TableCell>
                  <TableCell className="text-right font-semibold text-green-600">{r.finalizados}</TableCell>
                  <TableCell className="text-right text-slate-500">{r.abiertos}</TableCell>
                  <TableCell className="text-right">
                    <span className={`font-semibold ${r.pctFinalizacion >= 70 ? 'text-green-600' : r.pctFinalizacion >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                      {r.pctFinalizacion}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {resumen.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-400 py-8">Sin datos para el período</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
