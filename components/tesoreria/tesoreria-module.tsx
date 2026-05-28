'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeftRight, Plus, Pencil, CheckCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type TipoCaja = 'ARS' | 'USD';

type Movimiento = {
  id: string; caja: TipoCaja; tipo: string; descripcion: string;
  monto: number; saldoResultante: number; fecha: string; traspasoId?: string | null;
};

type Traspaso = {
  id: string; cajaOrigen: TipoCaja; cajaDestino: TipoCaja;
  montoOrigen: number; montoDestino: number; tipoCambioUsado: number;
  descripcion?: string | null; fecha: string;
};

type Canje = {
  id: string; nombre: string; tipo: string; descripcion?: string | null;
  fechaRecepcion: string; valorEntrada: number; valorEstimado: number;
  estado: string; fechaRealizacion?: string | null;
  valorVenta?: number | null; gananciaUSD?: number | null; observaciones?: string | null;
};

type TipoCambioInfo = { id: string; valor: number; fecha: string };

type Resumen = {
  saldoARS: number; saldoUSD: number;
  tipoCambioActual: TipoCambioInfo | null;
  saldoARSenUSD: number; saldoUSDenARS: number;
  totalCanjesNoLiquidos: number;
  countCanjes: { total: number; noLiquido: number; realizado: number };
  movimientosRecientes: Movimiento[];
};

// ─── Formatters ──────────────────────────────────────────────────────────────

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
const fmtUSD = (n: number) =>
  `U$D ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
const fmtFecha = (s: string) => new Date(s).toLocaleDateString('es-AR');
const fmtNum = (caja: TipoCaja, n: number) => (caja === 'ARS' ? fmtARS(n) : fmtUSD(n));

// ─── Badges ──────────────────────────────────────────────────────────────────

const TIPO_BADGE: Record<string, string> = {
  INGRESO: 'bg-green-100 text-green-700',
  EGRESO: 'bg-red-100 text-red-700',
  TRASPASO_ENTRADA: 'bg-violet-100 text-violet-700',
  TRASPASO_SALIDA: 'bg-violet-100 text-violet-700',
  CANJE_REALIZADO: 'bg-yellow-100 text-yellow-700',
};

const TIPO_LABEL: Record<string, string> = {
  INGRESO: 'Ingreso', EGRESO: 'Egreso',
  TRASPASO_ENTRADA: 'Traspaso entrada', TRASPASO_SALIDA: 'Traspaso salida',
  CANJE_REALIZADO: 'Canje realizado',
};

const CAJA_BADGE: Record<TipoCaja, string> = {
  ARS: 'bg-sky-100 text-sky-700',
  USD: 'bg-amber-100 text-amber-700',
};

function TipoBadge({ tipo }: { tipo: string }) {
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', TIPO_BADGE[tipo] ?? 'bg-slate-100 text-slate-600')}>
      {TIPO_LABEL[tipo] ?? tipo}
    </span>
  );
}

function CajaBadge({ caja }: { caja: TipoCaja }) {
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', CAJA_BADGE[caja])}>
      {caja}
    </span>
  );
}

// ─── Today helper ─────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TesoreriaModule() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [movimientosARS, setMovimientosARS] = useState<Movimiento[]>([]);
  const [movimientosUSD, setMovimientosUSD] = useState<Movimiento[]>([]);
  const [canjes, setCanjes] = useState<Canje[]>([]);
  const [traspasos, setTraspasos] = useState<Traspaso[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Dialog states ──
  const [dlgMov, setDlgMov] = useState<{ open: boolean; caja: TipoCaja; tipo: 'INGRESO' | 'EGRESO' } | null>(null);
  const [dlgTraspaso, setDlgTraspaso] = useState(false);
  const [dlgTC, setDlgTC] = useState(false);
  const [dlgNuevoCanje, setDlgNuevoCanje] = useState(false);
  const [dlgRealizarCanje, setDlgRealizarCanje] = useState<{ open: boolean; canje: Canje | null }>({ open: false, canje: null });
  const [dlgEditCanje, setDlgEditCanje] = useState<{ open: boolean; canje: Canje | null }>({ open: false, canje: null });

  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Fetch ──
  const fetchAll = useCallback(async () => {
    const [rRes, arsRes, usdRes, canjesRes, traspasosRes] = await Promise.all([
      fetch('/api/tesoreria/resumen'),
      fetch('/api/tesoreria/movimientos?caja=ARS&limit=200'),
      fetch('/api/tesoreria/movimientos?caja=USD&limit=200'),
      fetch('/api/tesoreria/canjes'),
      fetch('/api/tesoreria/traspasos'),
    ]);
    if (rRes.ok) setResumen(await rRes.json());
    if (arsRes.ok) setMovimientosARS((await arsRes.json()).movimientos);
    if (usdRes.ok) setMovimientosUSD((await usdRes.json()).movimientos);
    if (canjesRes.ok) setCanjes(await canjesRes.json());
    if (traspasosRes.ok) setTraspasos(await traspasosRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const tc = resumen?.tipoCambioActual?.valor ?? 1145;

  // ── Handlers ──
  async function handleMovimiento(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dlgMov) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/tesoreria/movimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caja: dlgMov.caja, tipo: dlgMov.tipo, descripcion: fd.get('descripcion'), monto: fd.get('monto'), fecha: fd.get('fecha') }),
    });
    setSaving(false);
    if (res.ok) { setDlgMov(null); fetchAll(); }
  }

  async function handleTraspaso(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/tesoreria/traspasos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cajaOrigen: fd.get('cajaOrigen'), cajaDestino: fd.get('cajaDestino'),
        montoOrigen: fd.get('montoOrigen'), tipoCambioUsado: fd.get('tipoCambioUsado'),
        descripcion: fd.get('descripcion'), fecha: fd.get('fecha'),
      }),
    });
    setSaving(false);
    if (res.ok) { setDlgTraspaso(false); fetchAll(); }
  }

  async function handleActualizarTC(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/tesoreria/tipo-cambio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: fd.get('valor') }),
    });
    setSaving(false);
    if (res.ok) { setDlgTC(false); fetchAll(); }
  }

  async function handleNuevoCanje(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/tesoreria/canjes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: fd.get('nombre'), tipo: fd.get('tipo'), descripcion: fd.get('descripcion'),
        fechaRecepcion: fd.get('fechaRecepcion'), valorEntrada: fd.get('valorEntrada'),
        valorEstimado: fd.get('valorEstimado') || fd.get('valorEntrada'),
        observaciones: fd.get('observaciones'),
      }),
    });
    setSaving(false);
    if (res.ok) { setDlgNuevoCanje(false); fetchAll(); }
  }

  async function handleRealizarCanje(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dlgRealizarCanje.canje) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/tesoreria/canjes/${dlgRealizarCanje.canje.id}/realizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fechaRealizacion: fd.get('fechaRealizacion'), valorVenta: fd.get('valorVenta'), descripcion: fd.get('descripcion') }),
    });
    setSaving(false);
    if (res.ok) { setDlgRealizarCanje({ open: false, canje: null }); fetchAll(); }
  }

  async function handleEditCanje(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dlgEditCanje.canje) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/tesoreria/canjes/${dlgEditCanje.canje.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valorEstimado: fd.get('valorEstimado'), descripcion: fd.get('descripcion'), observaciones: fd.get('observaciones') }),
    });
    setSaving(false);
    if (res.ok) { setDlgEditCanje({ open: false, canje: null }); fetchAll(); }
  }

  async function handleDeleteMovimiento(id: string) {
    const res = await fetch(`/api/tesoreria/movimientos/${id}`, { method: 'DELETE' });
    if (res.ok) { setDeleteId(null); fetchAll(); }
  }

  if (loading) return <div className="p-8 text-slate-500">Cargando tesorería…</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tesorería</h1>
          <p className="text-slate-500 text-sm">Gestión de cajas ARS y USD</p>
        </div>
        <Button onClick={() => setDlgTraspaso(true)} className="bg-[#00ADEF] hover:bg-[#0095cc] text-white">
          <ArrowLeftRight className="h-4 w-4 mr-2" /> Traspaso ARS ↔ USD
        </Button>
      </div>

      <Tabs defaultValue="resumen">
        <TabsList className="mb-4">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="ars">Caja ARS</TabsTrigger>
          <TabsTrigger value="usd">Caja USD</TabsTrigger>
          <TabsTrigger value="canjes">Canjes</TabsTrigger>
          <TabsTrigger value="traspasos">Traspasos</TabsTrigger>
        </TabsList>

        {/* ── TAB RESUMEN ── */}
        <TabsContent value="resumen" className="space-y-4">
          {/* TC card */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-5 py-3">
            <div>
              <p className="text-xs text-slate-500">Tipo de cambio activo</p>
              <p className="text-lg font-bold text-slate-800">
                TC: {fmtARS(tc).replace('$', '$')} / U$D
                {resumen?.tipoCambioActual && (
                  <span className="text-sm font-normal text-slate-400 ml-2">
                    · Actualizado: {fmtFecha(resumen.tipoCambioActual.fecha)}
                  </span>
                )}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setDlgTC(true)}>Actualizar TC</Button>
          </div>

          {/* 3 cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ARS */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Caja ARS</span>
                <CajaBadge caja="ARS" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{fmtARS(resumen?.saldoARS ?? 0)}</p>
              <p className="text-xs text-slate-400">≈ {fmtUSD(resumen?.saldoARSenUSD ?? 0)} (TC actual)</p>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => setDlgMov({ open: true, caja: 'ARS', tipo: 'INGRESO' })}>Ingreso</Button>
                <Button size="sm" variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50" onClick={() => setDlgMov({ open: true, caja: 'ARS', tipo: 'EGRESO' })}>Egreso</Button>
              </div>
            </div>
            {/* USD */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Caja USD</span>
                <CajaBadge caja="USD" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{fmtUSD(resumen?.saldoUSD ?? 0)}</p>
              <p className="text-xs text-slate-400">≈ {fmtARS(resumen?.saldoUSDenARS ?? 0)} (TC actual)</p>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => setDlgMov({ open: true, caja: 'USD', tipo: 'INGRESO' })}>Ingreso</Button>
                <Button size="sm" variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50" onClick={() => setDlgMov({ open: true, caja: 'USD', tipo: 'EGRESO' })}>Egreso</Button>
              </div>
            </div>
            {/* Canjes */}
            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Canjes</span>
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Activos</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{fmtUSD(resumen?.totalCanjesNoLiquidos ?? 0)}</p>
              <p className="text-xs text-slate-400">
                {resumen?.countCanjes.noLiquido ?? 0} activos · {resumen?.countCanjes.realizado ?? 0} realizados
              </p>
              <Button size="sm" className="w-full bg-[#00ADEF] hover:bg-[#0095cc] text-white" onClick={() => setDlgNuevoCanje(true)}>
                <Plus className="h-4 w-4 mr-1" /> Nuevo canje
              </Button>
            </div>
          </div>

          {/* Recent movements */}
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Movimientos recientes</h2>
            </div>
            <MovimientosTable
              movimientos={resumen?.movimientosRecientes ?? []}
              showCaja
              onDelete={(id) => setDeleteId(id)}
            />
          </div>
        </TabsContent>

        {/* ── TAB CAJA ARS ── */}
        <TabsContent value="ars">
          <CajaTab
            caja="ARS"
            movimientos={movimientosARS}
            onIngreso={() => setDlgMov({ open: true, caja: 'ARS', tipo: 'INGRESO' })}
            onEgreso={() => setDlgMov({ open: true, caja: 'ARS', tipo: 'EGRESO' })}
            onDelete={(id) => setDeleteId(id)}
          />
        </TabsContent>

        {/* ── TAB CAJA USD ── */}
        <TabsContent value="usd">
          <CajaTab
            caja="USD"
            movimientos={movimientosUSD}
            onIngreso={() => setDlgMov({ open: true, caja: 'USD', tipo: 'INGRESO' })}
            onEgreso={() => setDlgMov({ open: true, caja: 'USD', tipo: 'EGRESO' })}
            onDelete={(id) => setDeleteId(id)}
          />
        </TabsContent>

        {/* ── TAB CANJES ── */}
        <TabsContent value="canjes" className="space-y-4">
          <div className="flex justify-end">
            <Button className="bg-[#00ADEF] hover:bg-[#0095cc] text-white" onClick={() => setDlgNuevoCanje(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nuevo canje
            </Button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Nombre', 'Tipo', 'Recepción', 'Entrada', 'Estimado', 'Estado', 'Venta', 'Ganancia', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {canjes.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-slate-400 py-8">Sin canjes registrados</td></tr>
                )}
                {canjes.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.nombre}</td>
                    <td className="px-4 py-3 text-slate-600">{c.tipo}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtFecha(c.fechaRecepcion)}</td>
                    <td className="px-4 py-3 text-slate-800 font-medium">{fmtUSD(c.valorEntrada)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtUSD(c.valorEstimado)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', c.estado === 'REALIZADO' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700')}>
                        {c.estado === 'REALIZADO' ? 'Realizado' : 'No líquido'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.valorVenta ? fmtUSD(c.valorVenta) : '—'}</td>
                    <td className="px-4 py-3">
                      {c.gananciaUSD != null && (
                        <span style={{ color: c.gananciaUSD >= 0 ? '#27500A' : '#791F1F' }} className="font-medium">
                          {c.gananciaUSD >= 0 ? '+' : ''}{fmtUSD(c.gananciaUSD)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button title="Editar" className="p-1 text-slate-400 hover:text-slate-600" onClick={() => setDlgEditCanje({ open: true, canje: c })}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {c.estado === 'NO_LIQUIDO' && (
                          <button title="Realizar" className="p-1 text-amber-500 hover:text-amber-700" onClick={() => setDlgRealizarCanje({ open: true, canje: c })}>
                            <CheckCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── TAB TRASPASOS ── */}
        <TabsContent value="traspasos">
          <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Fecha', 'Origen', 'Destino', 'Monto origen', 'Monto destino', 'TC usado', 'Descripción'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {traspasos.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-slate-400 py-8">Sin traspasos registrados</td></tr>
                )}
                {traspasos.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{fmtFecha(t.fecha)}</td>
                    <td className="px-4 py-3"><CajaBadge caja={t.cajaOrigen} /></td>
                    <td className="px-4 py-3"><CajaBadge caja={t.cajaDestino} /></td>
                    <td className="px-4 py-3 font-medium text-slate-800">{fmtNum(t.cajaOrigen, t.montoOrigen)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{fmtNum(t.cajaDestino, t.montoDestino)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtARS(t.tipoCambioUsado)}</td>
                    <td className="px-4 py-3 text-slate-500">{t.descripcion ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─────────── DIALOGS ─────────── */}

      {/* Dialog: Movimiento (Ingreso / Egreso) */}
      <Dialog open={!!dlgMov?.open} onOpenChange={(o) => !o && setDlgMov(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dlgMov?.tipo === 'INGRESO' ? 'Nuevo Ingreso' : 'Nuevo Egreso'} — Caja {dlgMov?.caja}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMovimiento} className="space-y-4">
            <div>
              <Label htmlFor="mov-desc">Descripción *</Label>
              <Input id="mov-desc" name="descripcion" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="mov-monto">Monto *</Label>
              <Input id="mov-monto" name="monto" type="number" step="0.01" min="0.01" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="mov-fecha">Fecha *</Label>
              <Input id="mov-fecha" name="fecha" type="date" defaultValue={todayISO()} required className="mt-1" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDlgMov(null)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className={dlgMov?.tipo === 'INGRESO' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}>
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Traspaso */}
      <DialogTraspaso open={dlgTraspaso} onClose={() => setDlgTraspaso(false)} tcActual={tc} onSubmit={handleTraspaso} saving={saving} />

      {/* Dialog: Actualizar TC */}
      <Dialog open={dlgTC} onOpenChange={setDlgTC}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Actualizar tipo de cambio</DialogTitle></DialogHeader>
          <form onSubmit={handleActualizarTC} className="space-y-4">
            <div>
              <Label htmlFor="tc-valor">TC actual: {fmtARS(tc)}</Label>
              <Input id="tc-valor" name="valor" type="number" step="0.01" min="1" required className="mt-1" placeholder="Ej: 1150.00" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDlgTC(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-[#00ADEF] hover:bg-[#0095cc] text-white">
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nuevo Canje */}
      <Dialog open={dlgNuevoCanje} onOpenChange={setDlgNuevoCanje}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nuevo canje</DialogTitle></DialogHeader>
          <form onSubmit={handleNuevoCanje} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nombre del activo *</Label>
                <Input name="nombre" required className="mt-1" />
              </div>
              <div>
                <Label>Tipo *</Label>
                <select name="tipo" required className="mt-1 w-full border border-slate-300 rounded-md px-3 py-2 text-sm">
                  <option value="DEPARTAMENTO">Departamento</option>
                  <option value="TERRENO">Terreno</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div>
                <Label>Fecha de recepción *</Label>
                <Input name="fechaRecepcion" type="date" required className="mt-1" />
              </div>
              <div>
                <Label>Valor de entrada (USD) *</Label>
                <Input name="valorEntrada" type="number" step="0.01" min="0" required className="mt-1" />
              </div>
              <div>
                <Label>Valor estimado (USD) *</Label>
                <Input name="valorEstimado" type="number" step="0.01" min="0" required className="mt-1" placeholder="Por defecto = entrada" />
              </div>
              <div className="col-span-2">
                <Label>Observaciones</Label>
                <Input name="observaciones" className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDlgNuevoCanje(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-[#00ADEF] hover:bg-[#0095cc] text-white">
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Realizar Canje */}
      <DialogRealizarCanje
        canje={dlgRealizarCanje.canje}
        open={dlgRealizarCanje.open}
        onClose={() => setDlgRealizarCanje({ open: false, canje: null })}
        onSubmit={handleRealizarCanje}
        saving={saving}
      />

      {/* Dialog: Editar Canje */}
      <Dialog open={dlgEditCanje.open} onOpenChange={(o) => !o && setDlgEditCanje({ open: false, canje: null })}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar canje: {dlgEditCanje.canje?.nombre}</DialogTitle></DialogHeader>
          {dlgEditCanje.canje && (
            <form onSubmit={handleEditCanje} className="space-y-4">
              <div>
                <Label>Valor estimado (USD) *</Label>
                <Input name="valorEstimado" type="number" step="0.01" min="0" required defaultValue={dlgEditCanje.canje.valorEstimado} className="mt-1" />
              </div>
              <div>
                <Label>Descripción</Label>
                <Input name="descripcion" defaultValue={dlgEditCanje.canje.descripcion ?? ''} className="mt-1" />
              </div>
              <div>
                <Label>Observaciones</Label>
                <Input name="observaciones" defaultValue={dlgEditCanje.canje.observaciones ?? ''} className="mt-1" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDlgEditCanje({ open: false, canje: null })}>Cancelar</Button>
                <Button type="submit" disabled={saving} className="bg-[#00ADEF] hover:bg-[#0095cc] text-white">
                  {saving ? 'Guardando…' : 'Guardar'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar eliminación */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Eliminar movimiento</DialogTitle></DialogHeader>
          <p className="text-slate-600 text-sm">¿Estás seguro? Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDeleteMovimiento(deleteId)}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MovimientosTable({
  movimientos, showCaja = false, onDelete,
}: { movimientos: Movimiento[]; showCaja?: boolean; onDelete: (id: string) => void }) {
  const fmtMov = (m: Movimiento) => {
    const n = m.monto;
    const isPos = ['INGRESO', 'TRASPASO_ENTRADA', 'CANJE_REALIZADO'].includes(m.tipo);
    const color = isPos ? '#27500A' : '#791F1F';
    const sign = isPos ? '+' : '−';
    const formatted = m.caja === 'ARS' ? fmtARS(n) : fmtUSD(n);
    return <span style={{ color }} className="font-medium">{sign} {formatted}</span>;
  };

  if (movimientos.length === 0) {
    return <p className="text-center text-slate-400 py-8">Sin movimientos</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Fecha</th>
            <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Tipo</th>
            <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Descripción</th>
            {showCaja && <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Caja</th>}
            <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Monto</th>
            <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Saldo</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {movimientos.map((m) => (
            <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtFecha(m.fecha)}</td>
              <td className="px-4 py-3"><TipoBadge tipo={m.tipo} /></td>
              <td className="px-4 py-3 text-slate-700">{m.descripcion}</td>
              {showCaja && <td className="px-4 py-3"><CajaBadge caja={m.caja} /></td>}
              <td className="px-4 py-3 text-right">{fmtMov(m)}</td>
              <td className="px-4 py-3 text-right text-slate-600 font-medium whitespace-nowrap">
                {m.caja === 'ARS' ? fmtARS(m.saldoResultante) : fmtUSD(m.saldoResultante)}
              </td>
              <td className="px-4 py-3">
                {!m.traspasoId && m.tipo !== 'CANJE_REALIZADO' && (
                  <button className="text-slate-300 hover:text-red-400" onClick={() => onDelete(m.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CajaTab({
  caja, movimientos, onIngreso, onEgreso, onDelete,
}: {
  caja: TipoCaja; movimientos: Movimiento[];
  onIngreso: () => void; onEgreso: () => void;
  onDelete: (id: string) => void;
}) {
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');

  const filtered = movimientos.filter((m) => {
    if (filtroTipo && m.tipo !== filtroTipo) return false;
    if (filtroDesde && new Date(m.fecha) < new Date(filtroDesde)) return false;
    if (filtroHasta && new Date(m.fecha) > new Date(filtroHasta + 'T23:59:59')) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={onIngreso}>
            <Plus className="h-4 w-4 mr-1" /> Ingreso
          </Button>
          <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={onEgreso}>
            <Plus className="h-4 w-4 mr-1" /> Egreso
          </Button>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">Todos los tipos</option>
            <option value="INGRESO">Ingreso</option>
            <option value="EGRESO">Egreso</option>
            <option value="TRASPASO_ENTRADA">Traspaso entrada</option>
            <option value="TRASPASO_SALIDA">Traspaso salida</option>
            <option value="CANJE_REALIZADO">Canje realizado</option>
          </select>
          <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm" placeholder="Desde" />
          <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm" placeholder="Hasta" />
          {(filtroTipo || filtroDesde || filtroHasta) && (
            <button className="text-xs text-slate-400 hover:text-slate-600" onClick={() => { setFiltroTipo(''); setFiltroDesde(''); setFiltroHasta(''); }}>
              Limpiar
            </button>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white">
        <MovimientosTable movimientos={filtered} onDelete={onDelete} />
      </div>
    </div>
  );
}

function DialogTraspaso({
  open, onClose, tcActual, onSubmit, saving,
}: { open: boolean; onClose: () => void; tcActual: number; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; saving: boolean }) {
  const [origen, setOrigen] = useState<TipoCaja>('ARS');
  const [monto, setMonto] = useState('');
  const [tcVal, setTcVal] = useState(tcActual.toString());

  useEffect(() => { setTcVal(tcActual.toString()); }, [tcActual, open]);

  const destino: TipoCaja = origen === 'ARS' ? 'USD' : 'ARS';
  const montoNum = parseFloat(monto) || 0;
  const tcNum = parseFloat(tcVal) || 1;
  const montoDestino = origen === 'ARS' ? montoNum / tcNum : montoNum * tcNum;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Traspaso ARS ↔ USD</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="cajaOrigen" value={origen} />
          <input type="hidden" name="cajaDestino" value={destino} />
          <div className="flex items-center gap-3">
            <div className="flex-1 text-center">
              <span className={cn('text-sm font-semibold px-3 py-1 rounded', CAJA_BADGE[origen])}>De: {origen}</span>
            </div>
            <button type="button" onClick={() => setOrigen(destino)} className="p-1.5 border border-slate-200 rounded-md hover:bg-slate-50">
              <ArrowLeftRight className="h-4 w-4 text-slate-500" />
            </button>
            <div className="flex-1 text-center">
              <span className={cn('text-sm font-semibold px-3 py-1 rounded', CAJA_BADGE[destino])}>A: {destino}</span>
            </div>
          </div>
          <div>
            <Label>Monto a transferir ({origen}) *</Label>
            <Input name="montoOrigen" type="number" step="0.01" min="0.01" required value={monto} onChange={(e) => setMonto(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Tipo de cambio *</Label>
            <Input name="tipoCambioUsado" type="number" step="0.01" min="0.01" required value={tcVal} onChange={(e) => setTcVal(e.target.value)} className="mt-1" />
          </div>
          {montoNum > 0 && (
            <div className="rounded-md bg-slate-50 border border-slate-200 px-4 py-2 text-sm text-slate-600">
              Monto que llegará: <span className="font-semibold text-slate-800">
                {destino === 'ARS' ? fmtARS(montoDestino) : fmtUSD(montoDestino)}
              </span>
            </div>
          )}
          <div>
            <Label>Descripción (opcional)</Label>
            <Input name="descripcion" className="mt-1" />
          </div>
          <div>
            <Label>Fecha *</Label>
            <Input name="fecha" type="date" defaultValue={todayISO()} required className="mt-1" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-[#00ADEF] hover:bg-[#0095cc] text-white">
              {saving ? 'Transfiriendo…' : 'Transferir'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogRealizarCanje({
  canje, open, onClose, onSubmit, saving,
}: { canje: Canje | null; open: boolean; onClose: () => void; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; saving: boolean }) {
  const [valorVenta, setValorVenta] = useState('');
  useEffect(() => { if (open) setValorVenta(''); }, [open]);

  const ganancia = canje ? parseFloat(valorVenta) - canje.valorEntrada : 0;
  const hayValor = valorVenta !== '' && !isNaN(parseFloat(valorVenta));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Realizar canje</DialogTitle></DialogHeader>
        {canje && (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="rounded-md bg-slate-50 border border-slate-200 px-4 py-3 space-y-1 text-sm">
              <p className="font-medium text-slate-800">{canje.nombre}</p>
              <p className="text-slate-500">Valor de entrada: <span className="font-medium text-slate-700">{fmtUSD(canje.valorEntrada)}</span></p>
            </div>
            <div>
              <Label>Fecha de realización *</Label>
              <Input name="fechaRealizacion" type="date" defaultValue={todayISO()} required className="mt-1" />
            </div>
            <div>
              <Label>Valor de venta (USD) *</Label>
              <Input name="valorVenta" type="number" step="0.01" min="0" required value={valorVenta} onChange={(e) => setValorVenta(e.target.value)} className="mt-1" />
            </div>
            {hayValor && (
              <div className="rounded-md border px-4 py-2 text-sm font-medium" style={{ borderColor: ganancia >= 0 ? '#27500A33' : '#791F1F33', background: ganancia >= 0 ? '#27500A11' : '#791F1F11' }}>
                <span style={{ color: ganancia >= 0 ? '#27500A' : '#791F1F' }}>
                  {ganancia >= 0 ? `Ganancia: + ${fmtUSD(ganancia)}` : `Pérdida: − ${fmtUSD(Math.abs(ganancia))}`}
                </span>
              </div>
            )}
            <div>
              <Label>Descripción (opcional)</Label>
              <Input name="descripcion" className="mt-1" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white">
                {saving ? 'Guardando…' : 'Confirmar realización'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
