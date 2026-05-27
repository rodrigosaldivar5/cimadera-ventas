'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';

type Costo = {
  id: string;
  nombre: string;
  categoria: string;
  monto: number;
  observacion: string | null;
};

const CATEGORIAS = ['NOMINA', 'INFRAESTRUCTURA', 'SERVICIOS', 'OTROS'] as const;
const catLabel: Record<string, string> = {
  NOMINA: 'Nómina', INFRAESTRUCTURA: 'Infraestructura', SERVICIOS: 'Servicios', OTROS: 'Otros',
};

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

type FilaEditado = { nombre: string; categoria: string; monto: string; observacion: string };

export function CostosFijosTable({ costosIniciales }: { costosIniciales: Costo[] }) {
  const [costos, setCostos] = useState(costosIniciales);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editData, setEditData] = useState<FilaEditado>({ nombre: '', categoria: 'NOMINA', monto: '', observacion: '' });
  const [agregando, setAgregando] = useState(false);
  const [nuevo, setNuevo] = useState<FilaEditado>({ nombre: '', categoria: 'NOMINA', monto: '', observacion: '' });
  const [saving, setSaving] = useState(false);

  function iniciarEdicion(c: Costo) {
    setEditandoId(c.id);
    setEditData({ nombre: c.nombre, categoria: c.categoria, monto: String(c.monto), observacion: c.observacion ?? '' });
  }

  async function guardarEdicion(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/cashflow/costos-fijos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editData, monto: Number(editData.monto) }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCostos((prev) => prev.map((c) => (c.id === id ? updated : c)));
        setEditandoId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Desactivar este costo fijo?')) return;
    const res = await fetch(`/api/cashflow/costos-fijos/${id}`, { method: 'DELETE' });
    if (res.ok) setCostos((prev) => prev.filter((c) => c.id !== id));
  }

  async function crearNuevo() {
    if (!nuevo.nombre || !nuevo.monto) return;
    setSaving(true);
    try {
      const res = await fetch('/api/cashflow/costos-fijos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nuevo, monto: Number(nuevo.monto) }),
      });
      if (res.ok) {
        const created = await res.json();
        setCostos((prev) => [...prev, created]);
        setAgregando(false);
        setNuevo({ nombre: '', categoria: 'NOMINA', monto: '', observacion: '' });
      }
    } finally {
      setSaving(false);
    }
  }

  const total = costos.reduce((s, c) => s + c.monto, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{costos.length} costos activos</p>
        <Button size="sm" onClick={() => setAgregando(true)} disabled={agregando}>
          <Plus className="h-4 w-4 mr-1" /> Agregar
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Categoría</th>
              <th className="px-4 py-3 text-right">Monto mensual</th>
              <th className="px-4 py-3 text-left">Observación</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {agregando && (
              <tr className="bg-sky-50">
                <td className="px-4 py-2">
                  <input
                    autoFocus
                    value={nuevo.nombre}
                    onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                    placeholder="Nombre"
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={nuevo.categoria}
                    onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })}
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                  >
                    {CATEGORIAS.map((c) => <option key={c} value={c}>{catLabel[c]}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    value={nuevo.monto}
                    onChange={(e) => setNuevo({ ...nuevo, monto: e.target.value })}
                    placeholder="0"
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-right"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={nuevo.observacion}
                    onChange={(e) => setNuevo({ ...nuevo, observacion: e.target.value })}
                    placeholder="Opcional"
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-4 py-2 flex gap-1">
                  <Button size="sm" onClick={crearNuevo} disabled={saving}><Check className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setAgregando(false)}><X className="h-4 w-4" /></Button>
                </td>
              </tr>
            )}
            {costos.map((c) => {
              const esEditando = editandoId === c.id;
              return (
                <tr key={c.id} className={esEditando ? 'bg-sky-50' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3">
                    {esEditando
                      ? <input value={editData.nombre} onChange={(e) => setEditData({ ...editData, nombre: e.target.value })} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                      : <span className="font-medium text-slate-800">{c.nombre}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {esEditando
                      ? <select value={editData.categoria} onChange={(e) => setEditData({ ...editData, categoria: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm">
                          {CATEGORIAS.map((cat) => <option key={cat} value={cat}>{catLabel[cat]}</option>)}
                        </select>
                      : <span className="text-slate-500">{catLabel[c.categoria] ?? c.categoria}</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {esEditando
                      ? <input type="number" value={editData.monto} onChange={(e) => setEditData({ ...editData, monto: e.target.value })} className="w-32 rounded border border-slate-300 px-2 py-1 text-sm text-right" />
                      : fmt(c.monto)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {esEditando
                      ? <input value={editData.observacion} onChange={(e) => setEditData({ ...editData, observacion: e.target.value })} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                      : c.observacion ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {esEditando
                      ? <div className="flex gap-1">
                          <Button size="sm" onClick={() => guardarEdicion(c.id)} disabled={saving}><Check className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)}><X className="h-4 w-4" /></Button>
                        </div>
                      : <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => iniciarEdicion(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => eliminar(c.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50 border-t border-slate-200">
            <tr>
              <td colSpan={2} className="px-4 py-3 text-right text-slate-600 font-medium">Total mensual</td>
              <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(total)}</td>
              <td colSpan={2} className="px-4 py-3 text-slate-400 text-sm">≈ {fmt(total / 4.33)} / semana</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
