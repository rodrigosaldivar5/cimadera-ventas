'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Plus, Eye, ChevronLeft, ChevronRight, Filter, AlertTriangle, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { EliminarPresupuestoBtn } from '@/components/presupuestos/eliminar-presupuesto-btn';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ESTADO_PRESUPUESTO, PRIORIDAD, estadoBadgeClass, estadoLabel, type EstadoPresupuesto, type Prioridad } from '@/lib/enums';

const prioridadVariant: Record<Prioridad, 'destructive' | 'warning' | 'success'> = {
  ALTA: 'destructive',
  MEDIA: 'warning',
  BAJA: 'success',
};

const prioridadBadgeClass: Record<string, string> = {
  ALTA:  'bg-red-100 text-red-700 border-red-300',
  MEDIA: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  BAJA:  'bg-green-100 text-green-700 border-green-300',
};
const prioridadLabel: Record<string, string> = {
  ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja',
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
  tasaIva: unknown;
  totalConIva: unknown;
  precioFinal: unknown;
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

const EMAILS_AUTORIZADOS_BORRAR = ['coordinacion.general@cimadera.net', 'admin@cimadera.net'];
const COLUMN_WIDTHS_KEY = 'presupuestos_column_widths';

function ResizableHead({
  colKey, defaultWidth, width, onResize, children, className = '',
}: {
  colKey: string; defaultWidth: number; width?: number;
  onResize: (key: string, w: number) => void;
  children: React.ReactNode; className?: string;
}) {
  const headRef = useRef<HTMLTableCellElement>(null);
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = headRef.current?.offsetWidth ?? defaultWidth;
    const onMouseMove = (ev: MouseEvent) => {
      onResize(colKey, Math.max(50, startWidth + (ev.clientX - startX)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
  return (
    <TableHead ref={headRef} style={{ width: width ?? defaultWidth, position: 'relative' }} className={className}>
      {children}
      <div onMouseDown={onMouseDown} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize', userSelect: 'none' }} />
    </TableHead>
  );
}

interface Props {
  presupuestos: PresupuestoRow[];
  total: number;
  page: number;
  perPage: number;
  clientes: { id: string; razonSocial: string }[];
  usuarios: { id: string; nombre: string }[];
  criticos: PresupuestoCritico[];
  userEmail: string;
  filters: { estados?: string; prioridades?: string; clienteId?: string; obraId?: string; desde?: string; hasta?: string };
}

function diasDesde(fecha: Date | null): number {
  if (!fecha) return 0;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000);
}

export function PresupuestosTable({ presupuestos, total, page, perPage, clientes, criticos, userEmail, filters }: Props) {
  const puedeEliminar = EMAILS_AUTORIZADOS_BORRAR.includes(userEmail);
  const router = useRouter();
  const totalPages = Math.ceil(total / perPage);
  const [criticosOpen, setCriticosOpen] = useState(true);
  const [editingPrecio, setEditingPrecio] = useState<{ id: string; value: string } | null>(null);
  const [savingPrecio, setSavingPrecio] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    try { const s = localStorage.getItem(COLUMN_WIDTHS_KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const handleResize = (colKey: string, width: number) => {
    setColumnWidths((prev) => {
      const next = { ...prev, [colKey]: width };
      try { localStorage.setItem(COLUMN_WIDTHS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const FILTROS_KEY = 'presupuestos_filtros';

  const [estados, setEstados] = useState<string[]>(filters.estados?.split(',').filter(Boolean) ?? []);
  const [prioridades, setPrioridades] = useState<string[]>(filters.prioridades?.split(',').filter(Boolean) ?? []);
  const [estadosOpen, setEstadosOpen] = useState(false);
  const [prioridadesOpen, setPrioridadesOpen] = useState(false);
  const [clienteId, setClienteId] = useState(filters.clienteId ?? '');
  const [obraId, setObraId] = useState(filters.obraId ?? '');
  const [obrasCliente, setObrasCliente] = useState<{ id: string; nombre: string }[]>([]);
  const [desde, setDesde] = useState(filters.desde ?? '');
  const [hasta, setHasta] = useState(filters.hasta ?? '');

  // Cargar desde localStorage si no hay params en URL
  useEffect(() => {
    const hayUrlFiltros = filters.estados || filters.prioridades || filters.clienteId || filters.desde || filters.hasta;
    if (!hayUrlFiltros) {
      try {
        const saved = localStorage.getItem(FILTROS_KEY);
        if (saved) {
          const f = JSON.parse(saved);
          if (f.estados?.length)   setEstados(f.estados);
          if (f.prioridades?.length) setPrioridades(f.prioridades);
          if (f.clienteId)          setClienteId(f.clienteId);
          if (f.desde)              setDesde(f.desde);
          if (f.hasta)              setHasta(f.hasta);
        }
      } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guardar en localStorage al cambiar cualquier filtro
  useEffect(() => {
    try {
      localStorage.setItem(FILTROS_KEY, JSON.stringify({ estados, prioridades, clienteId, desde, hasta }));
    } catch {}
  }, [estados, prioridades, clienteId, desde, hasta]);

  useEffect(() => {
    if (!clienteId) { setObrasCliente([]); setObraId(''); return; }
    fetch(`/api/clientes/${clienteId}/obras`).then((r) => r.json()).then((d) => setObrasCliente(d.obras ?? []));
  }, [clienteId]);

  const savePrecioFinal = async () => {
    if (!editingPrecio) return;
    setSavingPrecio(true);
    const valor = editingPrecio.value.trim() === '' ? null : Number(editingPrecio.value);
    await fetch(`/api/presupuestos/${editingPrecio.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ precioFinal: valor }),
    });
    setSavingPrecio(false);
    setEditingPrecio(null);
    router.refresh();
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (estados.length > 0) params.set('estados', estados.join(','));
    if (prioridades.length > 0) params.set('prioridades', prioridades.join(','));
    if (clienteId) params.set('clienteId', clienteId);
    if (obraId) params.set('obraId', obraId);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    router.push(`/presupuestos?${params.toString()}`);
  };

  const limpiarFiltros = () => {
    try { localStorage.removeItem(FILTROS_KEY); } catch {}
    setEstados([]);
    setPrioridades([]);
    setClienteId('');
    setObraId('');
    setDesde('');
    setHasta('');
    router.push('/presupuestos');
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
          <Button asChild className="bg-[#00ADEF] hover:bg-[#0089C7]">
            <Link href="/presupuestos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Presupuesto
            </Link>
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 p-4 bg-white rounded-lg border">
          {/* Filtro multi-select: Estado */}
          <DropdownMenu open={estadosOpen} onOpenChange={setEstadosOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-44 justify-between font-normal">
                <span className="truncate">
                  {estados.length === 0
                    ? 'Todos los estados'
                    : estados.length === 1
                      ? estadoLabel[estados[0]]
                      : `${estados.length} estados`}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-52">
              {Object.values(ESTADO_PRESUPUESTO).map((e) => (
                <DropdownMenuCheckboxItem
                  key={e}
                  checked={estados.includes(e)}
                  onCheckedChange={(checked) =>
                    setEstados((prev) => checked ? [...prev, e] : prev.filter((x) => x !== e))
                  }
                  onSelect={(ev) => ev.preventDefault()}
                >
                  <Badge variant="outline" className={`${estadoBadgeClass[e]} ml-1`}>
                    {estadoLabel[e]}
                  </Badge>
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <div className="flex gap-2 p-2">
                <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" onClick={() => setEstados([])}>
                  Limpiar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-7 text-xs bg-[#00ADEF] hover:bg-[#0089C7]"
                  onClick={() => { setEstadosOpen(false); applyFilters(); }}
                >
                  Aplicar
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filtro multi-select: Prioridad */}
          <DropdownMenu open={prioridadesOpen} onOpenChange={setPrioridadesOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-44 justify-between font-normal">
                <span className="truncate">
                  {prioridades.length === 0
                    ? 'Todas las prioridades'
                    : prioridades.length === 1
                      ? prioridadLabel[prioridades[0]]
                      : `${prioridades.length} prioridades`}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              {Object.values(PRIORIDAD).map((p) => (
                <DropdownMenuCheckboxItem
                  key={p}
                  checked={prioridades.includes(p)}
                  onCheckedChange={(checked) =>
                    setPrioridades((prev) => checked ? [...prev, p] : prev.filter((x) => x !== p))
                  }
                  onSelect={(ev) => ev.preventDefault()}
                >
                  <Badge variant="outline" className={`${prioridadBadgeClass[p]} ml-1`}>
                    {prioridadLabel[p]}
                  </Badge>
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <div className="flex gap-2 p-2">
                <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" onClick={() => setPrioridades([])}>
                  Limpiar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-7 text-xs bg-[#00ADEF] hover:bg-[#0089C7]"
                  onClick={() => { setPrioridadesOpen(false); applyFilters(); }}
                >
                  Aplicar
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

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
          {(estados.length > 0 || prioridades.length > 0 || clienteId || desde || hasta) && (
            <Button onClick={limpiarFiltros} variant="ghost" className="text-slate-400 hover:text-slate-600">
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border bg-white shadow-sm overflow-hidden [&_td]:py-3.5">
        <Table>
          <TableHeader>
            <TableRow>
              <ResizableHead colKey="nro" defaultWidth={72} width={columnWidths.nro} onResize={handleResize}>Nro</ResizableHead>
              <ResizableHead colKey="nombre" defaultWidth={140} width={columnWidths.nombre} onResize={handleResize}>Nombre</ResizableHead>
              <ResizableHead colKey="cliente" defaultWidth={150} width={columnWidths.cliente} onResize={handleResize}>Cliente</ResizableHead>
              <ResizableHead colKey="obra" defaultWidth={120} width={columnWidths.obra} onResize={handleResize}>Obra</ResizableHead>
              <ResizableHead colKey="responsable" defaultWidth={120} width={columnWidths.responsable} onResize={handleResize}>Responsable</ResizableHead>
              <ResizableHead colKey="prioridad" defaultWidth={90} width={columnWidths.prioridad} onResize={handleResize}>Prioridad</ResizableHead>
              <ResizableHead colKey="estado" defaultWidth={120} width={columnWidths.estado} onResize={handleResize}>Estado</ResizableHead>
              <ResizableHead colKey="recepcion" defaultWidth={100} width={columnWidths.recepcion} onResize={handleResize}>Recepción</ResizableHead>
              <ResizableHead colKey="total" defaultWidth={110} width={columnWidths.total} onResize={handleResize} className="text-right">Total</ResizableHead>
              <ResizableHead colKey="pfinal" defaultWidth={110} width={columnWidths.pfinal} onResize={handleResize} className="text-right">P. Final</ResizableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {presupuestos.map((p) => (
              <TableRow key={p.id} className="border-b border-slate-200 hover:bg-slate-50/50">
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
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-medium">
                      {formatCurrency(
                        Number(p.totalConIva) > 0 ? Number(p.totalConIva) :
                        Number(p.precioFinal) > 0 ? Number(p.precioFinal) :
                        Number(p.totalFinal)
                      )}
                    </span>
                    <Badge variant="outline" className="text-xs px-1 py-0 font-normal">
                      {Number(p.tasaIva) === 0 ? 'Exento' : `${Number(p.tasaIva)}%`}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {editingPrecio?.id === p.id ? (
                    <div className="flex items-center gap-1 justify-end">
                      <Input
                        type="number"
                        value={editingPrecio.value}
                        onChange={(e) => setEditingPrecio({ id: p.id, value: e.target.value })}
                        className="w-28 h-7 text-xs"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') savePrecioFinal();
                          if (e.key === 'Escape') setEditingPrecio(null);
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={savePrecioFinal} disabled={savingPrecio}>
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      className="text-right w-full text-sm font-medium hover:text-[#00ADEF] transition-colors"
                      onClick={() => setEditingPrecio({ id: p.id, value: p.precioFinal != null ? String(Number(p.precioFinal)) : '' })}
                    >
                      {p.precioFinal != null ? formatCurrency(Number(p.precioFinal)) : <span className="text-slate-300 text-xs">—</span>}
                    </button>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/presupuestos/${p.id}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                    {puedeEliminar && (
                      <EliminarPresupuestoBtn
                        presupuestoId={p.id}
                        numero={p.numero}
                        clienteNombre={p.cliente.razonSocial}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {presupuestos.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-slate-400 py-10">
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
