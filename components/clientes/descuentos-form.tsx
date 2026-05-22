'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save } from 'lucide-react';
import { TIPO_CLIENTE_LABEL, type TipoCliente } from '@/lib/enums';

interface DescuentoRow {
  id: string;
  tipoCliente: string;
  descuento: number;
  descripcion: string | null;
}

export function DescuentosForm({ descuentos: inicial }: { descuentos: DescuentoRow[] }) {
  const [rows, setRows] = useState(inicial);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const update = (tipoCliente: string, field: 'descuento' | 'descripcion', value: string | number) => {
    setRows((prev) =>
      prev.map((r) => (r.tipoCliente === tipoCliente ? { ...r, [field]: value } : r))
    );
  };

  const save = async (row: DescuentoRow) => {
    setSaving(row.tipoCliente);
    await fetch('/api/clientes/descuentos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoCliente: row.tipoCliente, descuento: row.descuento, descripcion: row.descripcion }),
    });
    setSaving(null);
    setSaved(row.tipoCliente);
    setTimeout(() => setSaved(null), 2000);
  };

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.tipoCliente} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800">
              {TIPO_CLIENTE_LABEL[row.tipoCliente as TipoCliente]}
            </span>
            {saved === row.tipoCliente && (
              <span className="text-xs text-green-600 font-medium">Guardado</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Descuento automático (%)</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={row.descuento}
                  onChange={(e) => update(row.tipoCliente, 'descuento', Number(e.target.value))}
                  className="w-28"
                />
                <span className="text-sm text-slate-400">%</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Descripción</label>
              <Input
                value={row.descripcion ?? ''}
                onChange={(e) => update(row.tipoCliente, 'descripcion', e.target.value)}
                placeholder="Nota opcional..."
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => save(row)}
              disabled={saving === row.tipoCliente}
              className="bg-sky-500 hover:bg-sky-600"
            >
              {saving === row.tipoCliente
                ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                : <Save className="mr-2 h-3.5 w-3.5" />}
              Guardar
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
