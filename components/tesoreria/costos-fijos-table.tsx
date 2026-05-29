'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Pencil, Trash2, Plus, Check, X, FileDown, Upload,
  AlertCircle, Info, ChevronLeft, ChevronRight, Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────

type Registro = { id?: string; montoEstimado: number | null; montoReal: number | null; observacion?: string | null };

type Costo = {
  id: string;
  nombre: string;
  categoria: string;
  categoriaId: string | null;
  moneda: string;
  observacion: string | null;
  registro: Registro | null;
};

type Categoria = { id: string; nombre: string };

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const fmtUSD = (n: number) =>
  `U$D ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)}`;
const fmt = (n: number, moneda: string) => moneda === 'USD' ? fmtUSD(n) : fmtARS(n);

function desvio(est: number | null, real: number | null): { pct: string; color: string } | null {
  if (est == null || real == null || est === 0) return null;
  const pct = ((real - est) / est) * 100;
  const color = pct <= -5 ? 'text-green-600' : pct <= 5 ? 'text-amber-500' : 'text-red-600';
  return { pct: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, color };
}

function prevMesAnio(mes: number, anio: number) {
  return mes === 1 ? { mes: 12, anio: anio - 1 } : { mes: mes - 1, anio };
}
function nextMesAnio(mes: number, anio: number) {
  return mes === 12 ? { mes: 1, anio: anio + 1 } : { mes: mes + 1, anio };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MonedaToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const base = 'px-2 py-0.5 text-xs font-semibold rounded cursor-pointer border transition-colors';
  return (
    <div className="flex gap-1">
      {(['ARS', 'USD'] as const).map((m) => (
        <button key={m} type="button" onClick={() => onChange(m)}
          className={cn(base, value === m
            ? m === 'ARS' ? 'bg-[#E6F1FB] text-[#0C447C] border-[#00ADEF]' : 'bg-[#EAF3DE] text-[#27500A] border-[#639922]'
            : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300')}>{m}</button>
      ))}
    </div>
  );
}

function CeldaMonto({
  value, moneda, placeholder, onSave,
}: { value: number | null; moneda: string; placeholder: string; onSave: (v: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={() => { onSave(input.trim() === '' ? null : Number(input)); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onSave(input.trim() === '' ? null : Number(input)); setEditing(false); }
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-28 rounded border border-[#00ADEF] px-2 py-1 text-sm text-right focus:outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => { setInput(value != null ? String(value) : ''); setEditing(true); }}
      className={cn(
        'w-full text-right px-2 py-1 rounded text-sm hover:bg-slate-100 transition-colors',
        value == null ? 'text-slate-300 italic' : 'text-slate-800 font-medium',
      )}
    >
      {value != null ? fmt(value, moneda) : placeholder}
    </button>
  );
}

// ─── Excel import helpers ──────────────────────────────────────────────────────

type FilaImport = {
  fila: number; mes: number | null; anio: number | null;
  nombre: string; categoria: string; moneda: string;
  montoEstimado: number | null; montoReal: number | null;
  observacion: string | null; error?: string;
};

function parseExcel(file: File): Promise<FilaImport[]> {
  return file.arrayBuffer().then((buf) => {
    const wb = XLSX.read(buf);
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    return rows.map((row, i) => {
      const nombre = String(row['Nombre'] || '').trim();
      const categoria = String(row['Categoría'] || row['Categoria'] || '').trim();
      const monedaRaw = String(row['Moneda'] || '').toUpperCase().trim();
      const moneda = ['ARS', 'USD'].includes(monedaRaw) ? monedaRaw : 'ARS';
      const mesRaw = parseInt(String(row['Mes'] || ''));
      const anioRaw = parseInt(String(row['Año'] || row['Anio'] || ''));
      const estRaw = parseFloat(String(row['Estimado'] || '').replace(/[^\d.-]/g, ''));
      const realRaw = parseFloat(String(row['Real'] || '').replace(/[^\d.-]/g, ''));
      const observacion = String(row['Observación'] || row['Observacion'] || '').trim() || null;

      let error: string | undefined;
      if (!nombre) error = 'Nombre vacío';
      else if (!categoria) error = 'Categoría vacía';

      return {
        fila: i + 2,
        mes: isNaN(mesRaw) ? null : mesRaw,
        anio: isNaN(anioRaw) ? null : anioRaw,
        nombre, categoria, moneda,
        montoEstimado: isNaN(estRaw) || estRaw === 0 ? null : estRaw,
        montoReal: isNaN(realRaw) || realRaw === 0 ? null : realRaw,
        observacion, error,
      };
    });
  });
}

function descargarPlantilla() {
  const data = [
    ['Mes', 'Año', 'Nombre', 'Categoría', 'Moneda', 'Estimado', 'Real', 'Observación'],
    [5, 2026, 'Alquiler galpón', 'Alquileres', 'ARS', 850000, 870000, 'Contrato hasta dic 2026'],
    [5, 2026, 'Sueldo Juan Pérez', 'Nómina', 'ARS', 1200000, '', ''],
    [5, 2026, 'Servicio internet', 'Servicios', 'USD', 45, 45, ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Costos Fijos');
  XLSX.writeFile(wb, 'plantilla-costos-fijos.xlsx');
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CostosFijosTable({ costosIniciales }: { costosIniciales: Costo[] }) {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [costos, setCostos] = useState<Costo[]>(costosIniciales);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);

  // Add form
  const [agregando, setAgregando] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: '', categoria: '', moneda: 'ARS', monto: '', tipoMonto: 'estimado' as 'estimado' | 'real', observacion: '' });
  const [saving, setSaving] = useState(false);

  // Inline edit (nombre/categoria/observacion)
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ nombre: '', categoria: '', observacion: '' });

  // Category dialog
  const [dlgCat, setDlgCat] = useState(false);
  const [nombreCat, setNombreCat] = useState('');
  const [catTarget, setCatTarget] = useState<'nuevo' | 'edit'>('nuevo');

  // Replicar dialog
  const [dlgReplicar, setDlgReplicar] = useState(false);
  const [pctAumento, setPctAumento] = useState('');
  const [replicando, setReplicando] = useState(false);

  // Import dialog
  const [dlgImport, setDlgImport] = useState(false);
  const [filasImport, setFilasImport] = useState<FilaImport[]>([]);
  const [importando, setImportando] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  // Export PDF
  const [exportando, setExportando] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const showToast = (msg: string, tipo: 'ok' | 'error' = 'ok') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    fetch('/api/costos-fijos/categorias').then((r) => r.json()).then((data: Categoria[]) => {
      setCategorias(data);
      setNuevo((p) => ({ ...p, categoria: p.categoria || data[0]?.nombre || '' }));
    }).catch(() => {});
  }, []);

  async function cargarMes(m: number, a: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/tesoreria/costos?mes=${m}&anio=${a}`);
      if (res.ok) setCostos(await res.json());
    } finally { setLoading(false); }
  }

  function navMes(dir: 1 | -1) {
    const { mes: nm, anio: na } = dir === 1 ? nextMesAnio(mes, anio) : prevMesAnio(mes, anio);
    setMes(nm); setAnio(na);
    cargarMes(nm, na);
  }

  async function guardarRegistro(id: string, field: 'montoEstimado' | 'montoReal', value: number | null) {
    const res = await fetch(`/api/tesoreria/costos/${id}/registro?mes=${mes}&anio=${anio}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      const reg = await res.json();
      setCostos((prev) => prev.map((c) => c.id === id ? { ...c, registro: reg } : c));
    }
  }

  async function crearNuevo() {
    if (!nuevo.nombre || !nuevo.categoria) return;
    setSaving(true);
    try {
      const res = await fetch('/api/tesoreria/costos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nuevo, monto: nuevo.monto ? Number(nuevo.monto) : undefined, mes, anio }),
      });
      if (res.ok) {
        await cargarMes(mes, anio);
        setAgregando(false);
        setNuevo({ nombre: '', categoria: categorias[0]?.nombre || '', moneda: 'ARS', monto: '', tipoMonto: 'estimado', observacion: '' });
      }
    } finally { setSaving(false); }
  }

  async function guardarEdicion(id: string) {
    setSaving(true);
    try {
      await fetch(`/api/tesoreria/costos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });
      setCostos((prev) => prev.map((c) => c.id === id ? { ...c, ...editData } : c));
      setEditandoId(null);
    } finally { setSaving(false); }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Desactivar este costo fijo?')) return;
    await fetch(`/api/tesoreria/costos/${id}`, { method: 'DELETE' });
    setCostos((prev) => prev.filter((c) => c.id !== id));
  }

  async function crearCategoria() {
    if (!nombreCat.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/costos-fijos/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreCat.trim() }),
      });
      if (res.ok) {
        const cat: Categoria = await res.json();
        setCategorias((p) => [...p, cat].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        if (catTarget === 'edit') setEditData((p) => ({ ...p, categoria: cat.nombre }));
        else setNuevo((p) => ({ ...p, categoria: cat.nombre }));
        setDlgCat(false); setNombreCat('');
      }
    } finally { setSaving(false); }
  }

  async function replicarMes() {
    const prev = prevMesAnio(mes, anio);
    setReplicando(true);
    try {
      const res = await fetch('/api/tesoreria/costos/replicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mesOrigen: prev.mes, anioOrigen: prev.anio, mesDestino: mes, anioDestino: anio, porcentajeAumento: pctAumento ? Number(pctAumento) : 0 }),
      });
      const data = await res.json();
      setDlgReplicar(false); setPctAumento('');
      await cargarMes(mes, anio);
      showToast(`${data.replicados} costos replicados desde ${MESES[prev.mes - 1]} ${prev.anio}`);
    } finally { setReplicando(false); }
  }

  async function ejecutarImport() {
    const validas = filasImport.filter((f) => !f.error);
    if (!validas.length) return;
    setImportando(true);
    try {
      const res = await fetch('/api/tesoreria/costos/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: validas }),
      });
      const data = await res.json();
      setDlgImport(false); setFilasImport([]);
      await cargarMes(mes, anio);
      showToast(`Importación completada: ${data.creados} creados, ${data.actualizados} actualizados, ${data.errores} errores`);
    } finally { setImportando(false); }
  }

  async function exportarPDF() {
    setExportando(true);
    try {
      const [informeRes, { generarPDFCostosFijosV2 }] = await Promise.all([
        fetch(`/api/tesoreria/costos/informe?anio=${anio}&mesDesde=1&mesHasta=${mes}&tipoCambio=1145`).then((r) => r.json()),
        import('@/lib/pdf/generar-costos-fijos-v2'),
      ]);
      generarPDFCostosFijosV2(informeRes);
    } finally { setExportando(false); }
  }

  function CategoriaSelector({ value, onChange, target }: { value: string; onChange: (v: string) => void; target: 'nuevo' | 'edit' }) {
    return (
      <div className="flex gap-1.5 items-center">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm">
          {categorias.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
        </select>
        <button type="button" onClick={() => { setCatTarget(target); setNombreCat(''); setDlgCat(true); }}
          style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid #CBD5E1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00ADEF', fontSize: 18, flexShrink: 0 }}>+</button>
      </div>
    );
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalEstARS = costos.filter((c) => c.moneda === 'ARS').reduce((s, c) => s + (c.registro?.montoEstimado ?? 0), 0);
  const totalRealARS = costos.filter((c) => c.moneda === 'ARS').reduce((s, c) => s + (c.registro?.montoReal ?? 0), 0);
  const totalEstUSD = costos.filter((c) => c.moneda === 'USD').reduce((s, c) => s + (c.registro?.montoEstimado ?? 0), 0);
  const totalRealUSD = costos.filter((c) => c.moneda === 'USD').reduce((s, c) => s + (c.registro?.montoReal ?? 0), 0);
  const dvARS = desvio(totalEstARS || null, totalRealARS || null);
  const dvUSD = desvio(totalEstUSD || null, totalRealUSD || null);
  const prev = prevMesAnio(mes, anio);

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap justify-between items-center gap-2">
        {/* Month selector */}
        <div className="flex items-center gap-2">
          <button onClick={() => navMes(-1)} className="p-1 rounded hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
          <span className="font-semibold text-slate-800 min-w-[120px] text-center">{MESES[mes - 1]} {anio}</span>
          <button onClick={() => navMes(1)} className="p-1 rounded hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
          <Button size="sm" variant="outline" onClick={() => setDlgReplicar(true)} title={`Replicar desde ${MESES[prev.mes - 1]} ${prev.anio}`}>
            <Copy className="h-4 w-4 mr-1" /> Replicar mes anterior
          </Button>
        </div>
        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={exportarPDF} disabled={exportando}>
            <FileDown className="h-4 w-4 mr-1" />{exportando ? 'Generando…' : 'PDF gerencial'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setFilasImport([]); setDlgImport(true); }}>
            <Upload className="h-4 w-4 mr-1" /> Importar Excel
          </Button>
          <Button size="sm" onClick={() => setAgregando(true)} disabled={agregando}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Categoría</th>
              <th className="px-4 py-3 text-left">Moneda</th>
              <th className="px-4 py-3 text-right">Estimado</th>
              <th className="px-4 py-3 text-right">Real</th>
              <th className="px-4 py-3 text-right">Desvío</th>
              <th className="px-4 py-3 text-left">Observación</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className={cn('divide-y divide-slate-100', loading && 'opacity-50')}>
            {agregando && (
              <tr className="bg-blue-50">
                <td className="px-4 py-2">
                  <input autoFocus value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                    placeholder="Nombre" className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                </td>
                <td className="px-4 py-2"><CategoriaSelector value={nuevo.categoria} onChange={(v) => setNuevo({ ...nuevo, categoria: v })} target="nuevo" /></td>
                <td className="px-4 py-2"><MonedaToggle value={nuevo.moneda} onChange={(v) => setNuevo({ ...nuevo, moneda: v })} /></td>
                <td className="px-4 py-2" colSpan={2}>
                  <div className="flex gap-2 items-center">
                    <input type="number" value={nuevo.monto} onChange={(e) => setNuevo({ ...nuevo, monto: e.target.value })}
                      placeholder="Monto" className="w-28 rounded border border-slate-300 px-2 py-1 text-sm text-right" />
                    <select value={nuevo.tipoMonto} onChange={(e) => setNuevo({ ...nuevo, tipoMonto: e.target.value as 'estimado' | 'real' })}
                      className="rounded border border-slate-300 px-2 py-1 text-xs">
                      <option value="estimado">Estimado</option>
                      <option value="real">Real</option>
                    </select>
                  </div>
                </td>
                <td className="px-4 py-2" />
                <td className="px-4 py-2">
                  <input value={nuevo.observacion} onChange={(e) => setNuevo({ ...nuevo, observacion: e.target.value })}
                    placeholder="Opcional" className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <Button size="sm" onClick={crearNuevo} disabled={saving}><Check className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setAgregando(false)}><X className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            )}
            {costos.map((c) => {
              const esEdit = editandoId === c.id;
              const dv = desvio(c.registro?.montoEstimado ?? null, c.registro?.montoReal ?? null);
              return (
                <tr key={c.id} className={esEdit ? 'bg-blue-50' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3">
                    {esEdit
                      ? <input value={editData.nombre} onChange={(e) => setEditData({ ...editData, nombre: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                      : <span className="font-medium text-slate-800">{c.nombre}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {esEdit
                      ? <CategoriaSelector value={editData.categoria} onChange={(v) => setEditData({ ...editData, categoria: v })} target="edit" />
                      : <span className="text-slate-500">{c.categoria}</span>}
                  </td>
                  <td className="px-4 py-3"><MonedaToggle value={c.moneda} onChange={() => {}} /></td>
                  <td className="px-4 py-3 text-right">
                    <CeldaMonto value={c.registro?.montoEstimado ?? null} moneda={c.moneda} placeholder="— estimado"
                      onSave={(v) => guardarRegistro(c.id, 'montoEstimado', v)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CeldaMonto value={c.registro?.montoReal ?? null} moneda={c.moneda} placeholder="— real"
                      onSave={(v) => guardarRegistro(c.id, 'montoReal', v)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {dv ? <span className={cn('text-xs font-semibold', dv.color)}>{dv.pct}</span> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {esEdit
                      ? <input value={editData.observacion} onChange={(e) => setEditData({ ...editData, observacion: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                      : c.observacion ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {esEdit
                      ? <div className="flex gap-1">
                          <Button size="sm" onClick={() => guardarEdicion(c.id)} disabled={saving}><Check className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)}><X className="h-4 w-4" /></Button>
                        </div>
                      : <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setEditandoId(c.id); setEditData({ nombre: c.nombre, categoria: c.categoria, observacion: c.observacion ?? '' }); }}><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => eliminar(c.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>}
                  </td>
                </tr>
              );
            })}
            {costos.length === 0 && !agregando && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Sin costos fijos activos</td></tr>
            )}
          </tbody>
          <tfoot className="bg-slate-50 border-t-2 border-slate-200">
            <tr>
              <td colSpan={3} className="px-4 py-3 text-right text-slate-600 font-semibold text-xs uppercase tracking-wide">Totales</td>
              <td className="px-4 py-3 text-right">
                {totalEstARS > 0 && <div className="text-xs text-slate-500">{fmtARS(totalEstARS)}</div>}
                {totalEstUSD > 0 && <div className="text-xs text-slate-500">{fmtUSD(totalEstUSD)}</div>}
              </td>
              <td className="px-4 py-3 text-right">
                {totalRealARS > 0 && <div className="font-bold text-slate-800">{fmtARS(totalRealARS)}</div>}
                {totalRealUSD > 0 && <div className="font-bold text-[#27500A]">{fmtUSD(totalRealUSD)}</div>}
              </td>
              <td className="px-4 py-3 text-right">
                {dvARS && <div className={cn('text-xs font-semibold', dvARS.color)}>{dvARS.pct} ARS</div>}
                {dvUSD && <div className={cn('text-xs font-semibold', dvUSD.color)}>{dvUSD.pct} USD</div>}
              </td>
              <td colSpan={2} className="px-4 py-3 text-slate-400 text-xs">
                {totalEstARS > 0 && <div>Est. ARS ≈ {fmtARS(totalEstARS / 4.33)} / sem.</div>}
                {totalRealARS > 0 && <div>Real ARS ≈ {fmtARS(totalRealARS / 4.33)} / sem.</div>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Dialog: Nueva Categoría ── */}
      <Dialog open={dlgCat} onOpenChange={(o) => { if (!o) { setDlgCat(false); setNombreCat(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nueva categoría</DialogTitle></DialogHeader>
          <div><Label>Nombre *</Label>
            <Input autoFocus value={nombreCat} onChange={(e) => setNombreCat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && crearCategoria()} className="mt-1" placeholder="Ej: Logística" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDlgCat(false); setNombreCat(''); }}>Cancelar</Button>
            <Button onClick={crearCategoria} disabled={saving || !nombreCat.trim()} className="bg-[#00ADEF] hover:bg-[#0095cc] text-white">
              {saving ? 'Creando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Replicar mes anterior ── */}
      <Dialog open={dlgReplicar} onOpenChange={(o) => { if (!o) setDlgReplicar(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Replicar costos de {MESES[prev.mes - 1]} {prev.anio} a {MESES[mes - 1]} {anio}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-slate-500">
              Copia los montos reales del mes anterior como estimados para este mes.
              El campo Real queda vacío.
            </p>
            <div>
              <Label>% de aumento estimado (opcional)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input type="number" min={0} step={0.1} value={pctAumento}
                  onChange={(e) => setPctAumento(e.target.value)} placeholder="0" className="w-24" />
                <span className="text-slate-500 text-sm">%</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgReplicar(false)}>Cancelar</Button>
            <Button onClick={replicarMes} disabled={replicando} className="bg-[#00ADEF] hover:bg-[#0095cc] text-white">
              {replicando ? 'Replicando…' : 'Replicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Importar Excel ── */}
      <Dialog open={dlgImport} onOpenChange={(o) => { if (!o) { setDlgImport(false); setFilasImport([]); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>Importar desde Excel</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-1">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-sm text-slate-700 transition-colors">
                  <Upload className="h-4 w-4" /> Seleccionar archivo (.xlsx, .xls, .csv)
                </span>
                <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only"
                  onChange={async (e) => { const f = e.target.files?.[0]; if (f) setFilasImport(await parseExcel(f)); e.target.value = ''; }} />
              </label>
              <button type="button" onClick={descargarPlantilla}
                className="text-xs text-[#00ADEF] hover:underline flex items-center gap-1">
                <FileDown className="h-3.5 w-3.5" /> Descargar plantilla
              </button>
            </div>
            {filasImport.length > 0 && (() => {
              const validas = filasImport.filter((f) => !f.error);
              return (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">{validas.length} filas válidas</span> de {filasImport.length} totales.
                  </p>
                  <div className="rounded-lg border border-slate-200 overflow-auto max-h-64">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          {['Fila', 'Mes', 'Año', 'Nombre', 'Categoría', 'Moneda', 'Estimado', 'Real', ''].map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-slate-600 font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filasImport.map((f) => (
                          <tr key={f.fila} className={f.error ? 'bg-red-50' : 'bg-white'}>
                            <td className="px-3 py-1.5 text-slate-400">{f.fila}</td>
                            <td className="px-3 py-1.5">{f.mes ?? '—'}</td>
                            <td className="px-3 py-1.5">{f.anio ?? '—'}</td>
                            <td className="px-3 py-1.5 text-slate-800">{f.nombre || <span className="text-red-400 italic">vacío</span>}</td>
                            <td className="px-3 py-1.5 text-slate-600">{f.categoria || <span className="text-red-400 italic">vacío</span>}</td>
                            <td className="px-3 py-1.5"><span className={cn('font-semibold', f.moneda === 'USD' ? 'text-[#27500A]' : 'text-[#0C447C]')}>{f.moneda}</span></td>
                            <td className="px-3 py-1.5 text-right">{f.montoEstimado != null ? f.montoEstimado.toLocaleString('es-AR') : '—'}</td>
                            <td className="px-3 py-1.5 text-right">{f.montoReal != null ? f.montoReal.toLocaleString('es-AR') : '—'}</td>
                            <td className="px-3 py-1.5">
                              {f.error && <span title={f.error} className="text-red-500 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /><span className="text-[10px]">{f.error}</span></span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => { setDlgImport(false); setFilasImport([]); }}>Cancelar</Button>
            <Button onClick={ejecutarImport} disabled={importando || filasImport.filter((f) => !f.error).length === 0}
              className="bg-[#00ADEF] hover:bg-[#0095cc] text-white">
              {importando ? 'Importando…' : `Importar ${filasImport.filter((f) => !f.error).length} costos`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Toast ── */}
      {toast && (
        <div className={cn('fixed bottom-6 right-6 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2',
          toast.tipo === 'error' ? 'bg-red-600' : 'bg-green-600')}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
