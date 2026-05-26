'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Trash2, Loader2 } from 'lucide-react';

interface Props {
  presupuestoId: string;
  numero: number;
  clienteNombre: string;
  redirectOnDelete?: boolean;
  onDeleted?: () => void;
}

export function EliminarPresupuestoBtn({
  presupuestoId,
  numero,
  clienteNombre,
  redirectOnDelete = false,
  onDeleted,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error: boolean } | null>(null);

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 4000);
  };

  const eliminar = async () => {
    setCargando(true);
    try {
      const res = await fetch(`/api/presupuestos/${presupuestoId}`, { method: 'DELETE' });
      if (res.status === 403) {
        showToast('No tenés permiso para realizar esta acción', true);
        setOpen(false);
        return;
      }
      if (!res.ok) {
        showToast('Error al eliminar el presupuesto', true);
        setOpen(false);
        return;
      }
      setOpen(false);
      showToast('Presupuesto eliminado');
      if (redirectOnDelete) {
        setTimeout(() => router.push('/presupuestos'), 1000);
      } else {
        onDeleted?.();
        router.refresh();
      }
    } catch {
      showToast('Error al eliminar el presupuesto', true);
      setOpen(false);
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-red-500 hover:text-red-700 hover:bg-red-50"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar presupuesto?</DialogTitle>
            <DialogDescription>
              Estás por eliminar el <strong>Presupuesto N° {numero}</strong> de{' '}
              <strong>{clienteNombre}</strong>. Esta acción no se puede deshacer. Se eliminarán
              también todos los archivos adjuntos y líneas asociadas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={cargando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={eliminar} disabled={cargando} className="gap-1.5">
              {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2 ${toast.error ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
