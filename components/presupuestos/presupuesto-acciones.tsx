'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Edit, Download, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react';
import { ESTADO_PRESUPUESTO, estadoLabel, type EstadoPresupuesto } from '@/lib/enums';
import Link from 'next/link';
import { generarPresupuestoPDF } from '@/lib/pdf/generar-presupuesto';
import { formatCurrency } from '@/lib/utils';

type PresupuestoParaPDF = Parameters<typeof generarPresupuestoPDF>[0];

interface PresupuestoDatos {
  clienteId: string;
  clienteNombre: string;
  obraId?: string | null;
  obraNombre?: string | null;
  precioFinal?: number | null;
  totalFinal: number;
  cuentaCorrienteId?: string | null;
}

interface Props {
  presupuesto: { id: string; estado: EstadoPresupuesto; numero: number };
  presupuestoPDF?: PresupuestoParaPDF;
  presupuestoDatos?: PresupuestoDatos;
}

export function PresupuestoAcciones({ presupuesto, presupuestoPDF, presupuestoDatos }: Props) {
  const router = useRouter();

  // ── Cambiar estado ────────────────────────────────────────────────────────
  const [estadoDialog, setEstadoDialog] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState<EstadoPresupuesto>(presupuesto.estado);
  const [isLoading, setIsLoading] = useState(false);

  // ── Dialog sugerencia cuenta corriente ────────────────────────────────────
  const [suggestCuenta, setSuggestCuenta] = useState(false);

  // ── Dialog nueva cuenta corriente ─────────────────────────────────────────
  const [nuevaCuentaOpen, setNuevaCuentaOpen] = useState(false);
  const [ccMonto, setCcMonto] = useState('');
  const [ccNombreIndice, setCcNombreIndice] = useState('ICC');
  const [ccIndiceInicio, setCcIndiceInicio] = useState('');
  const [ccIndiceActual, setCcIndiceActual] = useState('');
  const [ccFechaInicio, setCcFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [ccObservaciones, setCcObservaciones] = useState('');
  const [ccSaving, setCcSaving] = useState(false);
  const [ccError, setCcError] = useState('');

  const cambiarEstado = async () => {
    setIsLoading(true);
    const res = await fetch(`/api/presupuestos/${presupuesto.id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado }),
    });
    setIsLoading(false);
    setEstadoDialog(false);

    if (res.ok && nuevoEstado === 'APROBADO' && presupuestoDatos && !presupuestoDatos.cuentaCorrienteId) {
      const monto = presupuestoDatos.precioFinal ?? presupuestoDatos.totalFinal ?? 0;
      setCcMonto(Number(monto).toFixed(2));
      setSuggestCuenta(true);
    } else {
      router.refresh();
    }
  };

  const handleAbrirNuevaCuenta = () => {
    setSuggestCuenta(false);
    setNuevaCuentaOpen(true);
  };

  const handleCrearCuenta = async () => {
    if (!ccMonto || !ccIndiceInicio || !ccIndiceActual || !ccFechaInicio) {
      setCcError('Completá los campos requeridos');
      return;
    }
    setCcError('');
    setCcSaving(true);
    try {
      const res = await fetch('/api/cuentas-corrientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: presupuestoDatos!.clienteId,
          obraId: presupuestoDatos!.obraId || null,
          presupuestoId: presupuesto.id,
          montoOriginal: parseFloat(ccMonto),
          nombreIndice: ccNombreIndice || 'ICC',
          indiceInicio: parseFloat(ccIndiceInicio),
          indiceActual: parseFloat(ccIndiceActual),
          fechaInicio: ccFechaInicio,
          observaciones: ccObservaciones || null,
        }),
      });
      if (res.ok) {
        setNuevaCuentaOpen(false);
        router.push('/cuentas-corrientes');
      } else {
        const d = await res.json().catch(() => ({}));
        setCcError(d.error ?? 'Error al crear la cuenta corriente');
      }
    } finally {
      setCcSaving(false);
    }
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
        onClick={async () => presupuestoPDF ? await generarPresupuestoPDF(presupuestoPDF) : window.print()}
      >
        <Download className="mr-1.5 h-4 w-4" /> Exportar PDF
      </Button>
      <Button size="sm" onClick={() => setEstadoDialog(true)} className="bg-[#00ADEF] hover:bg-[#0089C7]">
        <RefreshCw className="mr-1.5 h-4 w-4" /> Cambiar estado
      </Button>

      {/* ── Dialog cambiar estado ── */}
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
            <Button onClick={cambiarEstado} disabled={isLoading} className="bg-[#00ADEF] hover:bg-[#0089C7]">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog sugerencia cuenta corriente ── */}
      <Dialog open={suggestCuenta} onOpenChange={(v) => { setSuggestCuenta(v); if (!v) router.refresh(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex justify-center mb-2">
              <CheckCircle2 className="h-14 w-14 text-green-500" />
            </div>
            <DialogTitle className="text-center">Presupuesto aprobado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 text-center">
            El Presupuesto N° {presupuesto.numero} fue marcado como Aprobado.<br />
            ¿Deseás añadirlo a Cuentas Corrientes?
          </p>
          {presupuestoDatos && (
            <p className="text-2xl font-bold text-[#00ADEF] text-center">
              {formatCurrency(Number(presupuestoDatos.precioFinal ?? presupuestoDatos.totalFinal))}
            </p>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-center">
            <Button variant="outline" onClick={() => { setSuggestCuenta(false); router.refresh(); }}>
              Ahora no
            </Button>
            <Button className="bg-[#00ADEF] hover:bg-[#0089C7]" onClick={handleAbrirNuevaCuenta}>
              Sí, añadir a cuentas corrientes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog nueva cuenta corriente ── */}
      <Dialog open={nuevaCuentaOpen} onOpenChange={(v) => { setNuevaCuentaOpen(v); if (!v) router.refresh(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva cuenta corriente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div>
              <Label>Cliente</Label>
              <Input value={presupuestoDatos?.clienteNombre ?? ''} disabled className="bg-slate-50" />
            </div>
            {presupuestoDatos?.obraId && (
              <div>
                <Label>Obra</Label>
                <Input value={presupuestoDatos.obraNombre ?? presupuestoDatos.obraId} disabled className="bg-slate-50" />
              </div>
            )}
            <div>
              <Label>Presupuesto vinculado</Label>
              <Input value={`N° ${String(presupuesto.numero).padStart(4, '0')}`} disabled className="bg-slate-50" />
            </div>
            <div>
              <Label>Monto original *</Label>
              <Input
                type="number"
                value={ccMonto}
                onChange={(e) => setCcMonto(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Nombre del índice *</Label>
              <Input value={ccNombreIndice} onChange={(e) => setCcNombreIndice(e.target.value)} placeholder="ICC" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Índice inicio *</Label>
                <Input type="number" value={ccIndiceInicio} onChange={(e) => setCcIndiceInicio(e.target.value)} placeholder="0.0000" />
              </div>
              <div>
                <Label>Índice actual *</Label>
                <Input type="number" value={ccIndiceActual} onChange={(e) => setCcIndiceActual(e.target.value)} placeholder="0.0000" />
              </div>
            </div>
            <div>
              <Label>Fecha de inicio *</Label>
              <Input type="date" value={ccFechaInicio} onChange={(e) => setCcFechaInicio(e.target.value)} />
            </div>
            <div>
              <Label>Observaciones</Label>
              <Textarea
                value={ccObservaciones}
                onChange={(e) => setCcObservaciones(e.target.value)}
                rows={2}
                placeholder="Opcional..."
              />
            </div>
            {ccError && <p className="text-sm text-red-600">{ccError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNuevaCuentaOpen(false); router.refresh(); }}>
              Cancelar
            </Button>
            <Button
              className="bg-[#00ADEF] hover:bg-[#0089C7]"
              onClick={handleCrearCuenta}
              disabled={ccSaving}
            >
              {ccSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear cuenta corriente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
