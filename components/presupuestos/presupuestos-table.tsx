'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Eye, ChevronLeft, ChevronRight, Filter, AlertTriangle, ChevronDown, ChevronUp, Play } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ESTADO_PRESUPUESTO, PRIORIDAD, type EstadoPresupuesto, type Prioridad } from '@/lib/enums';

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

const prioridadVariant: Record<Prioridad, 'destructive' | 'warning' | 'success'> = {
  ALTA: 'destructive',
  MEDIA: 'warning',
  BAJA: 'success',
};

type PresupuestoRow = {
  id: string;
  numero: number;
  nombrePresupuesto: string | null;
  estado: EstadoPresupuesto;
  prioridad: Prioridad;
  fechaCreacion: Date;
  fechaRecepcion: Date | null;
  fechaVencimiento: Date | null;
  totalFinal: unknown;
  cliente: { razonSocial: string };
  creadoPor: { nombre: string };
  responsable: { nombre: string } | null;
};

type PresupuestoCritico = {
  id: string;
  numero: number;
  nombrePresupuesto: string | null;
  fechaRecepcion: Date | null;
  cliente: { razonSocial: string };
  responsable: { nombre: string } | null;
};

interface Props {
  presupuestos: PresupuestoRow[];
  pendientes: PresupuestoRow[];
  total: number;
  page: number;
  perPage: number;
  clientes: { id: string; razonSocial: string }[];
  usuarios: { id: string; nombre: string }[];
  criticos: PresupuestoCritico[];
  filters: { estado?: string; clienteId?: string; desde?: string; hasta?: string; tab?: string };
}

function diasDesde(fecha: Date | null): number {
  if (!fecha) return 0;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000);
}

export function PresupuestosTable({ presupuestos, pendientes, total, page, perPage, clientes, criticos, filters }: Props) {
  const router = useRouter();
  const totalPages = Math.ceil(total / perPage);
  const [criticosOpen, setCriticosOpen] = useState(true);
  const [comenzandoId, setComenzandoId] = useState<string | null>(null);

  const comenzarPresupuesto = async (id: string) => {
    setComenzandoId(id);
    await fetch(`/api/presupuestos/${id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'BORRADOR' }),
    });
    setComenzandoId(null);
    router.push(`/presupuestos/${id}`);
  };

  const [estado, setEstado] = useState(filters.estado ?? '');
  const [clienteId, setClienteId] = useState(filters.clienteId ?? '');
  const [desde, setDesde] = useState(filters.desde ?? '');
  const [hasta, setHasta] = useState(filters.hasta ?? '');

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (estado) params.set('estado', estado);
    if (clienteId) params.set('clienteId', clienteId);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    router.push(`/presupuestos?${params.toString()}`);
  };

  const activeTab = filters.tab === 'pendientes' ? 'pendientes' : 'activos';

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => router.push(v === 'pendientes' ? '/presupuestos?tab=pendientes' : '/presupuestos')}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="activos">En elaboración / Finalizados</TabsTrigger>
            <TabsTrigger value="pendientes">
              Pendientes de realizar
              {pendientes.length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 leading-none">
                  {pendientes.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <Button asChild className="bg-sky-500 hover:bg-sky-600">
            <Link href="/presupuestos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Presupuesto
            </Link>
          </Button>
        </div>

        <TabsContent value="pendientes" className="space-y-3 mt-4">
          {pendientes.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-12 border rounded-lg bg-white">
              No hay presupuestos pendientes de realizar.
            </p>
          ) : (
            <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nro</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="w-32"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendientes.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">#{p.numero}</TableCell>
                      <TableCell className="max-w-[140px] truncate text-slate-600">{p.nombrePresupuesto ?? '—'}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{p.cliente.razonSocial}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{p.responsable?.nombre ?? p.creadoPor.nombre}</TableCell>
                      <TableCell>
                        <Badge variant={prioridadVariant[p.prioridad]}>{p.prioridad}</Badge>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">{formatDate(p.fechaCreacion)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          className="bg-sky-500 hover:bg-sky-600"
                          disabled={comenzandoId === p.id}
                          onClick={() => comenzarPresupuesto(p.id)}
                        >
                          {comenzandoId === p.id
                            ? <span className="animate-spin mr-1">⏳</span>
                            : <Play className="mr-1 h-3.5 w-3.5" />}
                          Comenzar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activos" className="space-y-4 mt-4">

      {/* Sección Críticos */}
      {criticos.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 overflow-hidden">
          <button
            onClick={() => setCriticosOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left"
          >
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <span className="font-semibold text-red-700 text-sm">
              Presupuestos Críticos — {criticos.length} pendiente{criticos.length > 1 ? 's' : ''} de alta prioridad
            </span>
            {criticosOpen ? <ChevronUp className="ml-auto h-4 w-4 text-red-400" /> : <ChevronDown className="ml-auto h-4 w-4 text-red-400" />}
          </button>
          {criticosOpen && (
            <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {criticos.map((p) => {
                const dias = diasDesde(p.fechaRecepcion);
                const urgente = dias > 3;
                return (
                  <Link
                    key={p.id}
                    href={`/presupuestos/${p.id}`}
                    className={`rounded-lg border p-3 text-sm hover:shadow-md transition-shadow ${urgente ? 'border-red-400 bg-white' : 'border-red-200 bg-white'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-800">#{p.numero}</span>
                      {urgente && <span className="text-xs text-red-600 font-medium">{dias}d sin cambio</span>}
                    </div>
                    <p className="text-slate-600 truncate">{p.nombrePresupuesto ?? p.cliente.razonSocial}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{p.cliente.razonSocial}</p>
                    {p.responsable && (
                      <p className="text-slate-500 text-xs mt-1">Resp: {p.responsable.nombre}</p>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm text-slate-500">{total} presupuestos encontrados</h2>
        {/* Filtros */}
        <div className="flex flex-wrap gap-3 p-4 bg-white rounded-lg border">
          <Select value={estado || '__all__'} onValueChange={(v) => setEstado(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {Object.values(ESTADO_PRESUPUESTO).map((e) => (
                <SelectItem key={e} value={e}>{estadoLabel[e]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={clienteId || '__all__'} onValueChange={(v) => setClienteId(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los clientes</SelectItem>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.razonSocial}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-36" />
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-36" />

          <Button onClick={applyFilters} variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filtrar
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nro</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Recepción</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {presupuestos.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">#{p.numero}</TableCell>
                <TableCell className="max-w-[140px] truncate text-slate-600">
                  {p.nombrePresupuesto ?? '—'}
                </TableCell>
                <TableCell className="max-w-[150px] truncate">{p.cliente.razonSocial}</TableCell>
                <TableCell className="text-slate-500 text-sm">
                  {p.responsable?.nombre ?? p.creadoPor.nombre}
                </TableCell>
                <TableCell>
                  <Badge variant={prioridadVariant[p.prioridad]}>{p.prioridad}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={estadoBadgeVariant[p.estado]}>{estadoLabel[p.estado]}</Badge>
                </TableCell>
                <TableCell className="text-slate-500 text-sm">
                  {p.fechaRecepcion ? formatDate(p.fechaRecepcion) : '—'}
                </TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(Number(p.totalFinal))}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/presupuestos/${p.id}`}><Eye className="h-4 w-4" /></Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {presupuestos.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-slate-400 py-10">
                  No hay presupuestos con los filtros aplicados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{total} en total</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => router.push(`/presupuestos?page=${page - 1}`)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Página {page} de {totalPages}</span>
            <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => router.push(`/presupuestos?page=${page + 1}`)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
