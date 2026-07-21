'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Pencil, Check, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Props {
  presupuestoId: string;
  totalFinal: number;
  precioFinal: number | null;
  tasaIvaInicial: number;
  moneda?: string;
}

export function TotalesPresupuesto({ presupuestoId, totalFinal, precioFinal, tasaIvaInicial, moneda }: Props) {
  const fmtAmt = (n: number): string =>
    moneda === 'USD'
      ? `U$D ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : formatCurrency(n);

  const netoInicial = precioFinal != null && precioFinal > 0 ? precioFinal : totalFinal;
  const [neto, setNeto] = useState(String(netoInicial));
  const [editingNeto, setEditingNeto] = useState(false);
  const [tasa, setTasa] = useState(String(tasaIvaInicial));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const netoNum = parseFloat(neto) || 0;
  const tasaNum = parseFloat(tasa) || 0;
  const montoIva = netoNum * (tasaNum / 100);
  const total = tasaNum === 0 ? netoNum : netoNum + montoIva;

  const showSubtotalCalc = totalFinal > 0 && precioFinal != null && precioFinal > 0;

  const handleGuardar = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/presupuestos/${presupuestoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ precioFinal: netoNum > 0 ? netoNum : null, tasaIva: tasaNum, montoIva, totalConIva: total }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || 'Error desconocido');
      }
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
    setSaving(false);
  };

  return (
    <div className="flex justify-end">
      <div className="w-80 space-y-2">
        {showSubtotalCalc && (
          <div className="flex justify-between text-xs text-slate-400">
            <span>Subtotal calculado</span>
            <span>{fmtAmt(totalFinal)}</span>
          </div>
        )}

        <div className="flex justify-between text-sm items-center">
          <span className="text-slate-500">Neto</span>
          {editingNeto ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={neto}
                onChange={(e) => { setNeto(e.target.value); setDirty(true); }}
                className="w-32 h-7 text-xs"
                autoFocus
                placeholder="Ingresá el monto neto"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setEditingNeto(false);
                  if (e.key === 'Escape') { setNeto(String(netoInicial)); setEditingNeto(false); setDirty(false); }
                }}
              />
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingNeto(false)}>
                <Check className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="font-medium text-slate-700">{fmtAmt(netoNum)}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 text-slate-400 hover:text-slate-600"
                onClick={() => setEditingNeto(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-between text-sm items-center">
          <span className="text-slate-500">Tasa IVA</span>
          <Select value={tasa} onValueChange={(v) => { setTasa(v); setDirty(true); }}>
            <SelectTrigger className="w-28 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0% Exento</SelectItem>
              <SelectItem value="10.5">10,5%</SelectItem>
              <SelectItem value="21">21%</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {tasaNum > 0 && (
          <div className="flex justify-between text-sm text-slate-500">
            <span>IVA ({tasaNum}%)</span>
            <span>{fmtAmt(montoIva)}</span>
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between font-bold text-lg text-[#00ADEF]">
          <div className="flex items-center gap-2">
            <span>{tasaNum === 0 ? 'Total (exento)' : 'Total c/IVA'}</span>
            <Badge variant="outline" className="text-xs px-1.5 py-0 font-medium text-[#00ADEF] border-[#00ADEF]">
              {tasaNum === 0 ? 'Exento' : `IVA ${tasaNum}%`}
            </Badge>
          </div>
          <span>{fmtAmt(total)}</span>
        </div>

        {error && (
          <p className="text-xs text-red-500 text-right">Error: {error}</p>
        )}

        {dirty && (
          <div className="flex justify-end pt-1">
            <Button size="sm" className="bg-[#00ADEF] hover:bg-[#0089C7]" onClick={handleGuardar} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Guardar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
