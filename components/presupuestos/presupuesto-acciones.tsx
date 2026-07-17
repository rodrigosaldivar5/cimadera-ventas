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
import {
  ESTADO_PRESUPUESTO,
  estadoLabel,
  type EstadoPresupuesto,
  MOTIVO_CIERRE_LABEL,
  MOTIVOS_PERDIDO_COMPUTABLE,
  MOTIVOS_NO_COMPUTABLE,
} from '@/lib/enums';
import Link from 'next/link';
import { generarPresupuestoPDF } from '@/lib/pdf/generar-presupuesto';
import { formatCurrency } from '@/lib/utils';
import {
  clasificarTransicionPresupuesto,
  LABEL_TIPO_MOVIMIENTO,
  MOTIVOS_TRANSICION,
} from '@/lib/mi-trabajo';

type PresupuestoParaPDF = Parameters<typeof generarPresupuestoPDF>[0];

interface PresupuestoDatos {
  clienteId: string;
  clienteNombre: string;
  obraId?: string | null;
  obraNombre?: string | null;
  precioFinal?: number | null;
  totalFinal: number;
  cuentaCorrienteId?: string | null;
  moneda?: string | null;
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

  // ── Dialog cierre comercial (RECHAZADO) ──────────────────────────────────
  const [cierreDialog, setCierreDialog] = useState(false);
  const [cierreResultado, setCierreResultado] = useState<'PERDIDO_COMPUTABLE' | 'NO_COMPUTABLE' | ''>('');
  const [cierreMotivo, setCierreMotivo] = useState('');
  const [cierreComentario, setCierreComentario] = useState('');
  const [cierreSaving, setCierreSaving] = useState(false);

  // ── Dialog sugerencia cuenta corriente ────────────────────────────────────
  const [suggestCuenta, setSuggestCuenta] = useState(false);

  // ── Dialog transición especial ────────────────────────────────────────────
  const [transicionDialog, setTransicionDialog] = useState(false);
  const [transicionTipo, setTransicionTipo] = useState<string | null>(null);
  const [transicionMotivo, setTransicionMotivo] = useState('');

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
    if (nuevoEstado === 'RECHAZADO') {
      setEstadoDialog(false);
      setCierreResultado('');
      setCierreMotivo('');
      setCierreComentario('');
      setCierreDialog(true);
      return;
    }

    const tipo = clasificarTransicionPresupuesto(presupuesto.estado, nuevoEstado);
    if (tipo && !transicionDialog) {
      setEstadoDialog(false);
      setTransicionTipo(tipo);
      setTransicionMotivo('');
      setTransicionDialog(true);
      return;
    }

    setIsLoading(true);
    const body: Record<string, unknown> = { estado: nuevoEstado };
    if (transicionMotivo) body.motivoMovimiento = transicionMotivo;
    const res = await fetch(`/api/presupuestos/${presupuesto.id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setIsLoading(false);
    setEstadoDialog(false);
    setTransicionDialog(false);
    setTransicionTipo(null);
    setTransicionMotivo('');

    if (res.ok && nuevoEstado === 'APROBADO' && presupuestoDatos && !presupuestoDatos.cuentaCorrienteId) {
      const monto = presupuestoDatos.precioFinal ?? presupuestoDatos.totalFinal ?? 0;
      setCcMonto(Number(monto).toFixed(2));
      setSuggestCuenta(true);
    } else {
      router.refresh();
    }
  };

  const confirmarCierre = async () => {
    if (!cierreResultado || !cierreMotivo) return;
    setCierreSaving(true);
    const res = await fetch(`/api/presupuestos/${presupuesto.id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estado: 'RECHAZADO',
        resultadoComercial: cierreResultado,
        motivoCierre: cierreMotivo,
        comentarioCierre: cierreComentario || null,
      }),
    });
    setCierreSaving(false);
    if (res.ok) {
      setCierreDialog(false);
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
          moneda: presupuestoDatos!.moneda ?? 'ARS',
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

      {/* ── Dialog transición especial ── */}
      <Dialog open={transicionDialog} onOpenChange={(v) => { if (!v) { setTransicionDialog(false); setTransicionTipo(null); setTransicionMotivo(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar cambio de estado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-sm text-amber-800">
                Este cambio será registrado como{' '}
                <span className="font-semibold">
                  {transicionTipo ? LABEL_TIPO_MOVIMIENTO[transicionTipo as keyof typeof LABEL_TIPO_MOVIMIENTO] : ''}
                </span>.
                ¿Querés continuar?
              </p>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Motivo (recomendado)</Label>
              <Select value={transicionMotivo} onValueChange={setTransicionMotivo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_TRANSICION.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTransicionDialog(false); setTransicionTipo(null); setTransicionMotivo(''); }}>
              Cancelar
            </Button>
            <Button onClick={cambiarEstado} disabled={isLoading} className="bg-amber-600 hover:bg-amber-700 text-white">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog cierre comercial ── */}
      <Dialog open={cierreDialog} onOpenChange={setCierreDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cerrar presupuesto #{presupuesto.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Resultado comercial *</Label>
              <Select
                value={cierreResultado}
                onValueChange={(v) => { setCierreResultado(v as 'PERDIDO_COMPUTABLE' | 'NO_COMPUTABLE'); setCierreMotivo(''); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un resultado..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERDIDO_COMPUTABLE">Perdido (computable)</SelectItem>
                  <SelectItem value="NO_COMPUTABLE">No computable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Motivo *</Label>
              <Select
                value={cierreMotivo}
                onValueChange={setCierreMotivo}
                disabled={!cierreResultado}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {(cierreResultado === 'PERDIDO_COMPUTABLE' ? MOTIVOS_PERDIDO_COMPUTABLE : MOTIVOS_NO_COMPUTABLE).map((m) => (
                    <SelectItem key={m} value={m}>{MOTIVO_CIERRE_LABEL[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Comentario (opcional)</Label>
              <Textarea
                value={cierreComentario}
                onChange={(e) => setCierreComentario(e.target.value)}
                rows={2}
                placeholder="Contexto adicional..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCierreDialog(false)}>Cancelar</Button>
            <Button
              onClick={confirmarCierre}
              disabled={!cierreResultado || !cierreMotivo || cierreSaving}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {cierreSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar cierre'}
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
              {presupuestoDatos.moneda === 'USD'
                ? `U$D ${Number(presupuestoDatos.precioFinal ?? presupuestoDatos.totalFinal).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : formatCurrency(Number(presupuestoDatos.precioFinal ?? presupuestoDatos.totalFinal))}
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
