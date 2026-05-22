'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Edit, Download, RefreshCw } from 'lucide-react';
import { ESTADO_PRESUPUESTO, type EstadoPresupuesto } from '@/lib/enums';
import Link from 'next/link';
import { generarPresupuestoPDF } from '@/lib/pdf/generar-presupuesto';

const estadoLabel: Record<EstadoPresupuesto, string> = {
  BORRADOR: 'Borrador', ENVIADO: 'Enviado', APROBADO: 'Aprobado', RECHAZADO: 'Rechazado', VENCIDO: 'Vencido',
};

type PresupuestoParaPDF = Parameters<typeof generarPresupuestoPDF>[0];

interface Props {
  presupuesto: { id: string; estado: EstadoPresupuesto; numero: number };
  presupuestoPDF?: PresupuestoParaPDF;
}

export function PresupuestoAcciones({ presupuesto, presupuestoPDF }: Props) {
  const router = useRouter();
  const [estadoDialog, setEstadoDialog] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState<EstadoPresupuesto>(presupuesto.estado);
  const [isLoading, setIsLoading] = useState(false);

  const cambiarEstado = async () => {
    setIsLoading(true);
    await fetch(`/api/presupuestos/${presupuesto.id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado }),
    });
    setIsLoading(false);
    setEstadoDialog(false);
    router.refresh();
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/presupuestos/${presupuesto.id}/editar`}>
          <Edit className="mr-1.5 h-4 w-4" /> Editar
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => presupuestoPDF ? generarPresupuestoPDF(presupuestoPDF) : window.print()}
      >
        <Download className="mr-1.5 h-4 w-4" /> Exportar PDF
      </Button>
      <Button size="sm" onClick={() => setEstadoDialog(true)} className="bg-sky-500 hover:bg-sky-600">
        <RefreshCw className="mr-1.5 h-4 w-4" /> Cambiar estado
      </Button>

      <Dialog open={estadoDialog} onOpenChange={setEstadoDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar estado del presupuesto #{presupuesto.numero}</DialogTitle>
          </DialogHeader>
          <Select value={nuevoEstado} onValueChange={(v) => setNuevoEstado(v as EstadoPresupuesto)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(ESTADO_PRESUPUESTO).map((e) => (
                <SelectItem key={e} value={e}>{estadoLabel[e]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEstadoDialog(false)}>Cancelar</Button>
            <Button onClick={cambiarEstado} disabled={isLoading} className="bg-sky-500 hover:bg-sky-600">
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
