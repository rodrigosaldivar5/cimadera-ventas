'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Check, Pencil, Paperclip, X, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Props {
  presupuestoId: string;
  precioFinalInicial: number | null;
  archivoAdjuntoInicial: string | null;
  archivoNombreInicial: string | null;
}

export function DocumentacionPresupuesto({ presupuestoId, precioFinalInicial, archivoAdjuntoInicial, archivoNombreInicial }: Props) {
  const [precioFinal, setPrecioFinal] = useState<number | null>(precioFinalInicial);
  const [editandoPrecio, setEditandoPrecio] = useState(false);
  const [inputPrecio, setInputPrecio] = useState(precioFinalInicial != null ? String(precioFinalInicial) : '');
  const [guardandoPrecio, setGuardandoPrecio] = useState(false);

  const [archivoAdjunto, setArchivoAdjunto] = useState<string | null>(archivoAdjuntoInicial);
  const [archivoNombre, setArchivoNombre] = useState<string | null>(archivoNombreInicial);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);

  const guardarPrecio = async () => {
    setGuardandoPrecio(true);
    const valor = inputPrecio.trim() === '' ? null : Number(inputPrecio);
    await fetch(`/api/presupuestos/${presupuestoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ precioFinal: valor }),
    });
    setPrecioFinal(valor);
    setEditandoPrecio(false);
    setGuardandoPrecio(false);
  };

  const subirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoArchivo(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/presupuestos/${presupuestoId}/adjunto`, { method: 'POST', body: fd });
    const data = await res.json();
    setArchivoAdjunto(data.url);
    setArchivoNombre(data.nombre);
    setSubiendoArchivo(false);
    e.target.value = '';
  };

  const eliminarArchivo = async () => {
    await fetch(`/api/presupuestos/${presupuestoId}/adjunto`, { method: 'DELETE' });
    setArchivoAdjunto(null);
    setArchivoNombre(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Documentación del presupuesto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* PARTE A: Precio final */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Precio final ($)</p>
          {editandoPrecio ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={inputPrecio}
                onChange={(e) => setInputPrecio(e.target.value)}
                className="w-48"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') guardarPrecio();
                  if (e.key === 'Escape') setEditandoPrecio(false);
                }}
              />
              <Button size="sm" onClick={guardarPrecio} disabled={guardandoPrecio}>
                {guardandoPrecio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditandoPrecio(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-slate-800">
                {precioFinal != null ? (
                  formatCurrency(precioFinal)
                ) : (
                  <span className="text-slate-400 text-sm font-normal">No definido</span>
                )}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-slate-500 hover:text-slate-700"
                onClick={() => {
                  setInputPrecio(precioFinal != null ? String(precioFinal) : '');
                  setEditandoPrecio(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {precioFinal != null && (
            <p className="text-xs text-slate-400">
              Este precio puede diferir del calculado si se usó software externo.
            </p>
          )}
        </div>

        <Separator />

        {/* PARTE B: Adjunto */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Presupuesto externo adjunto</p>
          {archivoAdjunto ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-slate-50">
              <Paperclip className="h-4 w-4 text-sky-500 shrink-0" />
              <a
                href={archivoAdjunto}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-sky-600 hover:underline flex-1 truncate"
              >
                {archivoNombre ?? 'Archivo adjunto'}
              </a>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-400 hover:text-red-600 h-7 w-7 p-0"
                onClick={eliminarArchivo}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <label className="inline-flex cursor-pointer">
              <span className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">
                {subiendoArchivo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
                {subiendoArchivo ? 'Subiendo...' : 'Adjuntar archivo'}
              </span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                className="sr-only"
                onChange={subirArchivo}
                disabled={subiendoArchivo}
              />
            </label>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
