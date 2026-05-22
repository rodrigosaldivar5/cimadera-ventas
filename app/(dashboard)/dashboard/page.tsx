export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DashboardChart } from '@/components/dashboard/dashboard-chart';
import { FileText, Send, CheckCircle, XCircle, TrendingUp, Clock } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { EstadoPresupuesto } from '@prisma/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const estadoBadgeVariant: Record<EstadoPresupuesto, 'default' | 'info' | 'success' | 'destructive' | 'warning' | 'secondary' | 'outline' | 'purple'> = {
  PENDIENTE: 'warning',
  BORRADOR: 'secondary',
  ENVIADO: 'info',
  APROBADO: 'success',
  RECHAZADO: 'destructive',
  VENCIDO: 'outline',
};

const estadoLabel: Record<EstadoPresupuesto, string> = {
  PENDIENTE: 'Pendiente',
  BORRADOR: 'Borrador',
  ENVIADO: 'Enviado',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  VENCIDO: 'Vencido',
};

export default async function DashboardPage({ searchParams }: { searchParams: { userId?: string } }) {
  const userId = searchParams.userId;
  const now = new Date();
  const inicioMes = startOfMonth(now);
  const finMes = endOfMonth(now);

  const vendedores = await prisma.user.findMany({
    where: { aprobado: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });

  const whereBase = userId ? { creadoPorId: userId } : {};

  const [totalMes, enviados, aprobados, rechazados, pendientes, ultimos, chartData] = await Promise.all([
    // Total presupuestos este mes
    prisma.presupuesto.count({ where: { ...whereBase, fechaCreacion: { gte: inicioMes, lte: finMes } } }),
    // Enviados pendientes
    prisma.presupuesto.count({ where: { ...whereBase, estado: 'ENVIADO' } }),
    // Aprobados este mes con monto
    prisma.presupuesto.aggregate({
      where: { ...whereBase, estado: 'APROBADO', fechaCreacion: { gte: inicioMes, lte: finMes } },
      _count: true,
      _sum: { totalFinal: true },
    }),
    // Rechazados este mes
    prisma.presupuesto.count({ where: { ...whereBase, estado: 'RECHAZADO', fechaCreacion: { gte: inicioMes, lte: finMes } } }),
    // Pendientes de realizar
    prisma.presupuesto.count({ where: { ...whereBase, estado: 'PENDIENTE' } }),
    // Últimos 10
    prisma.presupuesto.findMany({
      where: whereBase,
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
          where: { ...whereBase, fechaCreacion: { gte: inicio, lte: fin } },
          _count: true,
        }).then((data) => ({
          mes: format(mes, 'MMM', { locale: es }),
          PENDIENTE: data.find((d) => d.estado === 'PENDIENTE')?._count ?? 0,
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
      title: 'Pendientes de realizar',
      value: pendientes,
      icon: Clock,
      color: 'text-amber-500',
      bg: 'bg-amber-50',
      href: '/presupuestos?tab=pendientes',
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

  const selectedVendedor = vendedores.find((v) => v.id === userId);

  const kpiGrid = (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Link key={kpi.title} href={kpi.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">{kpi.title}</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{kpi.value}</p>
                  </div>
                  <div className={`rounded-full p-2.5 ${kpi.bg}`}>
                    <Icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );

  const chartsGrid = (
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
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue={userId ? 'vendedor' : 'general'}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="general" asChild>
              <Link href="/dashboard">General</Link>
            </TabsTrigger>
            <TabsTrigger value="vendedor">Por vendedor</TabsTrigger>
          </TabsList>

          {/* Selector de vendedor visible solo en tab vendedor */}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            {selectedVendedor && (
              <span className="font-medium text-slate-700">{selectedVendedor.nombre}</span>
            )}
          </div>
        </div>

        <TabsContent value="general" className="space-y-6 mt-4">
          {kpiGrid}
          {chartsGrid}
        </TabsContent>

        <TabsContent value="vendedor" className="space-y-6 mt-4">
          <div className="flex flex-wrap gap-2">
            {vendedores.map((v) => (
              <Link
                key={v.id}
                href={`/dashboard?userId=${v.id}`}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  userId === v.id
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-slate-300 text-slate-600 hover:border-sky-400 hover:text-sky-600'
                }`}
              >
                {v.nombre}
              </Link>
            ))}
          </div>
          {userId ? (
            <>
              {kpiGrid}
              {chartsGrid}
            </>
          ) : (
            <p className="text-sm text-slate-400 text-center py-10 border rounded-lg bg-white">
              Seleccioná un vendedor para ver sus estadísticas.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
