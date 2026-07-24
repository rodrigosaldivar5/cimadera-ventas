'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Plus, Eye, ChevronLeft, ChevronRight, AlertTriangle, ChevronDown, ChevronUp, Check, MessageCircle, BarChart2 } from 'lucide-react';
import { EliminarPresupuestoBtn } from '@/components/presupuestos/eliminar-presupuesto-btn';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { formatCurrency } from '@/lib/utils';
import { ESTADO_PRESUPUESTO, PRIORIDAD, getEstiloEstado, getLabelEstado, MOTIVOS_PERDIDO_COMPUTABLE, MOTIVOS_NO_COMPUTABLE, MOTIVO_CIERRE_LABEL, type EstadoPresupuesto, type Prioridad } from '@/lib/enums';
import {
  clasificarTransicionPresupuesto,
  LABEL_TIPO_MOVIMIENTO,
  MOTIVOS_TRANSICION,
} from '@/lib/mi-trabajo';

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
  fechaPrimerEnvio?: Date | string | null;
  totalFinal: unknown;
  tasaIva: unknown;
  totalConIva: unknown;
  precioFinal: unknown;
  moneda?: string;
  clienteId?: string;
  obraId?: string;
  responsableId?: string | null;
  division?: string | null;
  esEstandar?: boolean;
  rubros?: string[];
  tieneQuejaCliente?: boolean;
  motivoQuejaCliente?: string | null;
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
  usuarios?: { id: string; nombre: string }[];
  criticos: PresupuestoCritico[];
  userEmail: string;
}

function diasDesde(fecha: Date | null): number {
  if (!fecha) return 0;
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 86_400_000);
}

const MOTIVOS_QUEJA: Record<string, string> = {
  COTIZACION_MAL_HECHA: 'Cotización mal hecha',
  TIEMPO_COTIZACION: 'Tiempos de cotización',
  MALA_PREDISPOSICION: 'Mala predisposición',
  ERROR_DATOS: 'Error en datos / medidas / alcance',
  OTRO: 'Otro',
};

const ESTADOS_BASE_QUEJA = new Set(['ENVIADO', 'APROBADO', 'RECHAZADO']);

export function PresupuestosTable({ criticos, userEmail }: Props) {
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
  const [filtroObraId, setFiltroObraId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try { return localStorage.getItem('pres_f_obraId') ?? ''; } catch { return ''; }
  });
  const [filtroResponsableId, setFiltroResponsableId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try { return localStorage.getItem('pres_f_responsableId') ?? ''; } catch { return ''; }
  });
  const [filtroDesde, setFiltroDesde] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try { return localStorage.getItem('pres_f_desde') ?? ''; } catch { return ''; }
  });
  const [filtroHasta, setFiltroHasta] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try { return localStorage.getItem('pres_f_hasta') ?? ''; } catch { return ''; }
  });
  const [filtroEstandar, setFiltroEstandar] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try { return localStorage.getItem('pres_f_estandar') ?? ''; } catch { return ''; }
  });
  const [filtroRubros, setFiltroRubros] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const s = localStorage.getItem('pres_f_rubros'); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  useEffect(() => { try { localStorage.setItem('pres_f_estados', JSON.stringify(filtroEstados)); } catch {} }, [filtroEstados]);
  useEffect(() => { try { localStorage.setItem('pres_f_prioridades', JSON.stringify(filtroPrioridades)); } catch {} }, [filtroPrioridades]);
  useEffect(() => { try { localStorage.setItem('pres_f_obraId', filtroObraId); } catch {} }, [filtroObraId]);
  useEffect(() => { try { localStorage.setItem('pres_f_responsableId', filtroResponsableId); } catch {} }, [filtroResponsableId]);
  useEffect(() => { try { localStorage.setItem('pres_f_desde', filtroDesde); } catch {} }, [filtroDesde]);
  useEffect(() => { try { localStorage.setItem('pres_f_hasta', filtroHasta); } catch {} }, [filtroHasta]);
  useEffect(() => { try { localStorage.setItem('pres_f_estandar', filtroEstandar); } catch {} }, [filtroEstandar]);
  useEffect(() => { try { localStorage.setItem('pres_f_rubros', JSON.stringify(filtroRubros)); } catch {} }, [filtroRubros]);

  // ── Paginación ────────────────────────────────────────────────────
  const [paginaActual, setPaginaActual] = useState(1);
  useEffect(() => { setPaginaActual(1); }, [filtroEstados, filtroPrioridades, filtroObraId, filtroResponsableId, filtroDesde, filtroHasta, filtroEstandar, filtroRubros]);

  // ── Filtrado cliente-side ─────────────────────────────────────────
  const obrasUnicas = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of todosLosPresupuestos) {
      const id = p.obra?.id ?? p.obraId;
      const nombre = p.obra?.nombre;
      if (id && nombre) map.set(id, nombre);
    }
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [todosLosPresupuestos]);

  const responsablesUnicos = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of todosLosPresupuestos) {
      const id = p.responsableId;
      const nombre = p.responsable?.nombre;
      if (id && nombre) map.set(id, nombre);
    }
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [todosLosPresupuestos]);

  const presupuestosFiltrados = useMemo(() => {
    let r = [...todosLosPresupuestos];
    if (filtroEstados.length > 0)     r = r.filter(p => filtroEstados.includes(p.estado));
    if (filtroPrioridades.length > 0) r = r.filter(p => filtroPrioridades.includes(p.prioridad));
    if (filtroObraId)         r = r.filter(p => p.obra?.id === filtroObraId || p.obraId === filtroObraId);
    if (filtroResponsableId)  r = r.filter(p => p.responsableId === filtroResponsableId);
    if (filtroDesde) { const d = new Date(filtroDesde); r = r.filter(p => new Date(p.fechaCreacion) >= d); }
    if (filtroHasta) { const h = new Date(filtroHasta); h.setHours(23, 59, 59); r = r.filter(p => new Date(p.fechaCreacion) <= h); }
    if (filtroEstandar === 'si') r = r.filter(p => p.esEstandar);
    if (filtroEstandar === 'no') r = r.filter(p => !p.esEstandar);
    if (filtroRubros.length > 0) r = r.filter(p => filtroRubros.some(fr => (p.rubros ?? []).includes(fr)));
    return r;
  }, [todosLosPresupuestos, filtroEstados, filtroPrioridades, filtroObraId, filtroResponsableId, filtroDesde, filtroHasta, filtroEstandar, filtroRubros]);

  const totalPaginas = Math.ceil(presupuestosFiltrados.length / ITEMS_POR_PAGINA);
  const presupuestosPagina = presupuestosFiltrados.slice(
    (paginaActual - 1) * ITEMS_POR_PAGINA,
    paginaActual * ITEMS_POR_PAGINA,
  );

  // Críticos derivados del estado local (se actualiza al cambiar estado desde tabla)
  const criticosActivos = useMemo(() => {
    if (loading) return criticos;
    return todosLosPresupuestos.filter(
      (p) => p.prioridad === 'ALTA' && (p.estado === 'EN_PROCESO' || p.estado === 'PARA_ENVIAR'),
    );
  }, [loading, todosLosPresupuestos, criticos]);

  // Resumen por estado según filtros activos
  const resumen = useMemo(() => ({
    total:      presupuestosFiltrados.length,
    pendiente:  presupuestosFiltrados.filter(p => p.estado === 'PENDIENTE').length,
    enProceso:  presupuestosFiltrados.filter(p => p.estado === 'EN_PROCESO').length,
    frenado:    presupuestosFiltrados.filter(p => p.estado === 'FRENADO').length,
    finalizado: presupuestosFiltrados.filter(p => p.estado === 'FINALIZADO').length,
  }), [presupuestosFiltrados]);

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
  const [metricasOpen, setMetricasOpen] = useState(false);

  // ── Métricas de tiempos ──────────────────────────────────────────
  const [tiemposOpen, setTiemposOpen] = useState(false);
  const [tiemposDesde, setTiemposDesde] = useState('');
  const [tiemposHasta, setTiemposHasta] = useState('');
  const [tiemposResponsableId, setTiemposResponsableId] = useState('');
  const [tiemposLoading, setTiemposLoading] = useState(false);
  type TiemposRow = {
    responsableId: string | null; responsableNombre: string;
    totalPresupuestos: number; minutosEnProceso: number; minutosFrenado: number;
    minutosPromedio: number; porcentajeJornada: number;
  };
  const [tiemposData, setTiemposData] = useState<TiemposRow[]>([]);

  // Estado change
  const [savingEstado, setSavingEstado] = useState<string | null>(null);
  const [confirmarAprobado, setConfirmarAprobado] = useState<PresupuestoRow | null>(null);
  const [confirmandoAprobado, setConfirmandoAprobado] = useState(false);
  const [rechazarModal, setRechazarModal] = useState<PresupuestoRow | null>(null);
  const [rechazarResultado, setRechazarResultado] = useState('');
  const [rechazarMotivo, setRechazarMotivo] = useState('');
  const [rechazarComentario, setRechazarComentario] = useState('');
  const [rechazandoEstado, setRechazandoEstado] = useState(false);

  // Transición especial
  const [transicionModal, setTransicionModal] = useState<{ row: PresupuestoRow; nuevoEstado: string; tipo: string } | null>(null);
  const [transicionMotivo, setTransicionMotivo] = useState('');

  const fetchTiempos = async () => {
    setTiemposLoading(true);
    try {
      const params = new URLSearchParams();
      if (tiemposDesde) params.set('desde', tiemposDesde);
      if (tiemposHasta) params.set('hasta', tiemposHasta);
      if (tiemposResponsableId) params.set('responsableId', tiemposResponsableId);
      const res = await fetch(`/api/presupuestos/metricas-tiempos?${params}`);
      const d = await res.json();
      setTiemposData(d.resumenPorResponsable ?? []);
    } catch {}
    setTiemposLoading(false);
  };

  useEffect(() => {
    if (tiemposOpen) { fetchTiempos(); }
  }, [tiemposOpen, tiemposDesde, tiemposHasta, tiemposResponsableId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtMin = (m: number) => {
    if (m <= 0) return '—';
    const h = Math.floor(m / 60);
    const min = m % 60;
    if (h === 0) return `${min}min`;
    if (min === 0) return `${h}h`;
    return `${h}h ${min}m`;
  };

  const quejaMetrics = useMemo(() => {
    const base = presupuestosFiltrados.filter(
      (p) => p.fechaPrimerEnvio != null || ESTADOS_BASE_QUEJA.has(p.estado),
    );
    const total = base.length;
    const conQueja = base.filter((p) => p.tieneQuejaCliente).length;
    const satisfaccion = total === 0 ? 100 : ((total - conQueja) / total) * 100;
    const porMotivo: Record<string, number> = {};
    const porResponsable: Record<string, number> = {};
    for (const p of base.filter((p) => p.tieneQuejaCliente)) {
      if (p.motivoQuejaCliente) {
        porMotivo[p.motivoQuejaCliente] = (porMotivo[p.motivoQuejaCliente] ?? 0) + 1;
      }
      const nombre = p.responsable?.nombre ?? p.creadoPor.nombre;
      porResponsable[nombre] = (porResponsable[nombre] ?? 0) + 1;
    }
    return { total, conQueja, satisfaccion, porMotivo, porResponsable };
  }, [presupuestosFiltrados]);

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

  const changeEstado = async (
    id: string,
    estado: string,
    extra?: { resultadoComercial?: string; motivoCierre?: string; comentarioCierre?: string; motivoMovimiento?: string },
  ) => {
    setSavingEstado(id);
    try {
      const res = await fetch(`/api/presupuestos/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, ...extra }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? 'Error al cambiar estado');
      }
      setTodosLosPresupuestos(prev =>
        prev.map(p => p.id === id ? { ...p, estado: estado as EstadoPresupuesto } : p),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar estado';
      setToastAvance({ msg, error: true });
      setTimeout(() => setToastAvance(null), 3500);
    }
    setSavingEstado(null);
  };

  const limpiarFiltros = () => {
    setFiltroEstados([]);
    setFiltroPrioridades([]);
    setFiltroObraId('');
    setFiltroResponsableId('');
    setFiltroDesde('');
    setFiltroHasta('');
    setFiltroEstandar('');
    setFiltroRubros([]);
    try {
      ['pres_f_estados', 'pres_f_prioridades', 'pres_f_obraId', 'pres_f_responsableId', 'pres_f_desde', 'pres_f_hasta', 'pres_f_estandar', 'pres_f_rubros']
        .forEach(k => localStorage.removeItem(k));
    } catch {}
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Críticos */}
      {criticosActivos.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 overflow-hidden shadow-[0_2px_8px_rgba(220,38,38,0.08)]">
          <button
            onClick={() => setCriticosOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-3.5 text-left hover:bg-red-100/50 transition-colors"
          >
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <span className="font-semibold text-red-700 text-sm">
              Presupuestos Críticos — {criticosActivos.length} de alta prioridad
            </span>
            {criticosOpen ? <ChevronUp className="ml-auto h-4 w-4 text-red-400" /> : <ChevronDown className="ml-auto h-4 w-4 text-red-400" />}
          </button>
          {criticosOpen && (
            <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {criticosActivos.map((p) => {
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
                    <p className="text-slate-500 text-xs mt-0.5">{p.cliente.razonSocial}</p>
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

      {/* Métricas de quejas */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.05)] overflow-hidden">
        <button
          onClick={() => setMetricasOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
        >
          <BarChart2 className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="font-medium text-slate-700 text-sm">Métricas de satisfacción</span>
          {!metricasOpen && quejaMetrics.conQueja > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 font-semibold ml-1">
              {quejaMetrics.conQueja} queja{quejaMetrics.conQueja !== 1 ? 's' : ''}
            </span>
          )}
          {metricasOpen ? (
            <ChevronUp className="ml-auto h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="ml-auto h-4 w-4 text-slate-400" />
          )}
        </button>
        {metricasOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 pt-3">Calculado sobre los {presupuestosFiltrados.length} presupuestos filtrados en la tabla.</p>

            {/* KPIs principales */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                <p className="text-2xl font-bold text-slate-800">{quejaMetrics.total}</p>
                <p className="text-xs text-slate-500 mt-0.5">Presupuestos enviados</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">{quejaMetrics.conQueja}</p>
                <p className="text-xs text-amber-600 mt-0.5">Con queja</p>
              </div>
              <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{quejaMetrics.satisfaccion.toFixed(1)}%</p>
                <p className="text-xs text-green-600 mt-0.5">Satisfacción</p>
              </div>
            </div>

            {/* Por motivo y por responsable */}
            {quejaMetrics.conQueja > 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Por motivo</p>
                  <div className="space-y-1">
                    {Object.entries(quejaMetrics.porMotivo).sort((a, b) => b[1] - a[1]).map(([m, n]) => (
                      <div key={m} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600 text-xs">{MOTIVOS_QUEJA[m] ?? m}</span>
                        <span className="font-semibold text-slate-800 tabular-nums">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Por responsable</p>
                  <div className="space-y-1">
                    {Object.entries(quejaMetrics.porResponsable).sort((a, b) => b[1] - a[1]).map(([nombre, n]) => (
                      <div key={nombre} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600 text-xs">{nombre}</span>
                        <span className="font-semibold text-slate-800 tabular-nums">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resumen de presupuestos */}
      {!loading && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">Resumen</span>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
              <span className="text-sm font-bold text-slate-800 tabular-nums">{resumen.total}</span>
              <span className="text-xs text-slate-500">asignados</span>
            </div>
            {resumen.pendiente > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
                <span className="text-sm font-bold text-red-700 tabular-nums">{resumen.pendiente}</span>
                <span className="text-xs text-red-500">Pendiente{resumen.pendiente !== 1 ? 's' : ''}</span>
              </div>
            )}
            {resumen.enProceso > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-1.5">
                <span className="text-sm font-bold text-yellow-700 tabular-nums">{resumen.enProceso}</span>
                <span className="text-xs text-yellow-600">En proceso</span>
              </div>
            )}
            {resumen.frenado > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5">
                <span className="text-sm font-bold text-purple-700 tabular-nums">{resumen.frenado}</span>
                <span className="text-xs text-purple-500">Frenado{resumen.frenado !== 1 ? 's' : ''}</span>
              </div>
            )}
            {resumen.finalizado > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5">
                <span className="text-sm font-bold text-amber-700 tabular-nums">{resumen.finalizado}</span>
                <span className="text-xs text-amber-600">Finalizado{resumen.finalizado !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
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

          <SearchableSelect
            value={filtroObraId}
            onValueChange={(v) => setFiltroObraId(v)}
            options={[{ value: '', label: 'Todas las obras' }, ...obrasUnicas]}
            placeholder="Todas las obras"
            searchPlaceholder="Buscar obra…"
            emptyText="Sin obras"
            className="min-w-[260px] h-10"
            contentClassName="min-w-[320px]"
          />

          <Select value={filtroResponsableId || '__all__'} onValueChange={(v) => setFiltroResponsableId(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos los responsables" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los responsables</SelectItem>
              {responsablesUnicos.map((u) => (
                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} className="w-36" />
          <Input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} className="w-36" />

          <Select value={filtroEstandar || '__all__'} onValueChange={(v) => setFiltroEstandar(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Estándar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="si">Estándar</SelectItem>
              <SelectItem value="no">No estándar</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 gap-1">
                Rubros {filtroRubros.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{filtroRubros.length}</Badge>}
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {(['MADERA', 'MELAMINA', 'ALUMINIO'] as const).map((r) => (
                <DropdownMenuCheckboxItem
                  key={r}
                  checked={filtroRubros.includes(r)}
                  onCheckedChange={(checked) => setFiltroRubros(prev => checked ? [...prev, r] : prev.filter(x => x !== r))}
                >
                  {r.charAt(0) + r.slice(1).toLowerCase()}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <div className="p-2">
                <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => setFiltroRubros([])}>
                  Limpiar
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {(filtroEstados.length > 0 || filtroPrioridades.length > 0 || filtroObraId || filtroResponsableId || filtroDesde || filtroHasta || filtroEstandar || filtroRubros.length > 0) && (
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
                  {colVisible('numero') && (
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Link href={`/presupuestos/${p.id}`} className="font-bold text-slate-800 hover:text-[#00ADEF] hover:underline">
                          #{p.numero}
                        </Link>
                        {p.esEstandar && (
                          <span className="inline-flex items-center px-1 py-px rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 leading-tight" title="Presupuesto estándar (27 hs hábiles)" role="status">
                            Est
                          </span>
                        )}
                        {p.division === 'MIXTO' && (p.rubros ?? []).length > 0 && (
                          <span className="inline-flex items-center px-1 py-px rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 leading-tight" title={`Mixto: ${(p.rubros ?? []).map((r: string) => r.charAt(0) + r.slice(1).toLowerCase()).join(' + ')}`} role="status">
                            {(p.rubros ?? []).map((r: string) => r.slice(0, 3)).join('+')}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {colVisible('nombre') && (
                    <TableCell className="max-w-[140px] truncate">
                      <Link href={`/presupuestos/${p.id}`} className="font-medium text-slate-700 hover:text-[#00ADEF] hover:underline block truncate">
                        {p.nombrePresupuesto ?? '—'}
                      </Link>
                    </TableCell>
                  )}
                  {colVisible('cliente') && <TableCell className="max-w-[150px] truncate font-semibold text-slate-800">{p.cliente.razonSocial}</TableCell>}
                  {colVisible('obra') && <TableCell className="text-slate-500 text-sm max-w-[120px] truncate">{p.obra?.nombre ?? '—'}</TableCell>}
                  {colVisible('responsable') && <TableCell className="text-slate-500 text-sm">{p.responsable?.nombre ?? p.creadoPor.nombre}</TableCell>}
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="focus:outline-none disabled:opacity-60"
                              disabled={savingEstado === p.id}
                            >
                              <span style={{ ...getEstiloEstado(p.estado), cursor: 'pointer' }}>
                                {savingEstado === p.id ? '…' : getLabelEstado(p.estado)}
                              </span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-36">
                            {Object.values(ESTADO_PRESUPUESTO).map((e) => (
                              <DropdownMenuItem
                                key={e}
                                disabled={e === p.estado}
                                className="gap-2 cursor-pointer"
                                onSelect={() => {
                                  if (e === 'APROBADO') { setConfirmarAprobado(p); return; }
                                  if (e === 'RECHAZADO') { setRechazarModal(p); return; }
                                  const tipo = clasificarTransicionPresupuesto(p.estado, e);
                                  if (tipo) {
                                    setTransicionModal({ row: p, nuevoEstado: e, tipo });
                                    setTransicionMotivo('');
                                    return;
                                  }
                                  void changeEstado(p.id, e);
                                }}
                              >
                                <span style={{ ...getEstiloEstado(e), fontSize: '11px', padding: '1px 6px' }}>
                                  {getLabelEstado(e)}
                                </span>
                                {e === p.estado && <Check className="h-3 w-3 ml-auto shrink-0" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {p.estado === 'ENVIADO' && p.archivos.length === 0 && (
                          <span title="Sin adjuntos">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          </span>
                        )}
                        {p.tieneQuejaCliente && (
                          <span
                            title={`Con queja${p.motivoQuejaCliente ? `: ${MOTIVOS_QUEJA[p.motivoQuejaCliente] ?? p.motivoQuejaCliente}` : ''}`}
                            className="text-[10px] bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-1.5 py-0.5 font-semibold leading-none"
                          >
                            Q
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

      {/* Dialog: confirmar APROBADO */}
      <Dialog open={!!confirmarAprobado} onOpenChange={(open) => { if (!open) setConfirmarAprobado(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar aprobación</DialogTitle>
            <DialogDescription>
              ¿Aprobar el presupuesto <strong>#{confirmarAprobado?.numero}{confirmarAprobado?.nombrePresupuesto ? ` — ${confirmarAprobado.nombrePresupuesto}` : ''}</strong>?
              Esta acción genera integraciones con Admin y Producción y no puede revertirse.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarAprobado(null)}>Cancelar</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={confirmandoAprobado}
              onClick={async () => {
                if (!confirmarAprobado) return;
                setConfirmandoAprobado(true);
                await changeEstado(confirmarAprobado.id, 'APROBADO');
                setConfirmandoAprobado(false);
                setConfirmarAprobado(null);
              }}
            >
              {confirmandoAprobado ? 'Procesando…' : 'Sí, aprobar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: rechazar presupuesto */}
      <Dialog
        open={!!rechazarModal}
        onOpenChange={(open) => {
          if (!open) { setRechazarModal(null); setRechazarResultado(''); setRechazarMotivo(''); setRechazarComentario(''); }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar presupuesto #{rechazarModal?.numero}</DialogTitle>
            <DialogDescription>Completar los datos de cierre para continuar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Resultado comercial *</Label>
              <Select value={rechazarResultado} onValueChange={(v) => { setRechazarResultado(v); setRechazarMotivo(''); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar resultado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERDIDO_COMPUTABLE">Perdido (computable)</SelectItem>
                  <SelectItem value="NO_COMPUTABLE">No computable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {rechazarResultado && (
              <div className="space-y-1.5">
                <Label>Motivo *</Label>
                <Select value={rechazarMotivo} onValueChange={setRechazarMotivo}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar motivo" /></SelectTrigger>
                  <SelectContent>
                    {(rechazarResultado === 'PERDIDO_COMPUTABLE' ? MOTIVOS_PERDIDO_COMPUTABLE : MOTIVOS_NO_COMPUTABLE).map((m) => (
                      <SelectItem key={m} value={m}>{MOTIVO_CIERRE_LABEL[m] ?? m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Comentario (opcional)</Label>
              <Textarea value={rechazarComentario} onChange={(e) => setRechazarComentario(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setRechazarModal(null); setRechazarResultado(''); setRechazarMotivo(''); setRechazarComentario(''); }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!rechazarResultado || !rechazarMotivo || rechazandoEstado}
              onClick={async () => {
                if (!rechazarModal || !rechazarResultado || !rechazarMotivo) return;
                setRechazandoEstado(true);
                await changeEstado(rechazarModal.id, 'RECHAZADO', {
                  resultadoComercial: rechazarResultado,
                  motivoCierre: rechazarMotivo,
                  comentarioCierre: rechazarComentario || undefined,
                });
                setRechazandoEstado(false);
                setRechazarModal(null);
                setRechazarResultado('');
                setRechazarMotivo('');
                setRechazarComentario('');
              }}
            >
              {rechazandoEstado ? 'Procesando…' : 'Rechazar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog transición especial ── */}
      <Dialog open={!!transicionModal} onOpenChange={(open) => { if (!open) { setTransicionModal(null); setTransicionMotivo(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar cambio de estado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-sm text-amber-800">
                Este cambio será registrado como{' '}
                <span className="font-semibold">
                  {transicionModal?.tipo ? LABEL_TIPO_MOVIMIENTO[transicionModal.tipo as keyof typeof LABEL_TIPO_MOVIMIENTO] : ''}
                </span>.
                ¿Querés continuar?
              </p>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Motivo (recomendado)</Label>
              <Select value={transicionMotivo} onValueChange={setTransicionMotivo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_TRANSICION.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTransicionModal(null); setTransicionMotivo(''); }}>
              Cancelar
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              disabled={savingEstado === transicionModal?.row.id}
              onClick={async () => {
                if (!transicionModal) return;
                await changeEstado(transicionModal.row.id, transicionModal.nuevoEstado, {
                  motivoMovimiento: transicionMotivo || undefined,
                });
                setTransicionModal(null);
                setTransicionMotivo('');
              }}
            >
              {savingEstado === transicionModal?.row.id ? 'Procesando…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

