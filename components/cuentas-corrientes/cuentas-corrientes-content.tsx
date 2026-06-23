'use client';

import { useState, useCallback, useEffect } from 'react';
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
  FileText, DollarSign, AlertTriangle, X, Download,
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
  precioFinal?: number | null;
  nombrePresupuesto?: string | null;
  moneda?: string;
};

type PresupuestoSinCuenta = {
  id: string;
  numero: number;
  nombrePresupuesto?: string | null;
  precioFinal?: number | null;
  totalFinal: number;
  fechaCreacion: Date | string;
  clienteId: string;
  cliente: { razonSocial: string };
  obraId?: string | null;
  obra?: { nombre: string } | null;
  moneda?: string;
};

type MovimientoSerializado = Omit<MovimientoCuenta, 'monto' | 'saldoResultante' | 'indiceValor' | 'tipoCambio' | 'montoEnARS' | 'equivalenteUSD'> & {
  monto: number;
  saldoResultante: number;
  indiceValor: number | null;
  tipoCambio: number | null;
  montoEnARS: number | null;
  equivalenteUSD: number | null;
};

type CuentaConRelaciones = Omit<CuentaCorriente, 'montoOriginal' | 'indiceInicio' | 'indiceActual' | 'saldoActualizado' | 'montoEstimadoCobro'> & {
  montoOriginal: number;
  indiceInicio: number;
  indiceActual: number;
  saldoActualizado: number;
  montoEstimadoCobro: number | null;
  moneda?: string;
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

// Normaliza los Decimal de Prisma (que llegan como strings desde la API) a number,
// igual que hace el Server Component en page.tsx antes de pasar los datos al cliente.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeCuenta(c: any): CuentaConRelaciones {
  return {
    ...c,
    montoOriginal:    Number(c.montoOriginal),
    indiceInicio:     Number(c.indiceInicio),
    indiceActual:     Number(c.indiceActual),
    saldoActualizado: Number(c.saldoActualizado),
    presupuesto: c.presupuesto
      ? { ...c.presupuesto, totalFinal: Number(c.presupuesto.totalFinal) }
      : null,
    movimientos: (c.movimientos ?? []).map((m: any) => ({
      ...m,
      monto:           Number(m.monto),
      saldoResultante: Number(m.saldoResultante),
      indiceValor:     m.indiceValor != null ? Number(m.indiceValor) : null,
      tipoCambio:      m.tipoCambio != null ? Number(m.tipoCambio) : null,
      montoEnARS:      m.montoEnARS != null ? Number(m.montoEnARS) : null,
      equivalenteUSD:  m.equivalenteUSD != null ? Number(m.equivalenteUSD) : null,
    })),
    montoEstimadoCobro: c.montoEstimadoCobro != null ? Number(c.montoEstimadoCobro) : null,
  };
}

// ── Main Component ────────────────────────────────────────────────────────────

const EMAILS_ELIMINAR_CC = ['coordinacion.general@cimadera.net', 'alfredo.ostro@cimadera.net'];

interface Props {
  cuentasIniciales: CuentaConRelaciones[];
  clientes: Cliente[];
  presupuestosSinCuenta: PresupuestoSinCuenta[];
  userEmail?: string;
}

export function CuentasCorrientesContent({ cuentasIniciales, clientes, presupuestosSinCuenta, userEmail = '' }: Props) {
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

  // ── Índice global ─────────────────────────────────────────────────────────
  const [indiceGlobal, setIndiceGlobal] = useState<number | null>(null);
  const [indiceGlobalNombre, setIndiceGlobalNombre] = useState('CAC MO');
  const [indiceGlobalFecha, setIndiceGlobalFecha] = useState<string | null>(null);
  const [editandoIndice, setEditandoIndice] = useState(false);
  const [indiceEditValor, setIndiceEditValor] = useState('');
  const [indiceEditNombre, setIndiceEditNombre] = useState('');
  const [indiceEditSaving, setIndiceEditSaving] = useState(false);

  useEffect(() => {
    fetch('/api/indices/actual')
      .then((r) => r.json())
      .then((d) => {
        if (d?.valor) {
          setIndiceGlobal(Number(d.valor));
          setIndiceGlobalNombre(d.nombre ?? 'CAC MO');
          setIndiceGlobalFecha(d.fecha ?? null);
        }
      })
      .catch(() => {});
  }, []);

  const handleGuardarIndice = async () => {
    if (!indiceEditValor) return;
    setIndiceEditSaving(true);
    try {
      const res = await fetch('/api/indices/actual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: indiceEditNombre || indiceGlobalNombre, valor: parseFloat(indiceEditValor) }),
      });
      if (res.ok) {
        const d = await res.json();
        setIndiceGlobal(Number(d.valor));
        setIndiceGlobalNombre(d.nombre);
        setIndiceGlobalFecha(d.fecha);
        setEditandoIndice(false);
        showToast('Índice actualizado');
      }
    } finally {
      setIndiceEditSaving(false);
    }
  };

  // ── Banner presupuestos sin cuenta ────────────────────────────────────────
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [showAllBanner, setShowAllBanner] = useState(false);
  const [bannerLoadingId, setBannerLoadingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cc-banner-dismissed-ids');
      if (saved) setDismissedIds(JSON.parse(saved));
    } catch {}
  }, []);

  const bannerVisible = presupuestosSinCuenta.some((p) => !dismissedIds.includes(p.id));

  const handleDismissBanner = () => {
    const allIds = presupuestosSinCuenta.map((p) => p.id);
    setDismissedIds(allIds);
    try { localStorage.setItem('cc-banner-dismissed-ids', JSON.stringify(allIds)); } catch {}
  };

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
      setCuentas((prev) => prev.map((c) => (c.id === id ? serializeCuenta(updated) : c)));
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
  const arsCuentas = cuentas.filter((c) => (c.moneda ?? 'ARS') === 'ARS');
  const usdCuentas = cuentas.filter((c) => c.moneda === 'USD');

  const totalFacturado = arsCuentas.reduce((sum, c) => sum + Number(c.montoOriginal), 0);
  const totalFacturadoUSD = usdCuentas.reduce((sum, c) => sum + Number(c.montoOriginal), 0);

  const totalCobrado = arsCuentas.reduce((sum, c) => {
    return (
      sum +
      c.movimientos
        .filter((m) => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL')
        .reduce((s, m) => s + Number(m.montoEnARS ?? m.monto), 0)
    );
  }, 0);
  const totalCobradoUSD = usdCuentas.reduce((sum, c) => {
    return (
      sum +
      c.movimientos
        .filter((m) => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL')
        .reduce((s, m) => s + Number(m.equivalenteUSD ?? m.monto), 0)
    );
  }, 0);

  const saldoPendienteTotal = arsCuentas
    .filter((c) => c.estado !== 'CANCELADO')
    .reduce((sum, c) => sum + Number(c.saldoActualizado), 0);
  const saldoPendienteTotalUSD = usdCuentas
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
  const [nfMoneda, setNfMoneda] = useState<'ARS' | 'USD'>('ARS');
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
    if (pres) {
      const monto = pres.precioFinal ?? pres.totalFinal ?? 0;
      setNfMonto(Number(monto).toFixed(2));
      if (pres.moneda === 'USD' || pres.moneda === 'ARS') setNfMoneda(pres.moneda);
    }
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
          moneda: nfMoneda,
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
    setNfMoneda('ARS');
  };

  const handleAbrirDesdeBanner = async (ps: PresupuestoSinCuenta) => {
    setBannerLoadingId(ps.id);
    resetNuevaForm();
    setNfClienteId(ps.clienteId);
    const monto = ps.precioFinal ?? ps.totalFinal ?? 0;
    setNfMonto(Number(monto).toFixed(2));
    const [obrasRes, presRes] = await Promise.all([
      fetch(`/api/clientes/${ps.clienteId}/obras`),
      fetch(`/api/presupuestos?clienteId=${ps.clienteId}&page=1`),
    ]);
    if (obrasRes.ok) {
      const d = await obrasRes.json();
      setNfObras(d.obras ?? []);
      if (ps.obraId) setNfObraId(ps.obraId);
    }
    if (presRes.ok) {
      const d = await presRes.json();
      const list: Presupuesto[] = d.presupuestos ?? [];
      if (!list.find((p) => p.id === ps.id)) {
        list.unshift({ id: ps.id, numero: ps.numero, totalFinal: ps.totalFinal, precioFinal: ps.precioFinal, nombrePresupuesto: ps.nombrePresupuesto });
      }
      setNfPresupuestos(list);
      setNfPresupuestoId(ps.id);
    }
    if (ps.moneda === 'USD' || ps.moneda === 'ARS') setNfMoneda(ps.moneda);
    setBannerLoadingId(null);
    setNuevaOpen(true);
  };

  // ── Proyección de cobro (cashflow fields) ────────────────────────────────
  const [cfSavingId, setCfSavingId] = useState<string | null>(null);
  const [cfDraft, setCfDraft] = useState<Record<string, { fecha: string; monto: string; notas: string }>>({});

  const getCfDraft = (cuenta: CuentaConRelaciones) =>
    cfDraft[cuenta.id] ?? {
      fecha: cuenta.fechaEstimadaCobro ? new Date(cuenta.fechaEstimadaCobro).toISOString().slice(0, 10) : '',
      monto: cuenta.montoEstimadoCobro != null ? String(cuenta.montoEstimadoCobro) : '',
      notas: cuenta.notasCobro ?? '',
    };

  const handleGuardarCashflow = async (cuentaId: string) => {
    const d = cfDraft[cuentaId];
    if (!d) return;
    setCfSavingId(cuentaId);
    try {
      const res = await fetch(`/api/cuentas-corrientes/${cuentaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fechaEstimadaCobro: d.fecha || null,
          montoEstimadoCobro: d.monto ? parseFloat(d.monto) : null,
          notasCobro: d.notas || null,
        }),
      });
      if (!res.ok) { showToast('Error al guardar', true); return; }
      const updated = await res.json();
      setCuentas((prev) => prev.map((c) => (c.id === cuentaId ? serializeCuenta(updated) : c)));
      setCfDraft((prev) => { const next = { ...prev }; delete next[cuentaId]; return next; });
      showToast('Proyección guardada');
    } finally {
      setCfSavingId(null);
    }
  };

  // ── Registrar pago ────────────────────────────────────────────────────────
  const [pfTipo, setPfTipo] = useState<'ANTICIPO' | 'PAGO_PARCIAL'>('ANTICIPO');
  const [pfCaja, setPfCaja] = useState<'ARS' | 'USD'>('ARS');
  const [pfTipoCambio, setPfTipoCambio] = useState('');
  const [pfDescripcion, setPfDescripcion] = useState('');
  const [pfMonto, setPfMonto] = useState('');
  const [pfFactura, setPfFactura] = useState('');
  const [pfFecha, setPfFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [pfSaving, setPfSaving] = useState(false);

  const openPagoDialog = async (cuentaId: string) => {
    setActiveCuentaId(cuentaId);
    setPfTipo('ANTICIPO');
    setPfCaja('ARS');
    setPfTipoCambio('');
    setPfDescripcion('');
    setPfMonto('');
    setPfFactura('');
    setPfFecha(new Date().toISOString().slice(0, 10));
    setPagoOpen(true);
    // Pre-cargar tipo de cambio actual
    fetch('/api/tesoreria/tipo-cambio')
      .then((r) => r.json())
      .then((tc) => { if (tc?.valor) setPfTipoCambio(String(tc.valor)); })
      .catch(() => {});
  };

  const calcSaldoPago = () => {
    if (!activeCuentaId || !pfMonto) return null;
    const cuenta = cuentas.find((c) => c.id === activeCuentaId);
    if (!cuenta) return null;
    const monedaCuenta = cuenta.moneda ?? 'ARS';

    let montoParaRestar: number;
    let montoEnARS: number;

    if (monedaCuenta === 'USD') {
      // USD account: track in USD
      if (pfCaja === 'USD') {
        montoParaRestar = parseFloat(pfMonto);
        montoEnARS = pfTipoCambio ? parseFloat(pfMonto) * parseFloat(pfTipoCambio) : parseFloat(pfMonto);
      } else {
        const tc = parseFloat(pfTipoCambio || '0');
        if (!tc) return null;
        montoParaRestar = parseFloat(pfMonto) / tc; // ARS → USD
        montoEnARS = parseFloat(pfMonto);
      }
    } else {
      // ARS account
      if (pfCaja === 'USD') {
        const tc = parseFloat(pfTipoCambio || '0');
        if (!tc) return null;
        montoEnARS = parseFloat(pfMonto) * tc;
      } else {
        montoEnARS = parseFloat(pfMonto);
      }
      montoParaRestar = montoEnARS;
    }

    const idxActual     = Number(cuenta.indiceActual);
    const idxInicio     = Number(cuenta.indiceInicio);
    const montoOriginal = Number(cuenta.montoOriginal);
    const totalPagadoHasta = cuenta.movimientos
      .filter((m) => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL')
      .reduce((sum, m) => {
        if (monedaCuenta === 'USD') return sum + Number(m.equivalenteUSD ?? m.monto);
        return sum + Number(m.montoEnARS ?? m.monto);
      }, 0);
    const totalPagadoNuevo = totalPagadoHasta + montoParaRestar;
    const saldoBase       = montoOriginal - totalPagadoNuevo;
    const saldoResultante = saldoBase * (idxActual / idxInicio);
    return { saldoResultante, montoEnARS, montoParaRestar, monedaCuenta };
  };

  const handleRegistrarPago = async () => {
    if (!activeCuentaId || !pfDescripcion || !pfMonto || !pfFecha) {
      showToast('Completá los campos requeridos', true);
      return;
    }
    const cuentaParaPago = cuentas.find((c) => c.id === activeCuentaId);
    const esUSDAccount = cuentaParaPago?.moneda === 'USD';
    if ((pfCaja === 'USD' || (esUSDAccount && pfCaja === 'ARS')) && !pfTipoCambio) {
      showToast('Ingresá el tipo de cambio', true);
      return;
    }
    setPfSaving(true);
    const tcNum = pfTipoCambio ? parseFloat(pfTipoCambio) : null;
    const montoNum = parseFloat(pfMonto);
    const montoEnARSNum = pfCaja === 'USD' && tcNum ? montoNum * tcNum : montoNum;
    const equivalenteUSDNum = tcNum
      ? (pfCaja === 'USD' ? montoNum : montoNum / tcNum)
      : null;
    try {
      const res = await fetch(`/api/cuentas-corrientes/${activeCuentaId}/movimientos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: pfTipo,
          descripcion: pfDescripcion,
          monto: montoNum,
          numeroFactura: pfFactura || null,
          fecha: pfFecha,
          caja: pfCaja,
          tipoCambio: tcNum,
          montoEnARS: montoEnARSNum,
          equivalenteUSD: equivalenteUSDNum,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? 'Error al registrar pago', true);
        return;
      }
      const data = await res.json();
      let cuentaFresh = data.cuenta;
      if (!cuentaFresh) {
        const r2 = await fetch(`/api/cuentas-corrientes/${activeCuentaId}`);
        if (r2.ok) cuentaFresh = await r2.json();
      }
      if (cuentaFresh) {
        setCuentas((prev) => prev.map((c) => (c.id === activeCuentaId ? serializeCuenta(cuentaFresh) : c)));
      }
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
    setAfIndiceNuevo(indiceGlobal !== null ? String(indiceGlobal) : '');
    setActualizacionOpen(true);
  };

  const calcActualizacion = () => {
    if (!activeCuentaId || !afIndiceNuevo) return null;
    const cuenta = cuentas.find((c) => c.id === activeCuentaId);
    if (!cuenta) return null;
    const idxNuevo = parseFloat(afIndiceNuevo);
    const idxInicio = Number(cuenta.indiceInicio);
    if (!idxInicio) return null;
    const totalPagado = cuenta.movimientos
      .filter((m) => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL')
      .reduce((sum, m) => sum + Number(m.montoEnARS ?? m.monto), 0);
    const montoOriginal = Number(cuenta.montoOriginal);
    const saldoBase     = montoOriginal - totalPagado;
    const saldoNuevo    = saldoBase * (idxNuevo / idxInicio);
    const idxActual     = Number(cuenta.indiceActual);
    const saldoAnterior = saldoBase * (idxActual / idxInicio);
    const ajuste        = saldoNuevo - saldoAnterior;
    // montoAjustado: valor bruto sin pagos, solo para referencia en el UI
    const montoAjustado = montoOriginal * (idxNuevo / idxInicio);
    const variacion     = ((idxNuevo / idxInicio - 1) * 100).toFixed(2);
    return { ajuste, saldoNuevo, montoAjustado, variacion, totalPagado };
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
      const data = await res.json();
      let cuentaFresh = data.cuenta;
      if (!cuentaFresh) {
        const r2 = await fetch(`/api/cuentas-corrientes/${activeCuentaId}`);
        if (r2.ok) cuentaFresh = await r2.json();
      }
      if (cuentaFresh) {
        setCuentas((prev) => prev.map((c) => (c.id === activeCuentaId ? serializeCuenta(cuentaFresh) : c)));
      }
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
  const [emCaja, setEmCaja] = useState<string>('ARS');
  const [emTipoCambio, setEmTipoCambio] = useState('');
  const [emSaving, setEmSaving] = useState(false);

  const openEditMovDialog = (cuentaId: string, mov: MovimientoSerializado) => {
    setActiveCuentaId(cuentaId);
    setActiveMovimiento(mov);
    setEmDescripcion(mov.descripcion);
    setEmMonto(Number(mov.monto).toFixed(2));
    setEmFactura(mov.numeroFactura ?? '');
    setEmFecha(new Date(mov.fecha).toISOString().slice(0, 10));
    setEmCaja(mov.caja ?? 'ARS');
    setEmTipoCambio(mov.tipoCambio != null ? String(mov.tipoCambio) : '');
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
            caja: emCaja || null,
            tipoCambio: emTipoCambio ? parseFloat(emTipoCambio) : null,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? 'Error al editar movimiento', true);
        return;
      }
      const cuentaActualizada = await res.json();
      setCuentas((prev) => prev.map((c) => (c.id === activeCuentaId ? serializeCuenta(cuentaActualizada) : c)));
      setEditMovOpen(false);
      showToast('Movimiento actualizado');
    } finally {
      setEmSaving(false);
    }
  };

  // ── Eliminar cuenta corriente ─────────────────────────────────────────────
  const [deletingCuentaId, setDeletingCuentaId] = useState<string | null>(null);

  const handleEliminarCuenta = async (cuentaId: string) => {
    if (!confirm('¿Eliminar esta cuenta corriente? Esta acción es irreversible y eliminará todos los movimientos asociados.')) return;
    setDeletingCuentaId(cuentaId);
    try {
      const res = await fetch(`/api/cuentas-corrientes/${cuentaId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? 'Error al eliminar cuenta', true);
        return;
      }
      setCuentas((prev) => prev.filter((c) => c.id !== cuentaId));
      showToast('Cuenta corriente eliminada');
    } finally {
      setDeletingCuentaId(null);
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
      setCuentas((prev) => prev.map((c) => (c.id === cuentaId ? serializeCuenta(cuentaActualizada) : c)));
      showToast('Movimiento eliminado');
    } finally {
      setDeletingMovId(null);
    }
  };

  // ── PDF consolidado por cliente ───────────────────────────────────────────
  const [dialogPDFCliente, setDialogPDFCliente] = useState(false);
  const [clientesConCuentas, setClientesConCuentas] = useState<{ id: string; razonSocial: string; _count: { cuentasCorrientes: number } }[]>([]);
  const [pdfClienteId, setPdfClienteId] = useState('');
  const [pdfGenerando, setPdfGenerando] = useState(false);

  useEffect(() => {
    fetch('/api/cuentas-corrientes/clientes-con-cuentas')
      .then((r) => r.json())
      .then((d) => setClientesConCuentas(d))
      .catch(() => {});
  }, []);

  const handleGenerarPDFCliente = async () => {
    if (!pdfClienteId) return;
    setPdfGenerando(true);
    try {
      const res = await fetch(`/api/cuentas-corrientes/pdf-cliente?clienteId=${pdfClienteId}`);
      if (!res.ok) throw new Error('Error al obtener datos');
      const { cliente, cuentas } = await res.json();
      const { generarPDFClienteConsolidado } = await import('@/lib/pdf/generar-cuenta-corriente-cliente');
      await generarPDFClienteConsolidado(cliente, cuentas);
      setDialogPDFCliente(false);
      showToast('PDF generado correctamente');
    } catch {
      showToast('Error al generar el PDF', true);
    } finally {
      setPdfGenerando(false);
    }
  };

  // ── Vincular obra ─────────────────────────────────────────────────────────
  const [vinObraOpen, setVinObraOpen] = useState(false);
  const [vinObraCuentaId, setVinObraCuentaId] = useState<string | null>(null);
  const [vinObras, setVinObras] = useState<Obra[]>([]);
  const [vinObraSelected, setVinObraSelected] = useState('');
  const [vinObraSaving, setVinObraSaving] = useState(false);

  const openVinObraDialog = async (cuenta: CuentaConRelaciones) => {
    setVinObraCuentaId(cuenta.id);
    setVinObraSelected('');
    setVinObras([]);
    setVinObraOpen(true);
    const res = await fetch(`/api/clientes/${cuenta.cliente.id}/obras`);
    if (res.ok) {
      const d = await res.json();
      setVinObras(d.obras ?? []);
    }
  };

  const handleVincularObra = async () => {
    if (!vinObraCuentaId || !vinObraSelected) return;
    setVinObraSaving(true);
    try {
      const res = await fetch(`/api/cuentas-corrientes/${vinObraCuentaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obraId: vinObraSelected }),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast(err.error ?? 'Error al vincular obra', true);
        return;
      }
      const cuentaActualizada = await res.json();
      setCuentas((prev) => prev.map((c) => (c.id === vinObraCuentaId ? serializeCuenta(cuentaActualizada) : c)));
      setVinObraOpen(false);
      showToast('Obra vinculada correctamente');
    } finally {
      setVinObraSaving(false);
    }
  };

  // ── Exportar PDF ──────────────────────────────────────────────────────────
  const handleExportarPDF = async (cuenta: CuentaConRelaciones) => {
    const { generarCuentaCorrientePDF } = await import('@/lib/pdf/generar-cuenta-corriente');
    await generarCuentaCorrientePDF({
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
      moneda: cuenta.moneda ?? 'ARS',
      movimientos: cuenta.movimientos.map((m) => ({
        fecha: m.fecha,
        tipo: m.tipo,
        descripcion: m.descripcion,
        numeroFactura: m.numeroFactura,
        monto: Number(m.monto),
        montoEnARS: m.montoEnARS != null ? Number(m.montoEnARS) : null,
        equivalenteUSD: m.equivalenteUSD != null ? Number(m.equivalenteUSD) : null,
        caja: m.caja ?? null,
        tipoCambio: m.tipoCambio != null ? Number(m.tipoCambio) : null,
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => { setPdfClienteId(''); setDialogPDFCliente(true); }}
            className="border-[#00ADEF] text-[#00ADEF] hover:bg-[#00ADEF]/10"
          >
            <Download className="w-4 h-4 mr-2" />
            PDF por cliente
          </Button>
          <Button
            onClick={() => setNuevaOpen(true)}
            className="bg-[#00ADEF] hover:bg-[#0089C7] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva cuenta
          </Button>
        </div>
      </div>

      {/* Banner: presupuestos aprobados sin cuenta corriente */}
      {bannerVisible && presupuestosSinCuenta.length > 0 && (
        <div className="bg-[#FAEEDA] border border-[#F5C075] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#633806] shrink-0" />
              <span className="font-semibold text-[#633806]">Presupuestos aprobados sin cuenta corriente</span>
              <Badge className="bg-[#F5C075] text-[#633806] border-0 ml-1">
                {presupuestosSinCuenta.length} pendiente{presupuestosSinCuenta.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <button onClick={handleDismissBanner} className="text-[#633806] hover:text-[#3a2003] p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {presupuestosSinCuenta.slice(0, showAllBanner ? undefined : 3).map((ps) => (
              <div key={ps.id} className="flex items-center justify-between bg-white/60 rounded px-3 py-2 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#633806] truncate">
                    N° {String(ps.numero).padStart(4, '0')} — {ps.cliente.razonSocial} — {ps.obra?.nombre ?? 'Sin obra'}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-sm font-bold text-[#633806]">
                      {ps.moneda === 'USD'
                        ? `U$D ${Number(ps.precioFinal ?? ps.totalFinal).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : formatCurrency(Number(ps.precioFinal ?? ps.totalFinal))}
                    </span>
                    <span className="text-xs text-[#8a6030]">
                      Aprobado el {formatDate(new Date(ps.fechaCreacion))}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-[#00ADEF] hover:bg-[#0089C7] text-white shrink-0"
                  onClick={() => handleAbrirDesdeBanner(ps)}
                  disabled={bannerLoadingId === ps.id}
                >
                  {bannerLoadingId === ps.id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <><Plus className="w-3 h-3 mr-1" />Añadir</>
                  }
                </Button>
              </div>
            ))}
          </div>
          {presupuestosSinCuenta.length > 3 && (
            <button
              className="mt-2 text-xs text-[#633806] underline hover:no-underline"
              onClick={() => setShowAllBanner((v) => !v)}
            >
              {showAllBanner ? 'Ver menos' : `Ver todos (${presupuestosSinCuenta.length})`}
            </button>
          )}
        </div>
      )}

      {/* Índice global bar */}
      <div className="flex items-center justify-between bg-[#E6F4FB] border border-[#00ADEF]/30 rounded-lg px-4 py-2.5 text-sm">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-4 h-4 text-[#00ADEF] shrink-0" />
          <span className="font-semibold text-[#0C447C]">{indiceGlobalNombre}</span>
          {indiceGlobal !== null ? (
            <span className="text-[#1A1A1A] font-mono font-bold">{fmtIndice(indiceGlobal)}</span>
          ) : (
            <span className="text-gray-400 italic text-xs">Cargando…</span>
          )}
          {indiceGlobalFecha && (
            <span className="text-[#4A4A4A] text-xs hidden sm:inline">
              — actualizado {new Date(indiceGlobalFecha).toLocaleDateString('es-AR')}
            </span>
          )}
        </div>
        {editandoIndice ? (
          <div className="flex items-center gap-2">
            <Input
              className="h-7 w-28 text-xs"
              placeholder="Nombre"
              value={indiceEditNombre}
              onChange={(e) => setIndiceEditNombre(e.target.value)}
            />
            <Input
              type="number"
              step="0.0001"
              className="h-7 w-32 text-xs font-mono"
              placeholder="Valor"
              value={indiceEditValor}
              onChange={(e) => setIndiceEditValor(e.target.value)}
            />
            <Button size="sm" className="h-7 text-xs bg-[#00ADEF] hover:bg-[#0089C7] text-white" onClick={handleGuardarIndice} disabled={indiceEditSaving}>
              {indiceEditSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Guardar'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditandoIndice(false)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-[#0C447C] hover:bg-[#00ADEF]/10"
            onClick={() => {
              setIndiceEditValor(indiceGlobal !== null ? String(indiceGlobal) : '');
              setIndiceEditNombre(indiceGlobalNombre);
              setEditandoIndice(true);
            }}
          >
            <Edit className="w-3 h-3 mr-1" />
            Actualizar
          </Button>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#D4B896]/40 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            <DollarSign className="w-3.5 h-3.5" />
            Total facturado
          </div>
          <p className="text-2xl font-bold text-[#1A1A1A]">{formatCurrency(totalFacturado)}</p>
          {totalFacturadoUSD > 0 && (
            <p className="text-xs text-green-700 mt-1">+ U$D {totalFacturadoUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-[#D4B896]/40 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            <CreditCard className="w-3.5 h-3.5" />
            Total cobrado
          </div>
          <p className="text-2xl font-bold text-[#1A1A1A]">{formatCurrency(totalCobrado)}</p>
          {totalCobradoUSD > 0 && (
            <p className="text-xs text-green-700 mt-1">+ U$D {totalCobradoUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-[#D4B896]/40 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            <FileText className="w-3.5 h-3.5" />
            Saldo pendiente
          </div>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(saldoPendienteTotal)}</p>
          {saldoPendienteTotalUSD > 0 && (
            <p className="text-xs text-red-600 mt-1">+ U$D {saldoPendienteTotalUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-[#D4B896]/40 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            <TrendingUp className="w-3.5 h-3.5" />
            Cuentas activas
          </div>
          <p className="text-2xl font-bold text-[#00ADEF]">{cuentasActivas}</p>
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
      <div className="space-y-4">
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

          const esUSD = cuenta.moneda === 'USD';
          const totalCobradoCuenta = movsSorted
            .filter((m) => m.tipo === 'ANTICIPO' || m.tipo === 'PAGO_PARCIAL')
            .reduce((s, m) => {
              if (esUSD) return s + Number(m.equivalenteUSD ?? m.monto);
              return s + Number(m.montoEnARS ?? m.monto);
            }, 0);

          const progresoPct =
            Number(cuenta.saldoActualizado) > 0
              ? Math.min(100, (totalCobradoCuenta / Number(cuenta.saldoActualizado)) * 100)
              : 0;

          const cancelado = cuenta.estado === 'CANCELADO';

          return (
            <div
              key={cuenta.id}
              className="bg-white border border-[#D4B896]/50 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)]"
            >
              {/* Collapsed header */}
              <button
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#F8FAFB] transition-colors text-left"
                onClick={() => toggleExpand(cuenta.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[#1A1A1A] text-[15px]">
                      {cuenta.cliente.razonSocial}
                    </span>
                    {cuenta.moneda === 'USD' && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">U$D</span>
                    )}
                    {cuenta.obra && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="text-sm font-medium text-slate-600">{cuenta.obra.nombre}</span>
                      </>
                    )}
                    {!cuenta.obra && (
                      <span className="text-sm text-slate-400">Sin obra</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {cuenta.presupuesto
                      ? `Presupuesto N° ${String(cuenta.presupuesto.numero).padStart(4, '0')} · `
                      : ''}
                    Inicio: {formatDate(cuenta.fechaInicio)}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-4">
                  <div className="text-right">
                    {cancelado ? (
                      <span className="text-base font-bold text-green-700">Saldado</span>
                    ) : esUSD ? (
                      <span className="text-base font-bold text-red-600">
                        U$D {Number(cuenta.saldoActualizado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-base font-bold text-red-600">
                        {formatCurrency(Number(cuenta.saldoActualizado))}
                      </span>
                    )}
                  </div>
                  <Badge className={`${ESTADO_BADGE_STYLE[cuenta.estado] ?? ''} text-xs px-3 py-1`}>
                    {ESTADO_LABELS[cuenta.estado] ?? cuenta.estado}
                  </Badge>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t px-5 pb-5 space-y-4">
                  {/* Index info row */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                    <div className="bg-gray-50 rounded-md p-3">
                      <p className="text-xs text-gray-400">{cuenta.nombreIndice} — Índice inicio</p>
                      <p className="text-sm font-semibold text-[#1A1A1A] mt-0.5">
                        {fmtIndice(cuenta.indiceInicio)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-md p-3">
                      <p className="text-xs text-gray-400">Monto contrato</p>
                      <p className="text-sm font-semibold text-[#1A1A1A] mt-0.5">
                        {esUSD
                          ? `U$D ${Number(cuenta.montoOriginal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                          : formatCurrency(Number(cuenta.montoOriginal))}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-md p-3">
                      <p className="text-xs text-gray-400">Saldo pendiente actualizado</p>
                      <p className="text-sm font-semibold text-red-600 mt-0.5">
                        {esUSD
                          ? `U$D ${Number(cuenta.saldoActualizado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                          : formatCurrency(Number(cuenta.saldoActualizado))}
                      </p>
                      {!esUSD && (
                        <p className="text-xs text-gray-400 mt-1">
                          Monto ajustado: {formatCurrency(Number(cuenta.montoOriginal) * (Number(cuenta.indiceActual) / Number(cuenta.indiceInicio)))}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Cobrado: {esUSD ? `U$D ${totalCobradoCuenta.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : formatCurrency(totalCobradoCuenta)}</span>
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
                          <TableHead className="w-16">Caja</TableHead>
                          <TableHead className="w-32 text-right">Monto</TableHead>
                          <TableHead className="w-32 text-right">Saldo</TableHead>
                          <TableHead className="w-20">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movsSorted.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-gray-400 text-sm">
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
                            <TableCell className="text-sm">
                              <div>{mov.descripcion}</div>
                              {mov.tipoCambio != null && esUSD && mov.caja === 'ARS' && (
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {`$ ${Number(mov.montoEnARS ?? mov.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS ÷ TC $${Number(mov.tipoCambio).toLocaleString('es-AR')}`}
                                </div>
                              )}
                              {mov.tipoCambio != null && !esUSD && mov.caja === 'USD' && (
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {`U$D ${Number(mov.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })} × TC $${Number(mov.tipoCambio).toLocaleString('es-AR')}`}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {mov.numeroFactura ?? '—'}
                            </TableCell>
                            <TableCell>
                              {mov.caja === 'USD' ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-[#EAF3DE] text-[#27500A]">U$D</span>
                              ) : mov.caja === 'ARS' ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-[#E6F1FB] text-[#0C447C]">$</span>
                              ) : (
                                <span className="text-gray-400 text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-right font-medium">
                              {mov.tipo === 'ANTICIPO' || mov.tipo === 'PAGO_PARCIAL' ? (
                                <span className="text-red-600">
                                  −{mov.caja === 'USD'
                                    ? `U$D ${Number(mov.monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : formatCurrency(Number(mov.monto))}
                                </span>
                              ) : (
                                <span className="text-green-700">
                                  +{esUSD
                                    ? `U$D ${Number(mov.monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : formatCurrency(Number(mov.monto))}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-right font-semibold">
                              {esUSD
                                ? `U$D ${Number(mov.saldoResultante).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : formatCurrency(Number(mov.saldoResultante))}
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

                  {/* Proyección de cobro */}
                  {!cancelado && (() => {
                    const draft = getCfDraft(cuenta);
                    const isDirty = cfDraft[cuenta.id] !== undefined;
                    return (
                      <div className="bg-blue-50/50 border border-blue-100 rounded-md p-3 space-y-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Proyección de cobro</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Fecha estimada</Label>
                            <Input
                              type="date"
                              value={draft.fecha}
                              className="h-8 text-xs mt-1"
                              onChange={(e) => setCfDraft((p) => ({ ...p, [cuenta.id]: { ...getCfDraft(cuenta), fecha: e.target.value } }))}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Monto estimado ($)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={draft.monto}
                              className="h-8 text-xs mt-1"
                              onChange={(e) => setCfDraft((p) => ({ ...p, [cuenta.id]: { ...getCfDraft(cuenta), monto: e.target.value } }))}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Notas</Label>
                            <Input
                              value={draft.notas}
                              placeholder="Notas de cobro..."
                              className="h-8 text-xs mt-1"
                              onChange={(e) => setCfDraft((p) => ({ ...p, [cuenta.id]: { ...getCfDraft(cuenta), notas: e.target.value } }))}
                            />
                          </div>
                        </div>
                        {isDirty && (
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-[#00ADEF] hover:bg-[#0089C7] text-white"
                              onClick={() => handleGuardarCashflow(cuenta.id)}
                              disabled={cfSavingId === cuenta.id}
                            >
                              {cfSavingId === cuenta.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                              Guardar proyección
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

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
                    {!cuenta.obra && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openVinObraDialog(cuenta)}
                        className="border-slate-300 text-slate-500 hover:bg-slate-50"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Vincular obra
                      </Button>
                    )}
                    {EMAILS_ELIMINAR_CC.includes(userEmail) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEliminarCuenta(cuenta.id)}
                        disabled={deletingCuentaId === cuenta.id}
                        className="border-red-200 text-red-500 hover:bg-red-50 ml-auto"
                      >
                        {deletingCuentaId === cuenta.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Eliminar CC
                      </Button>
                    )}
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
                        N° {String(p.numero).padStart(4, '0')} — {formatCurrency(Number(p.precioFinal ?? p.totalFinal ?? 0))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="mb-1.5 block">Moneda de la cuenta</Label>
              <div className="flex gap-3">
                {(['ARS', 'USD'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setNfMoneda(m)}
                    className={`flex-1 py-2 px-4 rounded-md border text-sm font-medium transition-colors ${
                      nfMoneda === m
                        ? m === 'USD'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-[#00ADEF] bg-[#E6F1FB] text-[#0C447C]'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {m === 'ARS' ? '$ ARS — Pesos' : 'U$D USD — Dólares'}
                  </button>
                ))}
              </div>
            </div>
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
              <Label className="mb-1.5 block">Moneda / Caja *</Label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPfCaja('ARS')}
                  style={{
                    flex: 1, padding: '10px',
                    borderRadius: 'var(--radius)',
                    border: pfCaja === 'ARS' ? '2px solid #00ADEF' : '0.5px solid #e2e8f0',
                    background: pfCaja === 'ARS' ? '#E6F1FB' : 'white',
                    color: pfCaja === 'ARS' ? '#0C447C' : '#1A1A1A',
                    fontWeight: pfCaja === 'ARS' ? 500 : 400,
                    cursor: 'pointer', fontSize: '14px',
                  }}
                >
                  $ Pesos (ARS)
                </button>
                <button
                  type="button"
                  onClick={() => setPfCaja('USD')}
                  style={{
                    flex: 1, padding: '10px',
                    borderRadius: 'var(--radius)',
                    border: pfCaja === 'USD' ? '2px solid #27500A' : '0.5px solid #e2e8f0',
                    background: pfCaja === 'USD' ? '#EAF3DE' : 'white',
                    color: pfCaja === 'USD' ? '#27500A' : '#1A1A1A',
                    fontWeight: pfCaja === 'USD' ? 500 : 400,
                    cursor: 'pointer', fontSize: '14px',
                  }}
                >
                  U$D Dólares (USD)
                </button>
              </div>
            </div>
            <div>
              <Label>Monto *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={pfMonto}
                onChange={(e) => setPfMonto(e.target.value)}
              />
              {pfMonto && (
                <p className="text-xs text-gray-500 mt-1">
                  {pfCaja === 'ARS'
                    ? `$ ${parseFloat(pfMonto || '0').toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                    : `U$D ${parseFloat(pfMonto || '0').toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                </p>
              )}
            </div>
            <div>
              <Label>Tipo de cambio {(pfCaja === 'USD' || (activeCuenta?.moneda === 'USD' && pfCaja === 'ARS')) ? '*' : '(opcional)'}</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <span style={{ fontSize: '13px', color: '#4A4A4A', whiteSpace: 'nowrap' }}>$ 1 U$D =</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ej: 1145.00"
                  value={pfTipoCambio}
                  onChange={(e) => setPfTipoCambio(e.target.value)}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: '13px', color: '#4A4A4A' }}>ARS</span>
              </div>
              {pfMonto && pfTipoCambio && (
                <p className="text-xs text-gray-500 mt-1">
                  {pfCaja === 'ARS'
                    ? `≈ U$D ${(parseFloat(pfMonto) / parseFloat(pfTipoCambio)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                    : `≡ $ ${(parseFloat(pfMonto) * parseFloat(pfTipoCambio)).toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS`}
                </p>
              )}
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
            {pfMonto && (() => {
              const calc = calcSaldoPago();
              if (!calc) return null;
              const isUSDAccount = calc.monedaCuenta === 'USD';
              return (
                <div className="bg-gray-50 rounded-md p-3 text-sm space-y-1">
                  {pfCaja === 'USD' && pfTipoCambio && !isUSDAccount && (
                    <div className="text-xs text-gray-500">
                      Monto: U$D {parseFloat(pfMonto).toLocaleString('es-AR', { minimumFractionDigits: 2 })} × ${parseFloat(pfTipoCambio).toLocaleString('es-AR')} = {formatCurrency(calc.montoEnARS)} ARS
                    </div>
                  )}
                  {isUSDAccount && pfCaja === 'ARS' && pfTipoCambio && (
                    <div className="text-xs text-gray-500">
                      Monto ARS: {formatCurrency(calc.montoEnARS)} ÷ ${parseFloat(pfTipoCambio).toLocaleString('es-AR')} = U$D {calc.montoParaRestar.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">Saldo resultante: </span>
                    <span className={`font-semibold ${calc.saldoResultante < 0 ? 'text-red-600' : 'text-[#1A1A1A]'}`}>
                      {isUSDAccount
                        ? `U$D ${calc.saldoResultante.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                        : formatCurrency(calc.saldoResultante)}
                    </span>
                  </div>
                </div>
              );
            })()}
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
                <Label>Índice inicio</Label>
                <Input
                  value={activeCuenta ? fmtIndice(activeCuenta.indiceInicio) : ''}
                  readOnly
                  className="bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
              <div>
                <Label>Índice actual *</Label>
                <Input
                  type="number"
                  step="0.0001"
                  placeholder="0.0000"
                  value={afIndiceNuevo}
                  onChange={(e) => setAfIndiceNuevo(e.target.value)}
                />
              </div>
            </div>
            {afIndiceNuevo && (() => {
              const calc = calcActualizacion();
              if (!calc) return null;
              return (
                <div className="mt-3 space-y-1.5 text-sm border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Variación respecto al inicio:</span>
                    <span className={parseFloat(calc.variacion) >= 0 ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
                      {parseFloat(calc.variacion) >= 0 ? '+' : ''}{calc.variacion}%
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-gray-700">Saldo resultante:</span>
                    <span className="text-red-600">{formatCurrency(calc.saldoNuevo)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Monto ajustado bruto:</span>
                    <span>{formatCurrency(calc.montoAjustado)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Menos pagos registrados:</span>
                    <span>− {formatCurrency(calc.totalPagado)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-0.5">
                    <span className="text-gray-500">Ajuste a aplicar:</span>
                    <span className={calc.ajuste >= 0 ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
                      {calc.ajuste >= 0 ? '+' : ''}{formatCurrency(Math.abs(calc.ajuste))}
                    </span>
                  </div>
                </div>
              );
            })()}
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
            <div>
              <Label className="mb-1.5 block">Caja</Label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['ARS', 'USD'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEmCaja(c)}
                    style={{
                      flex: 1, padding: '8px',
                      borderRadius: 'var(--radius)',
                      border: emCaja === c ? (c === 'ARS' ? '2px solid #00ADEF' : '2px solid #27500A') : '0.5px solid #e2e8f0',
                      background: emCaja === c ? (c === 'ARS' ? '#E6F1FB' : '#EAF3DE') : 'white',
                      color: emCaja === c ? (c === 'ARS' ? '#0C447C' : '#27500A') : '#1A1A1A',
                      fontWeight: emCaja === c ? 500 : 400,
                      cursor: 'pointer', fontSize: '13px',
                    }}
                  >
                    {c === 'ARS' ? '$ Pesos' : 'U$D Dólares'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Tipo de cambio {emCaja === 'USD' ? '(obligatorio)' : '(opcional)'}</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <span style={{ fontSize: '13px', color: '#4A4A4A', whiteSpace: 'nowrap' }}>$ 1 U$D =</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ej: 1145.00"
                  value={emTipoCambio}
                  onChange={(e) => setEmTipoCambio(e.target.value)}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: '13px', color: '#4A4A4A' }}>ARS</span>
              </div>
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

      {/* ── Dialog: Vincular obra ───────────────────────────────────────── */}
      <Dialog open={vinObraOpen} onOpenChange={setVinObraOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Vincular obra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {vinObras.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                {vinObraOpen ? 'Cargando obras...' : 'Sin obras disponibles para este cliente.'}
              </p>
            ) : (
              <div>
                <Label>Seleccionar obra</Label>
                <Select value={vinObraSelected || 'none'} onValueChange={(v) => setVinObraSelected(v === 'none' ? '' : v)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Elegir obra..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Seleccionar —</SelectItem>
                    {vinObras.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVinObraOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleVincularObra}
              disabled={vinObraSaving || !vinObraSelected}
              className="bg-[#00ADEF] hover:bg-[#0089C7] text-white"
            >
              {vinObraSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: PDF consolidado por cliente ────────────────────────── */}
      <Dialog open={dialogPDFCliente} onOpenChange={setDialogPDFCliente}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Exportar PDF por cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1.5 block">Seleccionar cliente</Label>
              <Select value={pdfClienteId || 'none'} onValueChange={(v) => setPdfClienteId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegir cliente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Seleccionar —</SelectItem>
                  {clientesConCuentas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.razonSocial}
                      <span className="ml-2 text-xs text-slate-400">({c._count.cuentasCorrientes})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-slate-400">
              Genera un PDF con el resumen consolidado y el detalle de movimientos de todas las cuentas del cliente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogPDFCliente(false)}>Cancelar</Button>
            <Button
              onClick={handleGenerarPDFCliente}
              disabled={pdfGenerando || !pdfClienteId}
              className="bg-[#00ADEF] hover:bg-[#0089C7] text-white"
            >
              {pdfGenerando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
              Generar PDF
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

