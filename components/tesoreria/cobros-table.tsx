'use client';

import { useState } from 'react';
import { ProbabilidadBadge } from './probabilidad-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Pencil } from 'lucide-react';

type Cuenta = {
  id: string;
  saldoActualizado: number | string;
  proximoCobro: string | null;
  probabilidadCobro: string;
  cliente: { razonSocial: string };
  obra: { nombre: string } | null;
};

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

function fmtFecha(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR');
}

export function CobrosTable({ cuentasIniciales }: { cuentasIniciales: Cuenta[] }) {
  const [cuentas, setCuentas] = useState(cuentasIniciales);
  const [editando, setEditando] = useState<Cuenta | null>(null);
  const [proximoCobro, setProximoCobro] = useState('');
  const [probabilidad, setProbabilidad] = useState<'ALTA' | 'MEDIA' | 'BAJA'>('MEDIA');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);

  function abrirModal(cuenta: Cuenta) {
    setEditando(cuenta);
    setProximoCobro(cuenta.proximoCobro ? cuenta.proximoCobro.slice(0, 10) : '');
    setProbabilidad((cuenta.probabilidadCobro as 'ALTA' | 'MEDIA' | 'BAJA') ?? 'MEDIA');
    setNota('');
  }

  async function guardar() {
    if (!editando || !proximoCobro) return;
    const hoy = new Date().toISOString().slice(0, 10);
    if (proximoCobro < hoy) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/cuentas-corrientes/${editando.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proximoCobro, probabilidadCobro: probabilidad, observaciones: nota || undefined }),
      });
      if (res.ok) {
        setCuentas((prev) =>
          prev.map((c) =>
            c.id === editando.id ? { ...c, proximoCobro, probabilidadCobro: probabilidad } : c
          )
        );
        setEditando(null);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium">
            <tr>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Obra</th>
              <th className="px-4 py-3 text-right">Saldo pendiente</th>
              <th className="px-4 py-3 text-center">Próximo cobro</th>
              <th className="px-4 py-3 text-center">Probabilidad</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cuentas.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{c.cliente.razonSocial}</td>
                <td className="px-4 py-3 text-slate-500">{c.obra?.nombre ?? '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">
                  {fmt(Number(c.saldoActualizado))}
                </td>
                <td className="px-4 py-3 text-center text-slate-600">
                  {fmtFecha(c.proximoCobro)}
                </td>
                <td className="px-4 py-3 text-center">
                  <ProbabilidadBadge valor={(c.probabilidadCobro as 'ALTA' | 'MEDIA' | 'BAJA') ?? 'MEDIA'} />
                </td>
                <td className="px-4 py-3 text-center">
                  <Button size="sm" variant="ghost" onClick={() => abrirModal(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {cuentas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No hay cuentas con saldo pendiente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar cobro proyectado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Próximo cobro estimado <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={proximoCobro}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setProximoCobro(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Probabilidad de cobro <span className="text-red-500">*</span>
              </label>
              <select
                value={probabilidad}
                onChange={(e) => setProbabilidad(e.target.value as 'ALTA' | 'MEDIA' | 'BAJA')}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Media</option>
                <option value="BAJA">Baja</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nota interna (opcional)
              </label>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value.slice(0, 200))}
                rows={3}
                maxLength={200}
                placeholder="Observación sobre este cobro..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              />
              <p className="text-xs text-slate-400 text-right">{nota.length}/200</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={guardar} disabled={!proximoCobro || saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
