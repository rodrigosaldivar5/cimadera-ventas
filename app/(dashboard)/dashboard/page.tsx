export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DashboardChart } from '@/components/dashboard/dashboard-chart';
import { FileText, Send, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { EstadoPresupuesto } from '@prisma/client';

const estadoBadgeVariant: Record<EstadoPresupuesto, 'default' | 'info' | 'success' | 'destructive' | 'warning' | 'secondary' | 'outline' | 'purple'> = {
  BORRADOR: 'secondary',
  ENVIADO: 'info',
  APROBADO: 'success',
  RECHAZADO: 'destructive',
  VENCIDO: 'warning',
};

const estadoLabel: Record<EstadoPresupuesto, string> = {
  BORRADOR: 'Borrador',
  ENVIADO: 'Enviado',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  VENCIDO: 'Vencido',
};

export default async function DashboardPage() {
  const now = new Date();
  const inicioMes = startOfMonth(now);
  const finMes = endOfMonth(now);

  const [totalMes, enviados, aprobados, rechazados, ultimos, chartData] = await Promise.all([
    // Total presupuestos este mes
    prisma.presupuesto.count({ where: { fechaCreacion: { gte: inicioMes, lte: finMes } } }),
    // Enviados pendientes
    prisma.presupuesto.count({ where: { estado: 'ENVIADO' } }),
    // Aprobados este mes con monto
    prisma.presupuesto.aggregate({
      where: { estado: 'APROBADO', fechaCreacion: { gte: inicioMes, lte: finMes } },
      _count: true,
      _sum: { totalFinal: true },
    }),
    // Rechazados este mes
    prisma.presupuesto.count({ where: { estado: 'RECHAZADO', fechaCreacion: { gte: inicioMes, lte: finMes } } }),
    // Últimos 10
    prisma.presupuesto.findMany({
      take: 10,
      orderBy: { fechaCreacion: 'desc' },
      include: { cliente: true },
    }),
    // Datos para gráfico (últimos 6 meses)
    Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const mes = subMonths(now, 5 - i);
        const inicio = startOfMonth(mes);
        const fin = endOfMonth(mes);
        return prisma.presupuesto.groupBy({
          by: ['estado'],
          where: { fechaCreacion: { gte: inicio, lte: fin } },
          _count: true,
        }).then((data) => ({
          mes: format(mes, 'MMM', { locale: es }),
          BORRADOR: data.find((d) => d.estado === 'BORRADOR')?._count ?? 0,
          ENVIADO: data.find((d) => d.estado === 'ENVIADO')?._count ?? 0,
          APROBADO: data.find((d) => d.estado === 'APROBADO')?._count ?? 0,
          RECHAZADO: data.find((d) => d.estado === 'RECHAZADO')?._count ?? 0,
        }));
      })
    ),
  ]);

  const kpis = [
    {
      title: 'Presupuestos este mes',
      value: totalMes,
      icon: FileText,
      color: 'text-sky-500',
      bg: 'bg-sky-50',
      href: '/presupuestos',
    },
    {
      title: 'Enviados (pendientes)',
      value: enviados,
      icon: Send,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
      href: '/presupuestos?estado=ENVIADO',
    },
    {
      title: 'Aprobados este mes',
      value: `${aprobados._count} · ${formatCurrency(Number(aprobados._sum.totalFinal ?? 0))}`,
      icon: CheckCircle,
      color: 'text-green-500',
      bg: 'bg-green-50',
      href: '/presupuestos?estado=APROBADO',
    },
    {
      title: 'Rechazados este mes',
      value: rechazados,
      icon: XCircle,
      color: 'text-red-500',
      bg: 'bg-red-50',
      href: '/presupuestos?estado=RECHAZADO',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link key={kpi.title} href={kpi.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">{kpi.title}</p>
                      <p className="text-2xl font-bold text-slate-800 mt-1">{kpi.value}</p>
                    </div>
                    <div className={`rounded-full p-3 ${kpi.bg}`}>
                      <Icon className={`h-6 w-6 ${kpi.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Gráfico y Tabla */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-sky-500" />
              Presupuestos por mes (últimos 6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardChart data={chartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos presupuestos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nro</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ultimos.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link href={`/presupuestos/${p.id}`} className="text-sky-600 hover:underline">
                        #{p.numero}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate">{p.cliente.razonSocial}</TableCell>
                    <TableCell>
                      <Badge variant={estadoBadgeVariant[p.estado]}>
                        {estadoLabel[p.estado]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(p.totalFinal))}
                    </TableCell>
                  </TableRow>
                ))}
                {ultimos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-400 py-8">
                      No hay presupuestos aún
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
