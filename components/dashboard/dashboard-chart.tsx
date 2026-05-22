'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface ChartData {
  mes: string;
  PENDIENTE: number;
  BORRADOR: number;
  ENVIADO: number;
  APROBADO: number;
  RECHAZADO: number;
}

export function DashboardChart({ data }: { data: ChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="PENDIENTE" name="Pendiente" fill="#F59E0B" radius={[2, 2, 0, 0]} />
        <Bar dataKey="ENVIADO" name="Enviado" fill="#38BDF8" radius={[2, 2, 0, 0]} />
        <Bar dataKey="APROBADO" name="Aprobado" fill="#22C55E" radius={[2, 2, 0, 0]} />
        <Bar dataKey="RECHAZADO" name="Rechazado" fill="#EF4444" radius={[2, 2, 0, 0]} />
        <Bar dataKey="BORRADOR" name="Borrador" fill="#94A3B8" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
