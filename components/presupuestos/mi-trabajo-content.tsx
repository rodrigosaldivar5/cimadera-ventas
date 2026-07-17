'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Plus,
  Trash2,
  Check,
  Undo2,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  presupuestoId: string;
  fechaKey: string;
  orden: number;
  completado: boolean;
  completadoAt: string | null;
  nota: string | null;
  presupuesto: PresupuestoBasico;
};

type MisPresupuestosItem = PresupuestoBasico & {
  responsable: { nombre: string } | null;
  fechaCreacion: string;
};

interface Props {
  perfil: PerfilMiTrabajo;
  misPresupuestos: MisPresupuestosItem[];
  trabajoHoyInicial: TrabajoDiaItem[];
  pendientesAnterioresInicial: TrabajoDiaItem[];
  fechaKey: string;
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

export function MiTrabajoContent({
  perfil,
  misPresupuestos,
  trabajoHoyInicial,
  pendientesAnterioresInicial,
  fechaKey,
}: Props) {
  const [trabajoHoy, setTrabajoHoy] = useState<TrabajoDiaItem[]>(trabajoHoyInicial);
  const [pendientesAnteriores, setPendientesAnteriores] = useState<TrabajoDiaItem[]>(pendientesAnterioresInicial);
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3000);
  };

  const agregarAHoy = useCallback(async (presupuestoId: string) => {
    if (trabajoHoy.some((t) => t.presupuestoId === presupuestoId)) {
      showToast('Ya está en la lista de hoy', true);
      return;
    }
    setLoading(presupuestoId);
    try {
      const res = await fetch('/api/presupuestos/mi-trabajo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presupuestoId }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error ?? 'Error al agregar', true);
        return;
      }
      const item = await res.json();
      setTrabajoHoy((prev) => [...prev, item]);
      showToast('Agregado a hoy');
    } catch {
      showToast('Error de conexión', true);
    } finally {
      setLoading(null);
    }
  }, [trabajoHoy]);

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
      const res = await fetch('/api/presupuestos/mi-trabajo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presupuestoId: item.presupuestoId }),
      });
      if (res.ok) {
        const newItem = await res.json();
        setPendientesAnteriores((prev) => prev.filter((t) => t.id !== item.id));
        setTrabajoHoy((prev) => [...prev, newItem]);
        showToast('Movido a hoy');
      }
    } catch {
      showToast('Error de conexión', true);
    } finally {
      setLoading(null);
    }
  }, []);

  const idsEnHoy = new Set(trabajoHoy.map((t) => t.presupuestoId));
  const presupuestosFiltrados = misPresupuestos.filter((p) => !idsEnHoy.has(p.id));

  const completados = trabajoHoy.filter((t) => t.completado).length;
  const total = trabajoHoy.length;

  const perfilLabel = perfil === 'vendedor' ? 'Vendedor' : perfil === 'gerencia' ? 'Gerencia' : 'Dirección';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-[#00ADEF]" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mi trabajo</h1>
            <p className="text-sm text-slate-500">
              Perfil: {perfilLabel} · {fechaKey}
            </p>
          </div>
        </div>
        {total > 0 && (
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-green-600">{completados}</span>
            <span className="text-slate-400"> / {total}</span>
            <span className="ml-1">completados</span>
          </div>
        )}
      </div>

      {/* Pendientes de días anteriores */}
      {pendientesAnteriores.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-700 text-base">
              <AlertTriangle className="h-4 w-4" />
              Pendientes de días anteriores ({pendientesAnteriores.length})
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                      onClick={() => moverAHoy(item)}
                      disabled={loading === item.id}
                      title="Mover a hoy"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => quitarDeHoy(item.id)}
                      disabled={loading === item.id}
                      title="Quitar"
                    >
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
            A terminar hoy
            {total > 0 && (
              <Badge variant="outline" className="ml-1 text-xs">
                {total}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trabajoHoy.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              No hay presupuestos en la lista de hoy. Agregá desde &quot;Mis presupuestos&quot; abajo.
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
                      onClick={() => moverOrden(item.id, 'up')}
                      disabled={idx === 0}
                      title="Subir"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
                      onClick={() => moverOrden(item.id, 'down')}
                      disabled={idx === trabajoHoy.length - 1}
                      title="Bajar"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => quitarDeHoy(item.id)}
                      disabled={loading === item.id}
                      title="Quitar de hoy"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mis presupuestos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-slate-500" />
            Mis presupuestos
            <Badge variant="outline" className="ml-1 text-xs">
              {presupuestosFiltrados.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {presupuestosFiltrados.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">
              Todos tus presupuestos están en la lista de hoy.
            </p>
          ) : (
            <div className="space-y-1">
              {presupuestosFiltrados.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <PresupuestoRow
                      p={p}
                      showResponsable={perfil !== 'vendedor'}
                      responsableNombre={p.responsable?.nombre}
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[#00ADEF] hover:text-[#0090c8] hover:bg-[#00ADEF]/10"
                      onClick={() => agregarAHoy(p.id)}
                      disabled={loading === p.id}
                      title="Agregar a hoy"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      <span className="text-xs">Hoy</span>
                    </Button>
                    <Link href={`/presupuestos/${p.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
                        title="Ver presupuesto"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
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

function PresupuestoRow({
  p,
  strikethrough,
  showResponsable,
  responsableNombre,
}: {
  p: PresupuestoBasico;
  strikethrough?: boolean;
  showResponsable?: boolean;
  responsableNombre?: string | null;
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
      {showResponsable && responsableNombre && (
        <span className="text-xs text-slate-400 truncate max-w-[120px] hidden md:inline">
          · {responsableNombre}
        </span>
      )}
    </div>
  );
}
