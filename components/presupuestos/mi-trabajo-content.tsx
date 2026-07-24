'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  FileText,
  ExternalLink,
  Users,
  Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PerfilMiTrabajo } from '@/lib/mi-trabajo';

type PresupuestoBasico = {
  id: string;
  numero: number;
  nombrePresupuesto: string | null;
  estado: string;
  cliente: { razonSocial: string } | null;
  obra: { nombre: string } | null;
};

type TrabajoDiaItem = {
  id: string;
  userId: string;
  presupuestoId: string;
  fechaKey: string;
  orden: number;
  completado: boolean;
  completadoAt: string | null;
  nota: string | null;
  presupuesto: PresupuestoBasico;
  user?: { id: string; nombre: string };
};

type PresupuestoItem = PresupuestoBasico & {
  prioridad: string | null;
  responsable: { id: string; nombre: string } | null;
  fechaCreacion: string;
  fechaVencimiento: string | null;
  rubros?: string[];
};

type ResumenResponsable = {
  id: string;
  nombre: string;
  pendientes: number;
  enProceso: number;
  frenados: number;
  finalizados: number;
  paraEnviar: number;
  enviados: number;
  abiertos: number;
  aTerminarHoy: number;
  completadosHoy: number;
};

interface Props {
  perfil: PerfilMiTrabajo;
  isManager: boolean;
  presupuestos: PresupuestoItem[];
  responsables: { id: string; nombre: string }[];
  fechaKey: string;
  userId: string;
}

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-red-100 text-red-700 border-red-200',
  EN_PROCESO: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  FRENADO: 'bg-purple-100 text-purple-700 border-purple-200',
  FINALIZADO: 'bg-amber-100 text-amber-700 border-amber-200',
  PARA_ENVIAR: 'bg-blue-100 text-blue-700 border-blue-200',
  ENVIADO: 'bg-sky-100 text-sky-700 border-sky-200',
  APROBADO: 'bg-green-100 text-green-700 border-green-200',
  RECHAZADO: 'bg-red-100 text-red-700 border-red-200',
};

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  FRENADO: 'Frenado',
  FINALIZADO: 'Finalizado',
  PARA_ENVIAR: 'Para enviar',
  ENVIADO: 'Enviado',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
};

const TODOS_ESTADOS = ['PENDIENTE', 'EN_PROCESO', 'FRENADO', 'FINALIZADO', 'PARA_ENVIAR', 'ENVIADO', 'APROBADO', 'RECHAZADO'];

const ESTADOS_DEFAULT: Record<PerfilMiTrabajo, string[]> = {
  vendedor: ['PENDIENTE', 'EN_PROCESO', 'FRENADO', 'FINALIZADO'],
  gerencia: ['FINALIZADO', 'PARA_ENVIAR', 'ENVIADO', 'APROBADO', 'RECHAZADO'],
  direccion: ['PARA_ENVIAR', 'ENVIADO', 'APROBADO', 'RECHAZADO'],
};

export function MiTrabajoContent({
  perfil,
  isManager,
  presupuestos,
  responsables,
  fechaKey,
  userId,
}: Props) {
  const [selectedResponsable, setSelectedResponsable] = useState<string>(isManager ? '__all__' : userId);
  const [filtroEstados, setFiltroEstados] = useState<string[]>(ESTADOS_DEFAULT[perfil] ?? []);
  const [estadosOpen, setEstadosOpen] = useState(false);
  const [filtroRubros, setFiltroRubros] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [trabajoHoy, setTrabajoHoy] = useState<TrabajoDiaItem[]>([]);
  const [pendientesAnteriores, setPendientesAnteriores] = useState<TrabajoDiaItem[]>([]);
  const [resumenEquipo, setResumenEquipo] = useState<ResumenResponsable[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3000);
  };

  const targetParam = isManager && selectedResponsable !== userId ? selectedResponsable : undefined;

  const fetchTrabajoHoy = useCallback(async (targetId?: string) => {
    const params = new URLSearchParams();
    if (targetId && targetId !== '__all__') params.set('targetUserId', targetId);
    const res = await fetch(`/api/presupuestos/mi-trabajo?${params}`);
    if (res.ok) return res.json();
    return [];
  }, []);

  const fetchPendientes = useCallback(async (targetId?: string) => {
    const params = new URLSearchParams();
    if (targetId) params.set('targetUserId', targetId);
    const res = await fetch(`/api/presupuestos/mi-trabajo/pendientes?${params}`);
    if (res.ok) return res.json();
    return [];
  }, []);

  const fetchResumen = useCallback(async () => {
    const res = await fetch('/api/presupuestos/mi-trabajo/resumen-equipo');
    if (res.ok) return res.json();
    return [];
  }, []);

  useEffect(() => {
    setInitialLoading(true);

    if (isManager && selectedResponsable === '__all__') {
      Promise.all([fetchResumen(), fetchPendientes('__all__')]).then(([resumen, pend]) => {
        setResumenEquipo(resumen);
        setPendientesAnteriores(pend);
        setTrabajoHoy([]);
        setInitialLoading(false);
      });
    } else {
      const target = isManager ? selectedResponsable : undefined;
      Promise.all([fetchTrabajoHoy(target), fetchPendientes(target)]).then(([hoy, pend]) => {
        setTrabajoHoy(hoy);
        setPendientesAnteriores(pend);
        setInitialLoading(false);
      });
      if (isManager) {
        fetchResumen().then(setResumenEquipo);
      }
    }
  }, [selectedResponsable, isManager, fetchTrabajoHoy, fetchPendientes, fetchResumen]);

  const agregarAHoy = useCallback(async (presupuestoId: string, forUserId?: string) => {
    if (trabajoHoy.some((t) => t.presupuestoId === presupuestoId)) {
      showToast('Ya está en la lista de hoy', true);
      return;
    }
    setLoading(presupuestoId);
    try {
      const body: Record<string, string> = { presupuestoId };
      if (forUserId && isManager) body.targetUserId = forUserId;
      const res = await fetch('/api/presupuestos/mi-trabajo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error ?? 'Error al agregar', true);
        return;
      }
      const item = await res.json();
      if (selectedResponsable !== '__all__') {
        setTrabajoHoy((prev) => [...prev, item]);
      }
      showToast('Agregado a hoy');
    } catch {
      showToast('Error de conexión', true);
    } finally {
      setLoading(null);
    }
  }, [trabajoHoy, isManager, selectedResponsable]);

  const quitarDeHoy = useCallback(async (id: string) => {
    setLoading(id);
    try {
      const res = await fetch(`/api/presupuestos/mi-trabajo?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        showToast('Error al quitar', true);
        return;
      }
      setTrabajoHoy((prev) => prev.filter((t) => t.id !== id));
      setPendientesAnteriores((prev) => prev.filter((t) => t.id !== id));
      showToast('Quitado de la lista');
    } catch {
      showToast('Error de conexión', true);
    } finally {
      setLoading(null);
    }
  }, []);

  const toggleCompletado = useCallback(async (id: string, completado: boolean) => {
    setLoading(id);
    try {
      const res = await fetch('/api/presupuestos/mi-trabajo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, completado }),
      });
      if (!res.ok) {
        showToast('Error al actualizar', true);
        return;
      }
      const updated = await res.json();
      setTrabajoHoy((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch {
      showToast('Error de conexión', true);
    } finally {
      setLoading(null);
    }
  }, []);

  const moverOrden = useCallback(async (id: string, dir: 'up' | 'down') => {
    const idx = trabajoHoy.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= trabajoHoy.length) return;

    const newList = [...trabajoHoy];
    [newList[idx], newList[swapIdx]] = [newList[swapIdx], newList[idx]];
    setTrabajoHoy(newList);

    try {
      await Promise.all([
        fetch('/api/presupuestos/mi-trabajo', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: newList[idx].id, orden: idx }),
        }),
        fetch('/api/presupuestos/mi-trabajo', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: newList[swapIdx].id, orden: swapIdx }),
        }),
      ]);
    } catch {
      showToast('Error al reordenar', true);
    }
  }, [trabajoHoy]);

  const moverAHoy = useCallback(async (item: TrabajoDiaItem) => {
    setLoading(item.id);
    try {
      await fetch(`/api/presupuestos/mi-trabajo?id=${item.id}`, { method: 'DELETE' });
      const body: Record<string, string> = { presupuestoId: item.presupuestoId };
      if (isManager && selectedResponsable !== '__all__') body.targetUserId = selectedResponsable;
      else if (isManager && item.userId) body.targetUserId = item.userId;
      const res = await fetch('/api/presupuestos/mi-trabajo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const newItem = await res.json();
        setPendientesAnteriores((prev) => prev.filter((t) => t.id !== item.id));
        if (selectedResponsable !== '__all__') {
          setTrabajoHoy((prev) => [...prev, newItem]);
        }
        showToast('Movido a hoy');
      }
    } catch {
      showToast('Error de conexión', true);
    } finally {
      setLoading(null);
    }
  }, [isManager, selectedResponsable]);

  const idsEnHoy = new Set(trabajoHoy.map((t) => t.presupuestoId));

  const presupuestosFiltrados = useMemo(() => {
    let list = presupuestos.filter((p) => !idsEnHoy.has(p.id));

    if (isManager && selectedResponsable !== '__all__') {
      list = list.filter((p) => p.responsable?.id === selectedResponsable);
    }
    if (filtroEstados.length > 0) {
      list = list.filter((p) => filtroEstados.includes(p.estado));
    }
    if (filtroRubros.length > 0) {
      list = list.filter((p) => filtroRubros.some(fr => (p.rubros ?? []).includes(fr)));
    }
    if (busqueda) {
      const q = busqueda.toLowerCase();
      list = list.filter(
        (p) =>
          String(p.numero).includes(q) ||
          (p.nombrePresupuesto ?? '').toLowerCase().includes(q) ||
          (p.cliente?.razonSocial ?? '').toLowerCase().includes(q) ||
          (p.obra?.nombre ?? '').toLowerCase().includes(q) ||
          (p.responsable?.nombre ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [presupuestos, idsEnHoy, isManager, selectedResponsable, filtroEstados, filtroRubros, busqueda]);

  const completados = trabajoHoy.filter((t) => t.completado).length;
  const total = trabajoHoy.length;

  const selectedNombre = selectedResponsable === '__all__'
    ? null
    : responsables.find((r) => r.id === selectedResponsable)?.nombre ?? null;

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-slate-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {isManager ? (
            <Users className="h-7 w-7 text-[#00ADEF]" />
          ) : (
            <ClipboardList className="h-7 w-7 text-[#00ADEF]" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isManager ? 'Trabajo del equipo' : 'Mi trabajo'}
            </h1>
            <p className="text-sm text-slate-500">
              {isManager
                ? 'Organizá y priorizá los presupuestos por responsable.'
                : `${fechaKey}`}
            </p>
          </div>
        </div>
        {selectedResponsable !== '__all__' && total > 0 && (
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-green-600">{completados}</span>
            <span className="text-slate-400"> / {total}</span>
            <span className="ml-1">completados</span>
          </div>
        )}
      </div>

      {/* Filtro responsable (solo gerencia) */}
      {isManager && (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-medium text-slate-700">Responsable</label>
          <select
            value={selectedResponsable}
            onChange={(e) => {
              setSelectedResponsable(e.target.value);
              setFiltroEstados(ESTADOS_DEFAULT[perfil] ?? []);
              setBusqueda('');
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-[#00ADEF] focus:outline-none focus:ring-1 focus:ring-[#00ADEF]"
          >
            <option value="__all__">Todos</option>
            {responsables.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Vista "Todos" — resumen gerencial */}
      {isManager && selectedResponsable === '__all__' && (
        <>
          <ResumenEquipoCard
            resumen={resumenEquipo}
            onSelectResponsable={(id) => setSelectedResponsable(id)}
          />
          <PendientesAgrupadosCard
            pendientes={pendientesAnteriores}
            onMoverAHoy={moverAHoy}
            onQuitar={quitarDeHoy}
            loading={loading}
          />
        </>
      )}

      {/* Vista con responsable seleccionado */}
      {selectedResponsable !== '__all__' && (
        <>
          {/* Pendientes de días anteriores */}
          {pendientesAnteriores.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-amber-700 text-base">
                  <AlertTriangle className="h-4 w-4" />
                  Pendientes de días anteriores{selectedNombre ? ` de ${selectedNombre}` : ''} ({pendientesAnteriores.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendientesAnteriores.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-amber-600 font-mono whitespace-nowrap">{item.fechaKey}</span>
                        <PresupuestoRow p={item.presupuesto} />
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-amber-700 hover:text-amber-900 hover:bg-amber-100" onClick={() => moverAHoy(item)} disabled={loading === item.id} title="Mover a hoy">
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => quitarDeHoy(item.id)} disabled={loading === item.id} title="Quitar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* A terminar hoy */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4 text-[#00ADEF]" />
                A terminar hoy{selectedNombre ? ` de ${selectedNombre}` : ''}
                {total > 0 && (
                  <Badge variant="outline" className="ml-1 text-xs">{total}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trabajoHoy.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  No hay presupuestos en la lista de hoy.{' '}
                  {isManager && selectedNombre
                    ? `Agregá desde la tabla de abajo para ${selectedNombre}.`
                    : 'Agregá desde la tabla de abajo.'}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {trabajoHoy.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                        item.completado
                          ? 'border-green-200 bg-green-50/50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                            item.completado
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'border-slate-300 hover:border-[#00ADEF]'
                          }`}
                          onClick={() => toggleCompletado(item.id, !item.completado)}
                          disabled={loading === item.id}
                        >
                          {item.completado && <Check className="h-3 w-3" />}
                        </button>
                        <PresupuestoRow p={item.presupuesto} strikethrough={item.completado} />
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 ml-2">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600" onClick={() => moverOrden(item.id, 'up')} disabled={idx === 0} title="Subir">
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600" onClick={() => moverOrden(item.id, 'down')} disabled={idx === trabajoHoy.length - 1} title="Bajar">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => quitarDeHoy(item.id)} disabled={loading === item.id} title="Quitar de hoy">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Presupuestos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-slate-500" />
              {isManager ? 'Presupuestos del equipo' : 'Mis presupuestos'}
              <Badge variant="outline" className="ml-1 text-xs">{presupuestosFiltrados.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Buscar..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="h-8 w-48 pl-8 text-sm"
                />
              </div>
              <DropdownMenu open={estadosOpen} onOpenChange={setEstadosOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-8 w-44 justify-between font-normal text-sm">
                    <span className="truncate">
                      {filtroEstados.length === 0
                        ? 'Todos los estados'
                        : filtroEstados.length === 1
                          ? ESTADO_LABELS[filtroEstados[0]]
                          : `${filtroEstados.length} estados`}
                    </span>
                    <ChevronDown className="ml-2 h-3.5 w-3.5 opacity-50 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-52">
                  {TODOS_ESTADOS.map((e) => (
                    <DropdownMenuCheckboxItem
                      key={e}
                      checked={filtroEstados.includes(e)}
                      onCheckedChange={(checked) =>
                        setFiltroEstados(prev => checked ? [...prev, e] : prev.filter(x => x !== e))
                      }
                      onSelect={(ev) => ev.preventDefault()}
                    >
                      {ESTADO_LABELS[e]}
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-8 gap-1 text-sm font-normal">
                    Rubros {filtroRubros.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{filtroRubros.length}</Badge>}
                    <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-44">
                  {(['MADERA', 'MELAMINA', 'ALUMINIO'] as const).map((r) => (
                    <DropdownMenuCheckboxItem
                      key={r}
                      checked={filtroRubros.includes(r)}
                      onCheckedChange={(checked) => setFiltroRubros(prev => checked ? [...prev, r] : prev.filter(x => x !== r))}
                      onSelect={(ev) => ev.preventDefault()}
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
              {isManager && selectedResponsable === '__all__' && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setSelectedResponsable(e.target.value);
                  }}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700"
                >
                  <option value="">Filtrar responsable...</option>
                  {responsables.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {presupuestosFiltrados.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              No hay presupuestos para mostrar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                    <th className="pb-2 pr-3 font-medium">Nro</th>
                    <th className="pb-2 pr-3 font-medium">Nombre</th>
                    <th className="pb-2 pr-3 font-medium">Cliente</th>
                    <th className="pb-2 pr-3 font-medium hidden md:table-cell">Obra</th>
                    {(isManager || perfil !== 'vendedor') && <th className="pb-2 pr-3 font-medium">Responsable</th>}
                    <th className="pb-2 pr-3 font-medium">Estado</th>
                    <th className="pb-2 pr-3 font-medium hidden lg:table-cell">Antigüedad</th>
                    <th className="pb-2 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {presupuestosFiltrados.slice(0, 50).map((p) => {
                    const dias = Math.floor((Date.now() - new Date(p.fechaCreacion).getTime()) / 86400000);
                    const targetUser = isManager
                      ? selectedResponsable !== '__all__'
                        ? selectedResponsable
                        : p.responsable?.id
                      : undefined;
                    return (
                      <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-2 pr-3">
                          <Link href={`/presupuestos/${p.id}`} className="font-medium text-slate-700 hover:text-[#00ADEF]">
                            #{p.numero}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 max-w-[180px] truncate text-slate-600">
                          {p.nombrePresupuesto ?? 'Sin nombre'}
                        </td>
                        <td className="py-2 pr-3 max-w-[150px] truncate text-slate-500">
                          {p.cliente?.razonSocial ?? '-'}
                        </td>
                        <td className="py-2 pr-3 max-w-[120px] truncate text-slate-500 hidden md:table-cell">
                          {p.obra?.nombre ?? '-'}
                        </td>
                        {(isManager || perfil !== 'vendedor') && (
                          <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">
                            {p.responsable?.nombre ?? '-'}
                          </td>
                        )}
                        <td className="py-2 pr-3">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${ESTADO_COLORS[p.estado] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}
                          >
                            {ESTADO_LABELS[p.estado] ?? p.estado}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 text-slate-400 text-xs whitespace-nowrap hidden lg:table-cell">
                          {dias}d
                        </td>
                        <td className="py-2 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {selectedResponsable !== '__all__' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[#00ADEF] hover:text-[#0090c8] hover:bg-[#00ADEF]/10"
                                onClick={() => agregarAHoy(p.id, targetUser)}
                                disabled={loading === p.id}
                                title={isManager && selectedNombre ? `Agregar a hoy de ${selectedNombre}` : 'Agregar a hoy'}
                              >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                <span className="text-xs">Hoy</span>
                              </Button>
                            )}
                            {selectedResponsable === '__all__' && targetUser && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[#00ADEF] hover:text-[#0090c8] hover:bg-[#00ADEF]/10"
                                onClick={() => agregarAHoy(p.id, targetUser)}
                                disabled={loading === p.id}
                                title={`Agregar a hoy de ${p.responsable?.nombre ?? 'responsable'}`}
                              >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                <span className="text-xs">Hoy</span>
                              </Button>
                            )}
                            <Link href={`/presupuestos/${p.id}`}>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600" title="Ver presupuesto">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {presupuestosFiltrados.length > 50 && (
                <p className="text-xs text-slate-400 text-center mt-3">
                  Mostrando 50 de {presupuestosFiltrados.length} presupuestos. Usá los filtros para reducir la lista.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2 ${
            toast.error ? 'bg-red-600' : 'bg-green-600'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ── Resumen del equipo ────────────────────────────────────────────────── */
function ResumenEquipoCard({
  resumen,
  onSelectResponsable,
}: {
  resumen: ResumenResponsable[];
  onSelectResponsable: (id: string) => void;
}) {
  if (resumen.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-[#00ADEF]" />
          Resumen por responsable
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="pb-2 pr-3 font-medium">Responsable</th>
                <th className="pb-2 pr-2 font-medium text-center">Abiertos</th>
                <th className="pb-2 pr-2 font-medium text-center">
                  <span className="text-red-600">Pend.</span>
                </th>
                <th className="pb-2 pr-2 font-medium text-center">
                  <span className="text-yellow-600">En proc.</span>
                </th>
                <th className="pb-2 pr-2 font-medium text-center">
                  <span className="text-purple-600">Fren.</span>
                </th>
                <th className="pb-2 pr-2 font-medium text-center">
                  <span className="text-amber-600">Final.</span>
                </th>
                <th className="pb-2 pr-2 font-medium text-center">
                  <span className="text-blue-600">P/enviar</span>
                </th>
                <th className="pb-2 pr-2 font-medium text-center">
                  <span className="text-sky-600">Enviados</span>
                </th>
                <th className="pb-2 pr-2 font-medium text-center">Hoy</th>
                <th className="pb-2 font-medium text-center">
                  <span className="text-green-600">Complet.</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer"
                  onClick={() => onSelectResponsable(r.id)}
                >
                  <td className="py-2 pr-3 font-medium text-[#00ADEF] hover:underline">{r.nombre}</td>
                  <td className="py-2 pr-2 text-center font-semibold">{r.abiertos}</td>
                  <CellCount n={r.pendientes} color="red" />
                  <CellCount n={r.enProceso} color="yellow" />
                  <CellCount n={r.frenados} color="purple" />
                  <CellCount n={r.finalizados} color="amber" />
                  <CellCount n={r.paraEnviar} color="blue" />
                  <CellCount n={r.enviados} color="sky" />
                  <td className="py-2 pr-2 text-center">{r.aTerminarHoy || '-'}</td>
                  <td className="py-2 text-center">
                    {r.aTerminarHoy > 0 ? (
                      <span className="text-green-600 font-medium">{r.completadosHoy}/{r.aTerminarHoy}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CellCount({ n, color }: { n: number; color: string }) {
  if (n === 0) return <td className="py-2 pr-2 text-center text-slate-300">-</td>;
  return (
    <td className={`py-2 pr-2 text-center font-medium text-${color}-600`}>{n}</td>
  );
}

/* ── Pendientes agrupados (vista "Todos") ──────────────────────────────── */
function PendientesAgrupadosCard({
  pendientes,
  onMoverAHoy,
  onQuitar,
  loading,
}: {
  pendientes: TrabajoDiaItem[];
  onMoverAHoy: (item: TrabajoDiaItem) => void;
  onQuitar: (id: string) => void;
  loading: string | null;
}) {
  if (pendientes.length === 0) return null;

  const byUser: Record<string, { nombre: string; items: TrabajoDiaItem[] }> = {};
  for (const p of pendientes) {
    const uid = p.userId;
    const nombre = p.user?.nombre ?? 'Desconocido';
    if (!byUser[uid]) byUser[uid] = { nombre, items: [] };
    byUser[uid].items.push(p);
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-700 text-base">
          <AlertTriangle className="h-4 w-4" />
          Pendientes de días anteriores ({pendientes.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(byUser).map(([uid, { nombre, items }]) => (
            <div key={uid}>
              <p className="text-xs font-semibold text-amber-800 mb-1.5">{nombre} ({items.length})</p>
              <div className="space-y-1.5">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-amber-600 font-mono whitespace-nowrap">{item.fechaKey}</span>
                      <PresupuestoRow p={item.presupuesto} />
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-amber-700 hover:text-amber-900 hover:bg-amber-100" onClick={() => onMoverAHoy(item)} disabled={loading === item.id} title="Mover a hoy">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => onQuitar(item.id)} disabled={loading === item.id} title="Quitar">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Fila de presupuesto ──────────────────────────────────────────────── */
function PresupuestoRow({
  p,
  strikethrough,
}: {
  p: PresupuestoBasico;
  strikethrough?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 min-w-0 ${strikethrough ? 'opacity-50' : ''}`}>
      <Link
        href={`/presupuestos/${p.id}`}
        className={`text-sm font-medium text-slate-700 hover:text-[#00ADEF] whitespace-nowrap ${
          strikethrough ? 'line-through' : ''
        }`}
      >
        #{p.numero}
      </Link>
      <span className={`text-sm text-slate-600 truncate max-w-[200px] ${strikethrough ? 'line-through' : ''}`}>
        {p.nombrePresupuesto ?? 'Sin nombre'}
      </span>
      <Badge
        variant="outline"
        className={`text-[10px] shrink-0 ${ESTADO_COLORS[p.estado] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}
      >
        {ESTADO_LABELS[p.estado] ?? p.estado}
      </Badge>
      {p.cliente && (
        <span className="text-xs text-slate-400 truncate max-w-[150px] hidden sm:inline">
          {p.cliente.razonSocial}
        </span>
      )}
      <span className="text-xs text-slate-400 truncate max-w-[120px] hidden sm:inline">
        · {p.obra?.nombre ?? 'Sin obra'}
      </span>
    </div>
  );
}
