'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { RefreshCw, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Props {
  presupuestoId: string;
}

export function ActualizarPreciosBtn({ presupuestoId }: Props) {
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<{ subtotal: number; totalFinal: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const actualizar = async () => {
    setCargando(true);
    const res = await fetch(`/api/presupuestos/${presupuestoId}/actualizar-precios`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setResultado(data);
      setOpen(false);
      setToast(`Precios actualizados. Nuevo total: ${formatCurrency(data.totalFinal)}`);
      setTimeout(() => setToast(null), 4000);
    }
    setCargando(false);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 text-[#00ADEF] border-sky-200 hover:bg-sky-50"
        onClick={() => setOpen(true)}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Actualizar precios
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Actualizar precios</DialogTitle>
            <DialogDescription>
              Se actualizarán los precios de todos los ítems y productos cotizados con los valores actuales del catálogo.
              {resultado && (
                <span className="block mt-2 font-medium text-slate-700">
                  Nuevo total: {formatCurrency(resultado.totalFinal)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={cargando}>Cancelar</Button>
            <Button onClick={actualizar} disabled={cargando} className="gap-1.5">
              {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </>
  );
}
