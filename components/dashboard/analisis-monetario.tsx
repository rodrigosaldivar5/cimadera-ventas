'use client';

import { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';

type Row = {
  label: string;
  ventasARS: number;
  tcPromedio: number | null;
  equivUSD: number | null;
  cobrosUSD: number;
  totalUSD: number;
};

function fmtARS(n: number) {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtUSD(n: number) {
  return `U$D ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtTC(n: number) {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AnalisisMonetario({ desde, hasta }: { desde?: string; hasta?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    fetch(`/api/dashboard/analisis-monetario?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
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

  const totales = rows.reduce(
    (acc, r) => ({
      ventasARS: acc.ventasARS + r.ventasARS,
      equivUSD: (acc.equivUSD ?? 0) + (r.equivUSD ?? 0),
      cobrosUSD: acc.cobrosUSD + r.cobrosUSD,
      totalUSD: acc.totalUSD + r.totalUSD,
    }),
    { ventasARS: 0, equivUSD: 0, cobrosUSD: 0, totalUSD: 0 },
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mes</TableHead>
          <TableHead className="text-right">Ventas ARS</TableHead>
          <TableHead className="text-right">TC Promedio</TableHead>
          <TableHead className="text-right">Equiv. USD</TableHead>
          <TableHead className="text-right">Cobros USD directos</TableHead>
          <TableHead className="text-right">Total USD</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.label}>
            <TableCell className="font-medium capitalize">{r.label}</TableCell>
            <TableCell className="text-right">{fmtARS(r.ventasARS)}</TableCell>
            <TableCell className="text-right text-slate-500">{r.tcPromedio ? fmtTC(r.tcPromedio) : '—'}</TableCell>
            <TableCell className="text-right">{r.equivUSD != null ? fmtUSD(r.equivUSD) : '—'}</TableCell>
            <TableCell className="text-right">{fmtUSD(r.cobrosUSD)}</TableCell>
            <TableCell className="text-right font-semibold text-[#00ADEF]">{fmtUSD(r.totalUSD)}</TableCell>
          </TableRow>
        ))}
        {rows.length > 0 && (
          <TableRow className="bg-slate-50 font-semibold">
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{fmtARS(totales.ventasARS)}</TableCell>
            <TableCell className="text-right text-slate-500">—</TableCell>
            <TableCell className="text-right">{fmtUSD(totales.equivUSD ?? 0)}</TableCell>
            <TableCell className="text-right">{fmtUSD(totales.cobrosUSD)}</TableCell>
            <TableCell className="text-right text-[#00ADEF]">{fmtUSD(totales.totalUSD)}</TableCell>
          </TableRow>
        )}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-slate-400 py-8">Sin datos para el período</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
