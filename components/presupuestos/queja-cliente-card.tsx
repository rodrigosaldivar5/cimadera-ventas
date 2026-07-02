'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

const MOTIVOS: Record<string, string> = {
  COTIZACION_MAL_HECHA: 'Cotización mal hecha',
  TIEMPO_COTIZACION: 'Tiempos de cotización',
  MALA_PREDISPOSICION: 'Mala predisposición',
  ERROR_DATOS: 'Error en datos / medidas / alcance',
  OTRO: 'Otro',
};

interface Props {
  presupuestoId: string;
  tieneQuejaCliente: boolean;
  motivoQuejaCliente: string | null;
  comentarioQuejaCliente: string | null;
  fechaQuejaCliente: string | null;
  quejaRegistradaPorNombre: string | null;
}

export function QuejaClienteCard(props: Props) {
  const [tieneQueja, setTieneQueja] = useState(props.tieneQuejaCliente);
  const [motivo, setMotivo] = useState(props.motivoQuejaCliente ?? '');
  const [comentario, setComentario] = useState(props.comentarioQuejaCliente ?? '');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error: boolean } | null>(null);
  const [savedMeta, setSavedMeta] = useState({
    tieneQueja: props.tieneQuejaCliente,
    motivo: props.motivoQuejaCliente ?? '',
    fecha: props.fechaQuejaCliente,
    registradoPor: props.quejaRegistradaPorNombre,
  });

  const handleToggle = (val: boolean) => {
    setTieneQueja(val);
    if (!val) setMotivo('');
  };

  const handleGuardar = async () => {
    if (tieneQueja && !motivo) {
      setToast({ msg: 'El motivo es obligatorio', error: true });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/presupuestos/${props.presupuestoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tieneQuejaCliente: tieneQueja,
          motivoQuejaCliente: tieneQueja ? motivo : null,
          comentarioQuejaCliente: tieneQueja ? comentario : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Error al guardar');
      }
      const updated = await res.json();
      setSavedMeta({
        tieneQueja: updated.tieneQuejaCliente,
        motivo: updated.motivoQuejaCliente ?? '',
        fecha: updated.fechaQuejaCliente,
        registradoPor: updated.quejaRegistradaPorNombre,
      });
      setToast({ msg: 'Guardado', error: false });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : 'Error al guardar', error: true });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            <h3 className="font-semibold text-slate-700">Queja del cliente</h3>
          </div>
          <span className="text-xs text-slate-400">Dato interno. No modifica el presupuesto ni aparece en el PDF.</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Switch id="tiene-queja" checked={tieneQueja} onCheckedChange={handleToggle} />
          <Label htmlFor="tiene-queja" className="text-sm cursor-pointer">El cliente registró una queja</Label>
          {savedMeta.tieneQueja && (
            <span className="ml-auto text-xs bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 font-semibold">
              Con queja
            </span>
          )}
        </div>

        {tieneQueja && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Motivo *</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Seleccioná un motivo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MOTIVOS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Comentario (opcional)</Label>
              <Textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Descripción del problema…"
                rows={2}
                className="bg-white resize-none"
              />
            </div>
          </div>
        )}

        {savedMeta.tieneQueja && savedMeta.fecha && (
          <div className="text-xs text-slate-500 border-t border-amber-200 pt-3">
            Registrado por <span className="font-medium">{savedMeta.registradoPor ?? '—'}</span> el{' '}
            {new Date(savedMeta.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            {savedMeta.motivo && (
              <> — <span className="font-medium">{MOTIVOS[savedMeta.motivo] ?? savedMeta.motivo}</span></>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleGuardar}
            disabled={saving}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            {saving ? 'Guardando…' : 'Guardar queja'}
          </Button>
          {toast && (
            <span className={`text-xs font-medium ${toast.error ? 'text-red-600' : 'text-green-600'}`}>
              {toast.msg}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
