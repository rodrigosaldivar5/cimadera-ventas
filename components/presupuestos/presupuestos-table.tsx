'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Eye, ChevronLeft, ChevronRight, Filter, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ESTADO_PRESUPUESTO, PRIORIDAD, estadoBadgeClass, estadoLabel, type EstadoPresupuesto, type Prioridad } from '@/lib/enums';

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
  obra: { nombre: string } | null;
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
  total: number;
  page: number;
  perPage: number;
  clientes: { id: string; razonSocial: string }[];
  usuarios: { id: string; nombre: string }[];
  criticos: PresupuestoCritico[];
  filters: { estado?: string; clienteId?: string; obraId?: string; desde?: string; hasta?: string };
}

function diasDesde(fecha: Date | null): number {
  if (!fecha) return 0;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000);
}

export function PresupuestosTable({ presupuestos, total, page, perPage, clientes, criticos, filters }: Props) {
  const router = useRouter();
  const totalPages = Math.ceil(total / perPage);
  const [criticosOpen, setCriticosOpen] = useState(true);

  const [estado, setEstado] = useState(filters.estado ?? '');
  const [clienteId, setClienteId] = useState(filters.clienteId ?? '');
  const [obraId, setObraId] = useState(filters.obraId ?? '');
  const [obrasCliente, setObrasCliente] = useState<{ id: string; nombre: string }[]>([]);
  const [desde, setDesde] = useState(filters.desde ?? '');
  const [hasta, setHasta] = useState(filters.hasta ?? '');

  useEffect(() => {
    if (!clienteId) { setObrasCliente([]); setObraId(''); return; }
    fetch(`/api/clientes/${clienteId}/obras`).then((r) => r.json()).then((d) => setObrasCliente(d.obras ?? []));
  }, [clienteId]);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (estado) params.set('estado', estado);
    if (clienteId) params.set('clienteId', clienteId);
    if (obraId) params.set('obraId', obraId);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    router.push(`/presupuestos?${params.toString()}`);
  };

  return (
    <div className="space-y-4">

      {/* Sección Críticos */}
      {criticos.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 overflow-hidden">
          <button
            onClick={() => setCriticosOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left"
          >
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <span className="font-semibold text-red-700 text-sm">
              Presupuestos Críticos — {criticos.length} de alta prioridad
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
        <div className="flex justify-between items-center">
          <h2 className="text-sm text-slate-500">{total} presupuestos encontrados</h2>
          <Button asChild className="bg-sky-500 hover:bg-sky-600">
            <Link href="/presupuestos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Presupuesto
            </Link>
          </Button>
        </div>

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

          {obrasCliente.length > 0 && (
            <Select value={obraId || '__all__'} onValueChange={(v) => setObraId(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Obra" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas las obras</SelectItem>
                {obrasCliente.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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
              <TableHead>Obra</TableHead>
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
                <TableCell className="text-slate-500 text-sm max-w-[120px] truncate">{p.obra?.nombre ?? '—'}</TableCell>
                <TableCell className="text-slate-500 text-sm">
                  {p.responsable?.nombre ?? p.creadoPor.nombre}
                </TableCell>
                <TableCell>
                  <Badge variant={prioridadVariant[p.prioridad]}>{p.prioridad}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={estadoBadgeClass[p.estado]}>{estadoLabel[p.estado]}</Badge>
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
                <TableCell colSpan={10} className="text-center text-slate-400 py-10">
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
    </div>
  );
}
