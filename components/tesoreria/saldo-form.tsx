'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

type Registro = { id: string; fecha: string; saldo: number; nota: string | null; creadoPor: string };

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

export function SaldoForm({ historial }: { historial: Registro[] }) {
  const router = useRouter();
  const hoy = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(hoy);
  const [saldo, setSaldo] = useState('');
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!fecha || !saldo) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/cashflow/saldo-caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, saldo: Number(saldo.replace(/\D/g, '')), nota: nota || null }),
      });
      if (res.ok) {
        router.refresh();
        setSaldo('');
        setNota('');
      } else {
        setError('Error al guardar. Intentá de nuevo.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={guardar} className="rounded-lg border border-slate-200 bg-white p-6 space-y-4 max-w-md">
        <h3 className="font-semibold text-slate-800">Registrar saldo</h3>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00ADEF]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Saldo líquido disponible <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={saldo}
            onChange={(e) => setSaldo(e.target.value)}
            placeholder="0"
            min={0}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00ADEF]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nota (opcional)</label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#00ADEF]"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={!saldo || saving} className="w-full">
          {saving ? 'Guardando…' : 'Registrar saldo'}
        </Button>
      </form>

      <div>
        <h3 className="font-semibold text-slate-800 mb-3">Historial reciente</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium">
              <tr>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-left">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historial.map((r, i) => (
                <tr key={r.id} className={i === 0 ? 'bg-sky-50' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3 text-slate-700">
                    {new Date(r.fecha).toLocaleDateString('es-AR')}
                    {i === 0 && <span className="ml-2 text-xs text-[#00ADEF] font-medium">actual</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(r.saldo)}</td>
                  <td className="px-4 py-3 text-slate-500">{r.nota ?? '—'}</td>
                </tr>
              ))}
              {historial.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">Sin registros aún.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
