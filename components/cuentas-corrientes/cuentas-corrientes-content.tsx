'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ChevronDown, ChevronUp, Plus, Edit, Trash2, TrendingUp, CreditCard, Loader2,
  FileText, DollarSign,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { CuentaCorriente, MovimientoCuenta, TipoMovimiento, EstadoCuenta } from '@prisma/client';

// ── Types ─────────────────────────────────────────────────────────────────────

type Cliente = { id: string; razonSocial: string };

type Obra = { id: string; nombre: string; direccion?: string | null };

type Presupuesto = {
  id: string;
  numero: number;
  totalFinal: unknown;
  nombrePresupuesto?: string | null;
};

type MovimientoSerializado = Omit<MovimientoCuenta, 'monto' | 'saldoResultante' | 'indiceValor'> & {
  monto: number;
  saldoResultante: number;
  indiceValor: number | null;
};

type CuentaConRelaciones = Omit<CuentaCorriente, 'montoOriginal' | 'indiceInicio' | 'indiceActual' | 'saldoActualizado'> & {
  montoOriginal: number;
  indiceInicio: number;
  indiceActual: number;
  saldoActualizado: number;
  cliente: { id: string; razonSocial: string; cuit?: string | null; email?: string | null; telefono?: string | null };
  obra?: { id: string; nombre: string; direccion?: string | null } | null;
  presupuesto?: { id: string; numero: number; totalFinal: number; nombrePresupuesto?: string | null } | null;
  movimientos: MovimientoSerializado[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  CARGO_INICIAL: 'Cargo inicial',
  ANTICIPO: 'Anticipo',
  PAGO_PARCIAL: 'Pago parcial',
  ACTUALIZACION: 'Actualización',
};

const TIPO_BADGE_STYLE: Record<string, string> = {
  ANTICIPO:      'bg-[#E6F1FB] text-[#0C447C] border-0',
  ACTUALIZACION: 'bg-[#FAEEDA] text-[#633806] border-0',
  CARGO_INICIAL: 'bg-[#FCEBEB] text-[#791F1F] border-0',
  PAGO_PARCIAL:  'bg-[#EAF3DE] text-[#27500A] border-0',
};

const ESTADO_BADGE_STYLE: Record<string, string> = {
  SALDO_PENDIENTE: 'bg-[#FAEEDA] text-[#633806] border-0',
  CANCELADO:       'bg-[#DCFCE7] text-[#166534] border-0',
  PENDIENTE:       'bg-[#F1F5F9] text-[#64748B] border-0',
};

const ESTADO_LABELS: Record<string, string> = {
  SALDO_PENDIENTE: 'Saldo pendiente',
  CANCELADO: 'Cancelado',
  PENDIENTE: 'Pendiente',
};

function fmtIndice(n: unknown) {
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  cuentasIniciales: CuentaConRelaciones[];
  clientes: Cliente[];
}

export function CuentasCorrientesContent({ cuentasIniciales, clientes }: Props) {
  const router = useRouter();
  const [cuentas, setCuentas] = useState<CuentaConRelaciones[]>(cuentasIniciales);
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<string>('all');
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const first = cuentasIniciales.find((c) => c.estado === 'SALDO_PENDIENTE');
    return first ? new Set([first.id]) : new Set();
  });

  // Toast
  const [toast, setToast] = useState<{ msg: string; error: boolean } | null>(null);
  const showToast = useCallback((msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Dialogs
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const [pagoOpen, setPagoOpen] = useState(false);
  const [actualizacionOpen, setActualizacionOpen] = useState(false);
  const [editMovOpen, setEditMovOpen] = useState(false);

  const [activeCuentaId, setActiveCuentaId] = useState<string | null>(null);
  const [activeMovimiento, setActiveMovimiento] = useState<MovimientoSerializado | null>(null);

  // ── Helper: refresh a single cuenta ──────────────────────────────────────
  const refreshCuenta = useCallback(async (id: string) => {
    const res = await fetch(`/api/cuentas-corrientes/${id}`);
    if (res.ok) {
      const updated = await res.json();
      setCuentas((prev) => prev.map((c) => (c.id === id ? updated : c)));
    }
  }, []);

  // ── Filtered cuentas ──────────────────────────────────────────────────────
  const cuentasFiltradas = cuentas.filter((c) => {
    const matchSearch = search
      ? c.cliente.razonSocial.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchEstado = estadoFiltro === 'all' ? true : c.estado === estadoFiltro;
    return matchSearch && matchEstado;
  });

  // ── Metrics ───────────────────────────────────────────────────────────────
  const totalFacturado = cuentas.reduce((sum, c) => sum + Number(c.montoOriginal), 0);
  const totalCobrado = cuentas.reduce((sum, c) => {
    return (
      sum +
      c.movimientos
        .filter((m) => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL')
        .reduce((s, m) => s + Number(m.monto), 0)
    );
  }, 0);
  const saldoPendienteTotal = cuentas
    .filter((c) => c.estado !== 'CANCELADO')
    .reduce((sum, c) => sum + Number(c.saldoActualizado), 0);
  const cuentasActivas = cuentas.filter((c) => c.estado !== 'CANCELADO').length;

  // ── Nueva cuenta form state ───────────────────────────────────────────────
  const [nfClienteId, setNfClienteId] = useState('');
  const [nfObras, setNfObras] = useState<Obra[]>([]);
  const [nfPresupuestos, setNfPresupuestos] = useState<Presupuesto[]>([]);
  const [nfObraId, setNfObraId] = useState('');
  const [nfPresupuestoId, setNfPresupuestoId] = useState('');
  const [nfMonto, setNfMonto] = useState('');
  const [nfNombreIndice, setNfNombreIndice] = useState('ICC');
  const [nfIndiceInicio, setNfIndiceInicio] = useState('');
  const [nfIndiceActual, setNfIndiceActual] = useState('');
  const [nfFechaInicio, setNfFechaInicio] = useState('');
  const [nfObservaciones, setNfObservaciones] = useState('');
  const [nfSaving, setNfSaving] = useState(false);

  const handleClienteChange = async (clienteId: string) => {
    setNfClienteId(clienteId);
    setNfObraId('');
    setNfPresupuestoId('');
    setNfObras([]);
    setNfPresupuestos([]);
    if (!clienteId) return;
    const [obrasRes, presRes] = await Promise.all([
      fetch(`/api/clientes/${clienteId}/obras`),
      fetch(`/api/presupuestos?clienteId=${clienteId}&page=1`),
    ]);
    if (obrasRes.ok) {
      const d = await obrasRes.json();
      setNfObras(d.obras ?? []);
    }
    if (presRes.ok) {
      const d = await presRes.json();
      setNfPresupuestos(d.presupuestos ?? []);
    }
  };

  const handlePresupuestoSelect = (presId: string) => {
    if (presId === 'none') { setNfPresupuestoId(''); return; }
    setNfPresupuestoId(presId);
    const pres = nfPresupuestos.find((p) => p.id === presId);
    if (pres) setNfMonto(Number(pres.totalFinal).toFixed(2));
  };

  const handleNuevaCuenta = async () => {
    if (!nfClienteId || !nfMonto || !nfIndiceInicio || !nfIndiceActual || !nfFechaInicio) {
      showToast('Completá los campos requeridos', true);
      return;
    }
    setNfSaving(true);
    try {
      const res = await fetch('/api/cuentas-corrientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: nfClienteId,
          obraId: nfObraId || null,
          presupuestoId: nfPresupuestoId || null,
          montoOriginal: parseFloat(nfMonto),
          nombreIndice: nfNombreIndice || 'ICC',
          indiceInicio: parseFloat(nfIndiceInicio),
          indiceActual: parseFloat(nfIndiceActual),
          fechaInicio: nfFechaInicio,
          observaciones: nfObservaciones || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? 'Error al crear cuenta', true);
        return;
      }
      const nueva = await res.json();
      setCuentas((prev) => [nueva, ...prev]);
      setExpanded((prev) => { const s = new Set(prev); s.add(nueva.id); return s; });
      setNuevaOpen(false);
      resetNuevaForm();
      showToast('Cuenta corriente creada');
      router.refresh();
    } finally {
      setNfSaving(false);
    }
  };

  const resetNuevaForm = () => {
    setNfClienteId('');
    setNfObras([]);
    setNfPresupuestos([]);
    setNfObraId('');
    setNfPresupuestoId('');
    setNfMonto('');
    setNfNombreIndice('ICC');
    setNfIndiceInicio('');
    setNfIndiceActual('');
    setNfFechaInicio('');
    setNfObservaciones('');
  };

  // ── Registrar pago ────────────────────────────────────────────────────────
  const [pfTipo, setPfTipo] = useState<'ANTICIPO' | 'PAGO_PARCIAL'>('ANTICIPO');
  const [pfDescripcion, setPfDescripcion] = useState('');
  const [pfMonto, setPfMonto] = useState('');
  const [pfFactura, setPfFactura] = useState('');
  const [pfFecha, setPfFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [pfSaving, setPfSaving] = useState(false);

  const openPagoDialog = (cuentaId: string) => {
    setActiveCuentaId(cuentaId);
    setPfTipo('ANTICIPO');
    setPfDescripcion('');
    setPfMonto('');
    setPfFactura('');
    setPfFecha(new Date().toISOString().slice(0, 10));
    setPagoOpen(true);
  };

  const calcSaldoPago = () => {
    if (!activeCuentaId || !pfMonto) return null;
    const cuenta = cuentas.find((c) => c.id === activeCuentaId);
    if (!cuenta) return null;
    const movs = [...cuenta.movimientos].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
    );
    const last = movs[movs.length - 1];
    const lastSaldo = last ? Number(last.saldoResultante) : Number(cuenta.montoOriginal);
    return lastSaldo - parseFloat(pfMonto || '0');
  };

  const handleRegistrarPago = async () => {
    if (!activeCuentaId || !pfDescripcion || !pfMonto || !pfFecha) {
      showToast('Completá los campos requeridos', true);
      return;
    }
    setPfSaving(true);
    try {
      const res = await fetch(`/api/cuentas-corrientes/${activeCuentaId}/movimientos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: pfTipo,
          descripcion: pfDescripcion,
          monto: parseFloat(pfMonto),
          numeroFactura: pfFactura || null,
          fecha: pfFecha,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? 'Error al registrar pago', true);
        return;
      }
      const { cuenta } = await res.json();
      setCuentas((prev) => prev.map((c) => (c.id === activeCuentaId ? cuenta : c)));
      setPagoOpen(false);
      showToast('Pago registrado');
    } finally {
      setPfSaving(false);
    }
  };

  // ── Aplicar actualización ─────────────────────────────────────────────────
  const [afDescripcion, setAfDescripcion] = useState('');
  const [afIndiceNuevo, setAfIndiceNuevo] = useState('');
  const [afSaving, setAfSaving] = useState(false);

  const openActualizacionDialog = (cuentaId: string) => {
    setActiveCuentaId(cuentaId);
    const cuenta = cuentas.find((c) => c.id === cuentaId);
    setAfDescripcion(cuenta ? `Actualización por ${cuenta.nombreIndice}` : 'Actualización');
    setAfIndiceNuevo('');
    setActualizacionOpen(true);
  };

  const calcAjuste = () => {
    if (!activeCuentaId || !afIndiceNuevo) return null;
    const cuenta = cuentas.find((c) => c.id === activeCuentaId);
    if (!cuenta) return null;
    const movs = [...cuenta.movimientos].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
    );
    const last = movs[movs.length - 1];
    const lastSaldo = last ? Number(last.saldoResultante) : Number(cuenta.montoOriginal);
    const idxNuevo = parseFloat(afIndiceNuevo);
    const idxActual = Number(cuenta.indiceActual);
    if (!idxActual) return null;
    return lastSaldo * (idxNuevo / idxActual - 1);
  };

  const calcVariacion = () => {
    if (!activeCuentaId || !afIndiceNuevo) return null;
    const cuenta = cuentas.find((c) => c.id === activeCuentaId);
    if (!cuenta) return null;
    const idxNuevo = parseFloat(afIndiceNuevo);
    const idxActual = Number(cuenta.indiceActual);
    if (!idxActual) return null;
    return ((idxNuevo / idxActual - 1) * 100).toFixed(2);
  };

  const handleAplicarActualizacion = async () => {
    if (!activeCuentaId || !afIndiceNuevo) {
      showToast('Ingresá el índice nuevo', true);
      return;
    }
    setAfSaving(true);
    try {
      const res = await fetch(`/api/cuentas-corrientes/${activeCuentaId}/aplicar-actualizacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indiceNuevo: parseFloat(afIndiceNuevo),
          descripcion: afDescripcion,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? 'Error al aplicar actualización', true);
        return;
      }
      const { cuenta } = await res.json();
      setCuentas((prev) => prev.map((c) => (c.id === activeCuentaId ? cuenta : c)));
      setActualizacionOpen(false);
      showToast('Actualización aplicada');
    } finally {
      setAfSaving(false);
    }
  };

  // ── Editar movimiento ─────────────────────────────────────────────────────
  const [emDescripcion, setEmDescripcion] = useState('');
  const [emMonto, setEmMonto] = useState('');
  const [emFactura, setEmFactura] = useState('');
  const [emFecha, setEmFecha] = useState('');
  const [emSaving, setEmSaving] = useState(false);

  const openEditMovDialog = (cuentaId: string, mov: MovimientoSerializado) => {
    setActiveCuentaId(cuentaId);
    setActiveMovimiento(mov);
    setEmDescripcion(mov.descripcion);
    setEmMonto(Number(mov.monto).toFixed(2));
    setEmFactura(mov.numeroFactura ?? '');
    setEmFecha(new Date(mov.fecha).toISOString().slice(0, 10));
    setEditMovOpen(true);
  };

  const handleEditarMovimiento = async () => {
    if (!activeCuentaId || !activeMovimiento) return;
    setEmSaving(true);
    try {
      const res = await fetch(
        `/api/cuentas-corrientes/${activeCuentaId}/movimientos/${activeMovimiento.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            descripcion: emDescripcion,
            monto: parseFloat(emMonto),
            numeroFactura: emFactura || null,
            fecha: emFecha,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? 'Error al editar movimiento', true);
        return;
      }
      const cuentaActualizada = await res.json();
      setCuentas((prev) => prev.map((c) => (c.id === activeCuentaId ? cuentaActualizada : c)));
      setEditMovOpen(false);
      showToast('Movimiento actualizado');
    } finally {
      setEmSaving(false);
    }
  };

  // ── Eliminar movimiento ───────────────────────────────────────────────────
  const [deletingMovId, setDeletingMovId] = useState<string | null>(null);

  const handleEliminarMovimiento = async (cuentaId: string, movimientoId: string) => {
    if (!confirm('¿Eliminar este movimiento? Esta acción recalculará los saldos siguientes.')) return;
    setDeletingMovId(movimientoId);
    try {
      const res = await fetch(
        `/api/cuentas-corrientes/${cuentaId}/movimientos/${movimientoId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? 'Error al eliminar movimiento', true);
        return;
      }
      const cuentaActualizada = await res.json();
      setCuentas((prev) => prev.map((c) => (c.id === cuentaId ? cuentaActualizada : c)));
      showToast('Movimiento eliminado');
    } finally {
      setDeletingMovId(null);
    }
  };

  // ── Exportar PDF ──────────────────────────────────────────────────────────
  const handleExportarPDF = async (cuenta: CuentaConRelaciones) => {
    const { generarCuentaCorrientePDF } = await import('@/lib/pdf/generar-cuenta-corriente');
    generarCuentaCorrientePDF({
      id: cuenta.id,
      fechaInicio: cuenta.fechaInicio,
      montoOriginal: Number(cuenta.montoOriginal),
      indiceInicio: Number(cuenta.indiceInicio),
      indiceActual: Number(cuenta.indiceActual),
      nombreIndice: cuenta.nombreIndice,
      saldoActualizado: Number(cuenta.saldoActualizado),
      estado: cuenta.estado,
      observaciones: cuenta.observaciones,
      cliente: cuenta.cliente,
      obra: cuenta.obra ?? null,
      presupuesto: cuenta.presupuesto
        ? {
            numero: cuenta.presupuesto.numero,
            nombrePresupuesto: cuenta.presupuesto.nombrePresupuesto ?? null,
          }
        : null,
      movimientos: cuenta.movimientos.map((m) => ({
        fecha: m.fecha,
        tipo: m.tipo,
        descripcion: m.descripcion,
        numeroFactura: m.numeroFactura,
        monto: Number(m.monto),
        saldoResultante: Number(m.saldoResultante),
      })),
    });
  };

  // ── Toggle expand ──────────────────────────────────────────────────────────
  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const activeCuenta = activeCuentaId ? cuentas.find((c) => c.id === activeCuentaId) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Cuentas Corrientes</h1>
          <p className="text-sm text-gray-500 mt-1">Seguimiento de saldos y pagos de clientes</p>
        </div>
        <Button
          onClick={() => setNuevaOpen(true)}
          className="bg-[#00ADEF] hover:bg-[#0089C7] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva cuenta
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <DollarSign className="w-4 h-4" />
            Total facturado
          </div>
          <p className="text-xl font-bold text-[#1A1A1A]">{formatCurrency(totalFacturado)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <CreditCard className="w-4 h-4" />
            Total cobrado
          </div>
          <p className="text-xl font-bold text-[#1A1A1A]">{formatCurrency(totalCobrado)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <FileText className="w-4 h-4" />
            Saldo pendiente
          </div>
          <p className="text-xl font-bold text-red-600">{formatCurrency(saldoPendienteTotal)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <TrendingUp className="w-4 h-4" />
            Cuentas activas
          </div>
          <p className="text-xl font-bold text-[#00ADEF]">{cuentasActivas}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Input
          placeholder="Buscar por cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="SALDO_PENDIENTE">Saldo pendiente</SelectItem>
            <SelectItem value="CANCELADO">Cancelado</SelectItem>
            <SelectItem value="PENDIENTE">Pendiente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {cuentasFiltradas.length === 0 && (
          <p className="text-sm text-gray-400 py-8 text-center">No se encontraron cuentas corrientes.</p>
        )}
        {cuentasFiltradas.map((cuenta) => {
          const isExpanded = expanded.has(cuenta.id);
          const movsSorted = [...cuenta.movimientos].sort(
            (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime(),
          );
          const lastSaldo = movsSorted.length
            ? Number(movsSorted[movsSorted.length - 1].saldoResultante)
            : Number(cuenta.montoOriginal);

          const totalCobradoCuenta = movsSorted
            .filter((m) => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL')
            .reduce((s, m) => s + Number(m.monto), 0);

          const progresoPct =
            Number(cuenta.saldoActualizado) > 0
              ? Math.min(100, (totalCobradoCuenta / Number(cuenta.saldoActualizado)) * 100)
              : 0;

          const cancelado = cuenta.estado === 'CANCELADO';

          return (
            <div
              key={cuenta.id}
              className="bg-white border rounded-lg shadow-sm overflow-hidden"
            >
              {/* Collapsed header */}
              <button
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                onClick={() => toggleExpand(cuenta.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#1A1A1A]">
                      {cuenta.cliente.razonSocial}
                    </span>
                    {cuenta.obra && (
                      <span className="text-gray-400">—</span>
                    )}
                    {cuenta.obra && (
                      <span className="text-sm text-gray-600">{cuenta.obra.nombre}</span>
                    )}
                    {!cuenta.obra && (
                      <span className="text-sm text-gray-400">Sin obra</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {cuenta.presupuesto
                      ? `Presupuesto N° ${String(cuenta.presupuesto.numero).padStart(4, '0')} · `
                      : ''}
                    Inicio: {formatDate(cuenta.fechaInicio)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {cancelado ? (
                    <span className="text-sm font-semibold text-green-700">Saldado</span>
                  ) : (
                    <span className="text-sm font-semibold text-red-600">
                      Saldo: {formatCurrency(Number(cuenta.saldoActualizado))}
                    </span>
                  )}
                  <Badge className={ESTADO_BADGE_STYLE[cuenta.estado] ?? ''}>
                    {ESTADO_LABELS[cuenta.estado] ?? cuenta.estado}
                  </Badge>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t px-5 pb-5 space-y-4">
                  {/* Index info row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <div className="bg-gray-50 rounded-md p-3">
                      <p className="text-xs text-gray-400">{cuenta.nombreIndice} — Índice inicio</p>
                      <p className="text-sm font-semibold text-[#1A1A1A] mt-0.5">
                        {fmtIndice(cuenta.indiceInicio)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-md p-3">
                      <p className="text-xs text-gray-400">{cuenta.nombreIndice} — Índice actual</p>
                      <p className="text-sm font-semibold text-[#1A1A1A] mt-0.5">
                        {fmtIndice(cuenta.indiceActual)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-md p-3">
                      <p className="text-xs text-gray-400">Monto original</p>
                      <p className="text-sm font-semibold text-[#1A1A1A] mt-0.5">
                        {formatCurrency(Number(cuenta.montoOriginal))}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-md p-3">
                      <p className="text-xs text-gray-400">
                        Saldo actualizado
                        <span className="ml-1 text-gray-300">
                          (× {fmtIndice(cuenta.indiceActual)}/{fmtIndice(cuenta.indiceInicio)})
                        </span>
                      </p>
                      <p className="text-sm font-semibold text-red-600 mt-0.5">
                        {formatCurrency(Number(cuenta.saldoActualizado))}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Cobrado: {formatCurrency(totalCobradoCuenta)}</span>
                      <span>{progresoPct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${progresoPct}%`, backgroundColor: '#00ADEF' }}
                      />
                    </div>
                  </div>

                  {/* Movements table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Fecha</TableHead>
                          <TableHead className="w-32">Tipo</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="w-28">N° Factura</TableHead>
                          <TableHead className="w-32 text-right">Monto</TableHead>
                          <TableHead className="w-32 text-right">Saldo</TableHead>
                          <TableHead className="w-20">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movsSorted.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-gray-400 text-sm">
                              Sin movimientos
                            </TableCell>
                          </TableRow>
                        )}
                        {movsSorted.map((mov) => (
                          <TableRow key={mov.id}>
                            <TableCell className="text-sm">{formatDate(mov.fecha)}</TableCell>
                            <TableCell>
                              <Badge className={TIPO_BADGE_STYLE[mov.tipo] ?? 'bg-gray-100 text-gray-600 border-0'}>
                                {TIPO_LABELS[mov.tipo] ?? mov.tipo}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{mov.descripcion}</TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {mov.numeroFactura ?? '—'}
                            </TableCell>
                            <TableCell className="text-sm text-right font-medium">
                              {mov.tipo === 'ANTICIPO' || mov.tipo === 'PAGO_PARCIAL' ? (
                                <span className="text-red-600">−{formatCurrency(Number(mov.monto))}</span>
                              ) : (
                                <span className="text-green-700">+{formatCurrency(Number(mov.monto))}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-right font-semibold">
                              {formatCurrency(Number(mov.saldoResultante))}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {(mov.tipo === 'ANTICIPO' || mov.tipo === 'PAGO_PARCIAL') && (
                                  <button
                                    onClick={() => openEditMovDialog(cuenta.id, mov)}
                                    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                                    title="Editar movimiento"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {mov.tipo !== 'CARGO_INICIAL' && (
                                  <button
                                    onClick={() => handleEliminarMovimiento(cuenta.id, mov.id)}
                                    disabled={deletingMovId === mov.id}
                                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                                    title="Eliminar movimiento"
                                  >
                                    {deletingMovId === mov.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openActualizacionDialog(cuenta.id)}
                      className="border-[#00ADEF] text-[#00ADEF] hover:bg-[#E6F7FD]"
                    >
                      <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                      Aplicar actualización
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openPagoDialog(cuenta.id)}
                    >
                      <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                      Registrar pago
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExportarPDF(cuenta)}
                    >
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Exportar PDF
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Dialog: Nueva cuenta ────────────────────────────────────────── */}
      <Dialog open={nuevaOpen} onOpenChange={(o) => { setNuevaOpen(o); if (!o) resetNuevaForm(); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva cuenta corriente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cliente *</Label>
              <Select value={nfClienteId} onValueChange={handleClienteChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.razonSocial}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {nfObras.length > 0 && (
              <div>
                <Label>Obra</Label>
                <Select value={nfObraId || 'none'} onValueChange={(v) => setNfObraId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar obra (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin obra</SelectItem>
                    {nfObras.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {nfPresupuestos.length > 0 && (
              <div>
                <Label>Presupuesto vinculado</Label>
                <Select value={nfPresupuestoId || 'none'} onValueChange={handlePresupuestoSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vincular presupuesto (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin presupuesto</SelectItem>
                    {nfPresupuestos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        N° {String(p.numero).padStart(4, '0')} — {formatCurrency(Number(p.totalFinal))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Monto original *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={nfMonto}
                onChange={(e) => setNfMonto(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Nombre del índice</Label>
                <Input
                  value={nfNombreIndice}
                  onChange={(e) => setNfNombreIndice(e.target.value)}
                  placeholder="ICC"
                />
              </div>
              <div>
                <Label>Índice inicio *</Label>
                <Input
                  type="number"
                  step="0.0001"
                  placeholder="0.0000"
                  value={nfIndiceInicio}
                  onChange={(e) => setNfIndiceInicio(e.target.value)}
                />
              </div>
              <div>
                <Label>Índice actual *</Label>
                <Input
                  type="number"
                  step="0.0001"
                  placeholder="0.0000"
                  value={nfIndiceActual}
                  onChange={(e) => setNfIndiceActual(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Fecha de inicio *</Label>
              <Input
                type="date"
                value={nfFechaInicio}
                onChange={(e) => setNfFechaInicio(e.target.value)}
              />
            </div>
            <div>
              <Label>Observaciones</Label>
              <Textarea
                value={nfObservaciones}
                onChange={(e) => setNfObservaciones(e.target.value)}
                placeholder="Notas adicionales..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNuevaOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleNuevaCuenta}
              disabled={nfSaving}
              className="bg-[#00ADEF] hover:bg-[#0089C7] text-white"
            >
              {nfSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Crear cuenta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Registrar pago ──────────────────────────────────────── */}
      <Dialog open={pagoOpen} onOpenChange={setPagoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
          </DialogHeader>
          {activeCuenta && (
            <p className="text-sm text-gray-500 -mt-2">
              {activeCuenta.cliente.razonSocial}
              {activeCuenta.obra ? ` — ${activeCuenta.obra.nombre}` : ''}
            </p>
          )}
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Tipo</Label>
              <div className="flex gap-4">
                {(['ANTICIPO', 'PAGO_PARCIAL'] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value={t}
                      checked={pfTipo === t}
                      onChange={() => setPfTipo(t)}
                      className="accent-[#00ADEF]"
                    />
                    <span className="text-sm">{t === 'ANTICIPO' ? 'Anticipo' : 'Pago parcial'}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Descripción *</Label>
              <Input
                value={pfDescripcion}
                onChange={(e) => setPfDescripcion(e.target.value)}
                placeholder="Ej: Pago cuota 1"
              />
            </div>
            <div>
              <Label>Monto *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={pfMonto}
                onChange={(e) => setPfMonto(e.target.value)}
              />
            </div>
            <div>
              <Label>N° Factura</Label>
              <Input
                value={pfFactura}
                onChange={(e) => setPfFactura(e.target.value)}
                placeholder="Ej: A-0001-00000001"
              />
            </div>
            <div>
              <Label>Fecha *</Label>
              <Input
                type="date"
                value={pfFecha}
                onChange={(e) => setPfFecha(e.target.value)}
              />
            </div>
            {pfMonto && (
              <div className="bg-gray-50 rounded-md p-3 text-sm">
                <span className="text-gray-500">Saldo resultante: </span>
                <span className={`font-semibold ${(calcSaldoPago() ?? 0) < 0 ? 'text-red-600' : 'text-[#1A1A1A]'}`}>
                  {calcSaldoPago() !== null ? formatCurrency(calcSaldoPago()!) : '—'}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleRegistrarPago}
              disabled={pfSaving}
              className="bg-[#00ADEF] hover:bg-[#0089C7] text-white"
            >
              {pfSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Aplicar actualización ──────────────────────────────── */}
      <Dialog open={actualizacionOpen} onOpenChange={setActualizacionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aplicar actualización por índice</DialogTitle>
          </DialogHeader>
          {activeCuenta && (
            <p className="text-sm text-gray-500 -mt-2">
              {activeCuenta.cliente.razonSocial}
              {activeCuenta.obra ? ` — ${activeCuenta.obra.nombre}` : ''}
            </p>
          )}
          <div className="space-y-4">
            <div>
              <Label>Descripción</Label>
              <Input
                value={afDescripcion}
                onChange={(e) => setAfDescripcion(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Índice anterior</Label>
                <Input
                  value={activeCuenta ? fmtIndice(activeCuenta.indiceActual) : ''}
                  readOnly
                  className="bg-gray-50 text-gray-500"
                />
              </div>
              <div>
                <Label>Índice nuevo *</Label>
                <Input
                  type="number"
                  step="0.0001"
                  placeholder="0.0000"
                  value={afIndiceNuevo}
                  onChange={(e) => setAfIndiceNuevo(e.target.value)}
                />
              </div>
            </div>
            {afIndiceNuevo && (
              <div className="bg-gray-50 rounded-md p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Variación:</span>
                  <span className={`font-semibold ${Number(calcVariacion()) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {calcVariacion() !== null ? `${Number(calcVariacion()) >= 0 ? '+' : ''}${calcVariacion()}%` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ajuste al saldo:</span>
                  <span className={`font-semibold ${(calcAjuste() ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {calcAjuste() !== null
                      ? `${(calcAjuste()! >= 0 ? '+' : '')}${formatCurrency(calcAjuste()!)}`
                      : '—'}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActualizacionOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleAplicarActualizacion}
              disabled={afSaving}
              className="bg-[#00ADEF] hover:bg-[#0089C7] text-white"
            >
              {afSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Editar movimiento ───────────────────────────────────── */}
      <Dialog open={editMovOpen} onOpenChange={setEditMovOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar movimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descripción</Label>
              <Input
                value={emDescripcion}
                onChange={(e) => setEmDescripcion(e.target.value)}
              />
            </div>
            <div>
              <Label>Monto</Label>
              <Input
                type="number"
                step="0.01"
                value={emMonto}
                onChange={(e) => setEmMonto(e.target.value)}
              />
            </div>
            <div>
              <Label>N° Factura</Label>
              <Input
                value={emFactura}
                onChange={(e) => setEmFactura(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={emFecha}
                onChange={(e) => setEmFecha(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMovOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleEditarMovimiento}
              disabled={emSaving}
              className="bg-[#00ADEF] hover:bg-[#0089C7] text-white"
            >
              {emSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2 ${
            toast.error ? 'bg-red-600' : 'bg-green-600'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
