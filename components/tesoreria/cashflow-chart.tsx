'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

interface SemanaData {
  semana: string;
  alta: number;
  media: number;
  baja: number;
  egresosSemanal: number;
}

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function CashflowChart({ data }: { data: SemanaData[] }) {
  const egreso = data[0]?.egresosSemanal ?? 0;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="semana" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={60} />
        <Tooltip formatter={(v) => fmt(Number(v))} />
        <Legend />
        <ReferenceLine y={egreso} stroke="#DC3545" strokeDasharray="4 4" label={{ value: 'Egresos', fill: '#DC3545', fontSize: 11 }} />
        <Bar dataKey="alta"  name="Alta prob."  fill="#00ADEF" stackId="a" />
        <Bar dataKey="media" name="Media prob." fill="#7DD3FC" stackId="a" />
        <Bar dataKey="baja"  name="Baja prob."  fill="#BAE6FD" stackId="a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
