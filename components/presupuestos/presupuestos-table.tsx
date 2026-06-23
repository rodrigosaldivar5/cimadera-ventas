'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Plus, Eye, ChevronLeft, ChevronRight, AlertTriangle, ChevronDown, ChevronUp, Check, MessageCircle } from 'lucide-react';
import { EliminarPresupuestoBtn } from '@/components/presupuestos/eliminar-presupuesto-btn';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';
import { ESTADO_PRESUPUESTO, PRIORIDAD, getEstiloEstado, getLabelEstado, type EstadoPresupuesto, type Prioridad } from '@/lib/enums';

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
  moneda?: string;
  clienteId?: string;
  obraId?: string;
  cliente: { id?: string; razonSocial: string };
  creadoPor: { nombre: string };
  responsable: { nombre: string } | null;
  obra: { id?: string; nombre: string } | null;
  archivos: { id: string }[];
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
const ITEMS_POR_PAGINA = 20;

function ResizableHead({
  colKey, defaultWidth, width, onResize, children, className = '',
}: {
  colKey: string; defaultWidth: number; width?: number;
  onResize: (key: string, w: number) => void;
  children: React.ReactNode; className?: string;
}) {
  const headRef = useRef<HTMLTableCellElement>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startWidth: headRef.current?.offsetWidth ?? defaultWidth,
    };
    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      onResize(colKey, Math.max(50, dragRef.current.startWidth + (ev.clientX - dragRef.current.startX)));
    };
    const onMouseUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <TableHead ref={headRef} style={{ width: width ?? defaultWidth, position: 'relative', userSelect: 'none' }} className={className}>
      {children}
      <div
        onMouseDown={onMouseDown}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 5,
          cursor: 'col-resize',
          background: isHovering ? 'rgba(0,173,239,0.35)' : 'transparent',
          transition: 'background 0.15s',
        }}
      />
    </TableHead>
  );
}

interface Props {
  clientes: { id: string; razonSocial: string }[];
  usuarios: { id: string; nombre: string }[];
  criticos: PresupuestoCritico[];
  userEmail: string;
}

function diasDesde(fecha: Date | null): number {
  if (!fecha) return 0;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000);
}

export function PresupuestosTable({ clientes, criticos, userEmail }: Props) {
  const puedeEliminar = EMAILS_AUTORIZADOS_BORRAR.includes(userEmail);

  // ── Datos ─────────────────────────────────────────────────────────
  const [todosLosPresupuestos, setTodosLosPresupuestos] = useState<PresupuestoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPresupuestos = () => {
    setLoading(true);
    fetch('/api/presupuestos?limit=1000')
      .then(r => r.json())
      .then(data => { setTodosLosPresupuestos(data.presupuestos ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchPresupuestos(); }, []);

  // ── Filtros (con localStorage) ────────────────────────────────────
  const [filtroEstados, setFiltroEstados] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const s = localStorage.getItem('pres_f_estados'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [filtroPrioridades, setFiltroPrioridades] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const s = localStorage.getItem('pres_f_prioridades'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [filtroClienteId, setFiltroClienteId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try { return localStorage.getItem('pres_f_clienteId') ?? ''; } catch { return ''; }
  });
  const [filtroDesde, setFiltroDesde] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try { return localStorage.getItem('pres_f_desde') ?? ''; } catch { return ''; }
  });
  const [filtroHasta, setFiltroHasta] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try { return localStorage.getItem('pres_f_hasta') ?? ''; } catch { return ''; }
  });

  useEffect(() => { try { localStorage.setItem('pres_f_estados', JSON.stringify(filtroEstados)); } catch {} }, [filtroEstados]);
  useEffect(() => { try { localStorage.setItem('pres_f_prioridades', JSON.stringify(filtroPrioridades)); } catch {} }, [filtroPrioridades]);
  useEffect(() => { try { localStorage.setItem('pres_f_clienteId', filtroClienteId); } catch {} }, [filtroClienteId]);
  useEffect(() => { try { localStorage.setItem('pres_f_desde', filtroDesde); } catch {} }, [filtroDesde]);
  useEffect(() => { try { localStorage.setItem('pres_f_hasta', filtroHasta); } catch {} }, [filtroHasta]);

  // ── Paginación ────────────────────────────────────────────────────
  const [paginaActual, setPaginaActual] = useState(1);
  useEffect(() => { setPaginaActual(1); }, [filtroEstados, filtroPrioridades, filtroClienteId, filtroDesde, filtroHasta]);

  // ── Obras del cliente ─────────────────────────────────────────────
  const [filtroObraId, setFiltroObraId] = useState('');
  const [obrasCliente, setObrasCliente] = useState<{ id: string; nombre: string }[]>([]);
  useEffect(() => {
    if (!filtroClienteId) { setObrasCliente([]); setFiltroObraId(''); return; }
    fetch(`/api/clientes/${filtroClienteId}/obras`).then(r => r.json()).then(d => setObrasCliente(d.obras ?? []));
  }, [filtroClienteId]);

  // ── Filtrado cliente-side ─────────────────────────────────────────
  const presupuestosFiltrados = useMemo(() => {
    let r = [...todosLosPresupuestos];
    if (filtroEstados.length > 0)     r = r.filter(p => filtroEstados.includes(p.estado));
    if (filtroPrioridades.length > 0) r = r.filter(p => filtroPrioridades.includes(p.prioridad));
    if (filtroClienteId) r = r.filter(p => p.cliente?.id === filtroClienteId || p.clienteId === filtroClienteId);
    if (filtroObraId)    r = r.filter(p => p.obra?.id === filtroObraId || p.obraId === filtroObraId);
    if (filtroDesde) { const d = new Date(filtroDesde); r = r.filter(p => new Date(p.fechaCreacion) >= d); }
    if (filtroHasta) { const h = new Date(filtroHasta); h.setHours(23, 59, 59); r = r.filter(p => new Date(p.fechaCreacion) <= h); }
    return r;
  }, [todosLosPresupuestos, filtroEstados, filtroPrioridades, filtroClienteId, filtroObraId, filtroDesde, filtroHasta]);

  const totalPaginas = Math.ceil(presupuestosFiltrados.length / ITEMS_POR_PAGINA);
  const presupuestosPagina = presupuestosFiltrados.slice(
    (paginaActual - 1) * ITEMS_POR_PAGINA,
    paginaActual * ITEMS_POR_PAGINA,
  );

  // ── UI state ─────────────────────────────────────────────────────
  const [criticosOpen, setCriticosOpen] = useState(true);
  const [editingPrecio, setEditingPrecio] = useState<{ id: string; value: string } | null>(null);
  const [savingPrecio, setSavingPrecio] = useState(false);
  const [savingPrioridad, setSavingPrioridad] = useState<string | null>(null);
  const [estadosOpen, setEstadosOpen] = useState(false);
  const [prioridadesOpen, setPrioridadesOpen] = useState(false);
  const [dialogAvanceAbierto, setDialogAvanceAbierto] = useState(false);
  const [presupuestoAvance, setPresupuestoAvance] = useState<PresupuestoRow | null>(null);
  const [mensajeAvance, setMensajeAvance] = useState('');
  const [enviandoAvance, setEnviandoAvance] = useState(false);
  const [toastAvance, setToastAvance] = useState<{ msg: string; error: boolean } | null>(null);
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

  const ALL_COLUMNS = ['numero', 'nombre', 'cliente', 'obra', 'responsable', 'prioridad', 'estado', 'recepcion', 'limite'];
  const [columnasVisibles, setColumnasVisibles] = useState<string[]>(ALL_COLUMNS);
  useEffect(() => {
    fetch('/api/admin/mis-columnas?modulo=presupuestos')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.columnas) && d.columnas.length > 0) setColumnasVisibles(d.columnas); })
      .catch(() => {});
  }, []);
  const colVisible = (key: string) => columnasVisibles.includes(key);

  // ── Acciones ─────────────────────────────────────────────────────
  const changePrioridad = async (id: string, prioridad: Prioridad) => {
    setSavingPrioridad(id);
    await fetch(`/api/presupuestos/${id}/prioridad`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prioridad }),
    });
    setSavingPrioridad(null);
    setTodosLosPresupuestos(prev => prev.map(p => p.id === id ? { ...p, prioridad } : p));
  };

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
    const id = editingPrecio.id;
    setTodosLosPresupuestos(prev => prev.map(p => p.id === id ? { ...p, precioFinal: valor } : p));
    setEditingPrecio(null);
  };

  const handlePedirAvance = async () => {
    if (!presupuestoAvance) return;
    setEnviandoAvance(true);
    try {
      const res = await fetch(`/api/presupuestos/${presupuestoAvance.id}/pedir-avance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: mensajeAvance }),
      });
      if (!res.ok) throw new Error('Error');
      setToastAvance({ msg: `Notificación enviada a ${presupuestoAvance.responsable?.nombre}`, error: false });
      setTimeout(() => setToastAvance(null), 3000);
      setDialogAvanceAbierto(false);
      setMensajeAvance('');
    } catch {
      setToastAvance({ msg: 'Error al enviar la notificación', error: true });
      setTimeout(() => setToastAvance(null), 3000);
    } finally {
      setEnviandoAvance(false);
    }
  };

  const limpiarFiltros = () => {
    setFiltroEstados([]);
    setFiltroPrioridades([]);
    setFiltroClienteId('');
    setFiltroObraId('');
    setFiltroDesde('');
    setFiltroHasta('');
    try {
      ['pres_f_estados', 'pres_f_prioridades', 'pres_f_clienteId', 'pres_f_desde', 'pres_f_hasta']
        .forEach(k => localStorage.removeItem(k));
    } catch {}
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Críticos */}
      {criticos.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 overflow-hidden shadow-[0_2px_8px_rgba(220,38,38,0.08)]">
          <button
            onClick={() => setCriticosOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-3.5 text-left hover:bg-red-100/50 transition-colors"
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
                    className={`rounded-xl border p-4 text-sm hover:shadow-md transition-shadow ${urgente ? 'border-red-400 bg-white shadow-[0_1px_4px_rgba(220,38,38,0.12)]' : 'border-red-200 bg-white'}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-800">#{p.numero}</span>
                      {urgente && <span className="text-xs bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full">{dias}d sin cambio</span>}
                    </div>
                    <p className="font-medium text-slate-700 truncate">{p.nombrePresupuesto ?? p.cliente.razonSocial}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{p.cliente.razonSocial}</p>
                    {p.responsable && (
                      <p className="text-slate-500 text-xs mt-1.5 font-medium">Resp: {p.responsable.nombre}</p>
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
          <h2 className="text-sm text-slate-500">
            {loading ? 'Cargando…' : `${presupuestosFiltrados.length} presupuestos encontrados`}
          </h2>
          <Button asChild className="bg-[#00ADEF] hover:bg-[#0089C7]">
            <Link href="/presupuestos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Presupuesto
            </Link>
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 p-4 bg-white rounded-2xl border border-[#D4B896]/40 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
          {/* Estado */}
          <DropdownMenu open={estadosOpen} onOpenChange={setEstadosOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-44 justify-between font-normal">
                <span className="truncate">
                  {filtroEstados.length === 0
                    ? 'Todos los estados'
                    : filtroEstados.length === 1
                      ? getLabelEstado(filtroEstados[0])
                      : `${filtroEstados.length} estados`}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-52">
              {Object.values(ESTADO_PRESUPUESTO).map((e) => (
                <DropdownMenuCheckboxItem
                  key={e}
                  checked={filtroEstados.includes(e)}
                  onCheckedChange={(checked) =>
                    setFiltroEstados(prev => checked ? [...prev, e] : prev.filter(x => x !== e))
                  }
                  onSelect={(ev) => ev.preventDefault()}
                >
                  <span style={{ ...getEstiloEstado(e), marginLeft: '4px' }}>{getLabelEstado(e)}</span>
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <div className="flex gap-2 p-2">
                <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" onClick={() => setFiltroEstados([])}>
                  Limpiar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-7 text-xs bg-[#00ADEF] hover:bg-[#0089C7]"
                  onClick={() => setEstadosOpen(false)}
                >
                  Aplicar
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Prioridad */}
          <DropdownMenu open={prioridadesOpen} onOpenChange={setPrioridadesOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-44 justify-between font-normal">
                <span className="truncate">
                  {filtroPrioridades.length === 0
                    ? 'Todas las prioridades'
                    : filtroPrioridades.length === 1
                      ? prioridadLabel[filtroPrioridades[0]]
                      : `${filtroPrioridades.length} prioridades`}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              {Object.values(PRIORIDAD).map((p) => (
                <DropdownMenuCheckboxItem
                  key={p}
                  checked={filtroPrioridades.includes(p)}
                  onCheckedChange={(checked) =>
                    setFiltroPrioridades(prev => checked ? [...prev, p] : prev.filter(x => x !== p))
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
                <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" onClick={() => setFiltroPrioridades([])}>
                  Limpiar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-7 text-xs bg-[#00ADEF] hover:bg-[#0089C7]"
                  onClick={() => setPrioridadesOpen(false)}
                >
                  Aplicar
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Select value={filtroClienteId || '__all__'} onValueChange={(v) => setFiltroClienteId(v === '__all__' ? '' : v)}>
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
            <Select value={filtroObraId || '__all__'} onValueChange={(v) => setFiltroObraId(v === '__all__' ? '' : v)}>
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

          <Input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} className="w-36" />
          <Input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} className="w-36" />

          {(filtroEstados.length > 0 || filtroPrioridades.length > 0 || filtroClienteId || filtroDesde || filtroHasta) && (
            <Button onClick={limpiarFiltros} variant="ghost" className="text-slate-400 hover:text-slate-600">
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="rounded-2xl border border-[#D4B896]/40 bg-white p-10 text-center text-slate-400 text-sm">
          Cargando presupuestos…
        </div>
      ) : (
        <div className="rounded-2xl border border-[#D4B896]/40 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden [&_td]:py-3.5">
          <Table>
            <TableHeader>
              <TableRow>
                {colVisible('numero') && <ResizableHead colKey="nro" defaultWidth={72} width={columnWidths.nro} onResize={handleResize}>Nro</ResizableHead>}
                {colVisible('nombre') && <ResizableHead colKey="nombre" defaultWidth={140} width={columnWidths.nombre} onResize={handleResize}>Nombre</ResizableHead>}
                {colVisible('cliente') && <ResizableHead colKey="cliente" defaultWidth={150} width={columnWidths.cliente} onResize={handleResize}>Cliente</ResizableHead>}
                {colVisible('obra') && <ResizableHead colKey="obra" defaultWidth={120} width={columnWidths.obra} onResize={handleResize}>Obra</ResizableHead>}
                {colVisible('responsable') && <ResizableHead colKey="responsable" defaultWidth={120} width={columnWidths.responsable} onResize={handleResize}>Responsable</ResizableHead>}
                {colVisible('prioridad') && <ResizableHead colKey="prioridad" defaultWidth={90} width={columnWidths.prioridad} onResize={handleResize}>Prioridad</ResizableHead>}
                {colVisible('estado') && <ResizableHead colKey="estado" defaultWidth={120} width={columnWidths.estado} onResize={handleResize}>Estado</ResizableHead>}
                {colVisible('recepcion') && <ResizableHead colKey="recepcion" defaultWidth={100} width={columnWidths.recepcion} onResize={handleResize}>Recepción</ResizableHead>}
                <ResizableHead colKey="limite" defaultWidth={110} width={columnWidths.limite} onResize={handleResize}>F. Límite</ResizableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {presupuestosPagina.map((p) => (
                <TableRow
                  key={p.id}
                  className={`border-b border-[#D4B896]/45 ${p.estado === 'ENVIADO' && p.archivos.length === 0 ? 'bg-amber-50' : ''}`}
                >
                  {colVisible('numero') && <TableCell className="font-bold text-slate-800">#{p.numero}</TableCell>}
                  {colVisible('nombre') && <TableCell className="max-w-[140px] truncate font-medium text-slate-700">{p.nombrePresupuesto ?? '—'}</TableCell>}
                  {colVisible('cliente') && <TableCell className="max-w-[150px] truncate font-semibold text-slate-800">{p.cliente.razonSocial}</TableCell>}
                  {colVisible('obra') && <TableCell className="text-slate-400 text-sm max-w-[120px] truncate">{p.obra?.nombre ?? '—'}</TableCell>}
                  {colVisible('responsable') && <TableCell className="text-slate-400 text-sm">{p.responsable?.nombre ?? p.creadoPor.nombre}</TableCell>}
                  {colVisible('prioridad') && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="focus:outline-none" disabled={savingPrioridad === p.id}>
                            <Badge variant="outline" className={`cursor-pointer ${prioridadBadgeClass[p.prioridad]}`}>
                              {prioridadLabel[p.prioridad]}
                            </Badge>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-28">
                          {Object.values(PRIORIDAD).map((pr) => (
                            <DropdownMenuItem
                              key={pr}
                              onSelect={() => changePrioridad(p.id, pr)}
                              disabled={pr === p.prioridad}
                              className="gap-2 cursor-pointer"
                            >
                              <Badge variant="outline" className={`${prioridadBadgeClass[pr]} pointer-events-none`}>
                                {prioridadLabel[pr]}
                              </Badge>
                              {pr === p.prioridad && <Check className="h-3 w-3 ml-auto shrink-0" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                  {colVisible('estado') && (
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span style={getEstiloEstado(p.estado)}>{getLabelEstado(p.estado)}</span>
                        {p.estado === 'ENVIADO' && p.archivos.length === 0 && (
                          <span title="Sin adjuntos">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {colVisible('recepcion') && (
                    <TableCell className="text-slate-500 text-sm" style={{ width: columnWidths.recepcion ?? 110 }}>
                      {p.fechaRecepcion
                        ? new Date(p.fechaRecepcion).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : '—'}
                    </TableCell>
                  )}
                  <TableCell className="text-slate-500 text-sm">
                    {p.fechaVencimiento
                      ? new Date(p.fechaVencimiento).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/presupuestos/${p.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                      {p.responsable && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Pedir avance al responsable"
                          onClick={() => { setPresupuestoAvance(p); setDialogAvanceAbierto(true); }}
                          className="text-slate-400 hover:text-[#00ADEF]"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {puedeEliminar && (
                        <EliminarPresupuestoBtn
                          presupuestoId={p.id}
                          numero={p.numero}
                          clienteNombre={p.cliente.razonSocial}
                          onDeleted={() => setTodosLosPresupuestos(prev => prev.filter(p2 => p2.id !== p.id))}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {presupuestosPagina.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-slate-400 py-10">
                    No hay presupuestos con los filtros aplicados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{presupuestosFiltrados.length} en total</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" disabled={paginaActual <= 1} onClick={() => setPaginaActual(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Página {paginaActual} de {totalPaginas}</span>
            <Button variant="outline" size="icon" disabled={paginaActual >= totalPaginas} onClick={() => setPaginaActual(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {toastAvance && (
        <div className={`fixed bottom-6 right-6 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2 ${toastAvance.error ? 'bg-red-600' : 'bg-green-600'}`}>
          {toastAvance.msg}
        </div>
      )}

      <Dialog open={dialogAvanceAbierto} onOpenChange={setDialogAvanceAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pedir avance</DialogTitle>
            <DialogDescription>
              Se enviará una notificación a <strong>{presupuestoAvance?.responsable?.nombre}</strong> pidiendo avance del presupuesto
              #{presupuestoAvance?.numero}{presupuestoAvance?.nombrePresupuesto ? ` — ${presupuestoAvance.nombrePresupuesto}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Mensaje (opcional)</Label>
            <Textarea
              value={mensajeAvance}
              onChange={(e) => setMensajeAvance(e.target.value)}
              placeholder="Ej: ¿Cómo viene este presupuesto? El cliente está esperando respuesta."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAvanceAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePedirAvance} disabled={enviandoAvance} style={{ background: '#00ADEF' }}>
              {enviandoAvance ? 'Enviando…' : 'Enviar notificación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

