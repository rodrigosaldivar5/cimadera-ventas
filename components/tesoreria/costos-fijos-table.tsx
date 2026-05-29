'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2, Plus, Check, X, FileDown, Upload, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

type Costo = {
  id: string;
  nombre: string;
  categoria: string;
  moneda: string;
  monto: number;
  observacion: string | null;
};

type Categoria = { id: string; nombre: string };

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const fmtUSD = (n: number) =>
  `U$D ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)}`;

function MonedaToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const base = 'px-2 py-0.5 text-xs font-semibold rounded cursor-pointer border transition-colors';
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => onChange('ARS')}
        className={cn(base, value === 'ARS'
          ? 'bg-[#E6F1FB] text-[#0C447C] border-[#00ADEF]'
          : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300')}
      >ARS</button>
      <button
        type="button"
        onClick={() => onChange('USD')}
        className={cn(base, value === 'USD'
          ? 'bg-[#EAF3DE] text-[#27500A] border-[#639922]'
          : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300')}
      >USD</button>
    </div>
  );
}

type Fila = { nombre: string; categoria: string; moneda: string; monto: string; observacion: string };

type FilaImport = {
  fila: number;
  nombre: string;
  categoria: string;
  moneda: string;
  montoMensual: number;
  observacion: string | null;
  error?: string;
  monedaCorregida?: boolean;
};

async function parseExcel(file: File): Promise<FilaImport[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rows.map((row, i) => {
    const nombre = String(row['Nombre'] || '').trim();
    const categoria = String(row['Categoría'] || row['Categoria'] || '').trim();
    const monedaRaw = String(row['Moneda'] || '').toUpperCase().trim();
    const monedaValida = ['ARS', 'USD'].includes(monedaRaw);
    const moneda = monedaValida ? monedaRaw : 'ARS';
    const montoStr = String(row['Monto mensual'] || row['Monto'] || '0').replace(/[^\d.-]/g, '');
    const montoMensual = parseFloat(montoStr);
    const observacion = String(row['Observación'] || row['Observacion'] || '').trim() || null;

    let error: string | undefined;
    if (!nombre) error = 'Nombre vacío';
    else if (!categoria) error = 'Categoría vacía';
    else if (isNaN(montoMensual)) error = 'Monto no numérico';
    else if (montoMensual < 0) error = 'Monto negativo';

    return {
      fila: i + 2,
      nombre,
      categoria,
      moneda,
      montoMensual: isNaN(montoMensual) ? 0 : montoMensual,
      observacion,
      error,
      monedaCorregida: !monedaValida && !error,
    };
  });
}

function descargarPlantilla() {
  const data = [
    ['Nombre', 'Categoría', 'Moneda', 'Monto mensual', 'Observación'],
    ['Alquiler galpón', 'Alquileres', 'ARS', 850000, 'Contrato hasta dic 2026'],
    ['Sueldo Juan Pérez', 'Nómina', 'ARS', 1200000, ''],
    ['Servicio internet', 'Servicios', 'USD', 45, ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Costos Fijos');
  XLSX.writeFile(wb, 'plantilla-costos-fijos.xlsx');
}

export function CostosFijosTable({ costosIniciales }: { costosIniciales: Costo[] }) {
  const [costos, setCostos] = useState(costosIniciales);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Fila>({ nombre: '', categoria: '', moneda: 'ARS', monto: '', observacion: '' });
  const [agregando, setAgregando] = useState(false);
  const [nuevo, setNuevo] = useState<Fila>({ nombre: '', categoria: '', moneda: 'ARS', monto: '', observacion: '' });
  const [saving, setSaving] = useState(false);
  const [dlgCat, setDlgCat] = useState(false);
  const [nombreCat, setNombreCat] = useState('');
  const [catTarget, setCatTarget] = useState<'edit' | 'nuevo'>('nuevo');
  const [exportando, setExportando] = useState(false);
  const [dlgImport, setDlgImport] = useState(false);
  const [filasImport, setFilasImport] = useState<FilaImport[]>([]);
  const [importando, setImportando] = useState(false);
  const [toastImport, setToastImport] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/costos-fijos/categorias')
      .then((r) => r.json())
      .then((data: Categoria[]) => {
        setCategorias(data);
        setNuevo((prev) => ({ ...prev, categoria: prev.categoria || data[0]?.nombre || '' }));
      })
      .catch(() => {});
  }, []);

  function iniciarEdicion(c: Costo) {
    setEditandoId(c.id);
    setEditData({ nombre: c.nombre, categoria: c.categoria, moneda: c.moneda ?? 'ARS', monto: String(c.monto), observacion: c.observacion ?? '' });
  }

  async function guardarEdicion(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/cashflow/costos-fijos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editData, monto: Number(editData.monto) }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCostos((prev) => prev.map((c) => (c.id === id ? { ...updated, moneda: updated.moneda ?? 'ARS' } : c)));
        setEditandoId(null);
      }
    } finally { setSaving(false); }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Desactivar este costo fijo?')) return;
    const res = await fetch(`/api/cashflow/costos-fijos/${id}`, { method: 'DELETE' });
    if (res.ok) setCostos((prev) => prev.filter((c) => c.id !== id));
  }

  async function crearNuevo() {
    if (!nuevo.nombre || !nuevo.monto) return;
    setSaving(true);
    try {
      const res = await fetch('/api/cashflow/costos-fijos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nuevo, monto: Number(nuevo.monto) }),
      });
      if (res.ok) {
        const created = await res.json();
        setCostos((prev) => [...prev, { ...created, moneda: created.moneda ?? 'ARS' }]);
        setAgregando(false);
        setNuevo({ nombre: '', categoria: categorias[0]?.nombre || '', moneda: 'ARS', monto: '', observacion: '' });
      }
    } finally { setSaving(false); }
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
        setCategorias((prev) => [...prev, cat].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        if (catTarget === 'edit') {
          setEditData((prev) => ({ ...prev, categoria: cat.nombre }));
        } else {
          setNuevo((prev) => ({ ...prev, categoria: cat.nombre }));
        }
        setDlgCat(false);
        setNombreCat('');
      }
    } finally { setSaving(false); }
  }

  function abrirDlgCat(target: 'edit' | 'nuevo') {
    setCatTarget(target);
    setNombreCat('');
    setDlgCat(true);
  }

  async function exportarPDF() {
    setExportando(true);
    try {
      const now = new Date();
      const mes = now.getMonth() + 1;
      const anio = now.getFullYear();
      const prevMes = mes === 1 ? 12 : mes - 1;
      const prevAnio = mes === 1 ? anio - 1 : anio;

      const [prevRes, { generarPDFCostosFijos, buildSnapshotDatos }] = await Promise.all([
        fetch(`/api/costos-fijos/snapshot?mes=${prevMes}&anio=${prevAnio}`).then((r) => r.json()),
        import('@/lib/pdf/generar-costos-fijos'),
      ]);

      generarPDFCostosFijos(costos, prevRes ?? null);

      const snapshotDatos = buildSnapshotDatos(costos);
      await fetch('/api/costos-fijos/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, anio, datos: snapshotDatos }),
      });
    } finally { setExportando(false); }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const filas = await parseExcel(file);
    setFilasImport(filas);
    e.target.value = '';
  }

  async function ejecutarImport() {
    const validas = filasImport.filter((f) => !f.error);
    if (validas.length === 0) return;
    setImportando(true);
    try {
      const res = await fetch('/api/tesoreria/costos/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: validas.map((f) => ({
          nombre: f.nombre,
          categoria: f.categoria,
          moneda: f.moneda,
          montoMensual: f.montoMensual,
          observacion: f.observacion,
        })) }),
      });
      const data = await res.json();
      setDlgImport(false);
      setFilasImport([]);
      setToastImport(`Importación completada: ${data.creados} creados, ${data.actualizados} actualizados, ${data.errores} errores`);
      setTimeout(() => setToastImport(null), 5000);
      // Refresh list
      const updated = await fetch('/api/cashflow/costos-fijos').then((r) => r.json());
      if (updated.costos) setCostos(updated.costos.map((c: Costo) => ({ ...c, moneda: c.moneda ?? 'ARS' })));
    } finally {
      setImportando(false);
    }
  }

  const totalARS = costos.filter((c) => (c.moneda ?? 'ARS') === 'ARS').reduce((s, c) => s + c.monto, 0);
  const totalUSD = costos.filter((c) => c.moneda === 'USD').reduce((s, c) => s + c.monto, 0);

  function CategoriaSelector({ value, onChange, target }: { value: string; onChange: (v: string) => void; target: 'edit' | 'nuevo' }) {
    return (
      <div className="flex gap-1.5 items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        >
          {categorias.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
        </select>
        <button
          type="button"
          onClick={() => abrirDlgCat(target)}
          title="Nueva categoría"
          style={{ width: 28, height: 28, borderRadius: 6, border: '0.5px solid #CBD5E1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00ADEF', fontSize: 18, flexShrink: 0 }}
        >+</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{costos.length} costos activos</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportarPDF} disabled={exportando}>
            <FileDown className="h-4 w-4 mr-1" />
            {exportando ? 'Generando…' : 'Exportar PDF gerencial'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setFilasImport([]); setDlgImport(true); }}>
            <Upload className="h-4 w-4 mr-1" /> Importar desde Excel
          </Button>
          <Button size="sm" onClick={() => setAgregando(true)} disabled={agregando}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Categoría</th>
              <th className="px-4 py-3 text-left">Moneda</th>
              <th className="px-4 py-3 text-right">Monto mensual</th>
              <th className="px-4 py-3 text-left">Observación</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {agregando && (
              <tr className="bg-sky-50">
                <td className="px-4 py-2">
                  <input autoFocus value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                    placeholder="Nombre" className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                </td>
                <td className="px-4 py-2">
                  <CategoriaSelector value={nuevo.categoria} onChange={(v) => setNuevo({ ...nuevo, categoria: v })} target="nuevo" />
                </td>
                <td className="px-4 py-2">
                  <MonedaToggle value={nuevo.moneda} onChange={(v) => setNuevo({ ...nuevo, moneda: v })} />
                </td>
                <td className="px-4 py-2">
                  <input type="number" value={nuevo.monto} onChange={(e) => setNuevo({ ...nuevo, monto: e.target.value })}
                    placeholder="0" className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-right" />
                </td>
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
              const esEditando = editandoId === c.id;
              const moneda = c.moneda ?? 'ARS';
              return (
                <tr key={c.id} className={esEditando ? 'bg-sky-50' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3">
                    {esEditando
                      ? <input value={editData.nombre} onChange={(e) => setEditData({ ...editData, nombre: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                      : <span className="font-medium text-slate-800">{c.nombre}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {esEditando
                      ? <CategoriaSelector value={editData.categoria} onChange={(v) => setEditData({ ...editData, categoria: v })} target="edit" />
                      : <span className="text-slate-500">{c.categoria}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {esEditando
                      ? <MonedaToggle value={editData.moneda} onChange={(v) => setEditData({ ...editData, moneda: v })} />
                      : <MonedaToggle value={moneda} onChange={() => {}} />}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {esEditando
                      ? <input type="number" value={editData.monto} onChange={(e) => setEditData({ ...editData, monto: e.target.value })}
                          className="w-32 rounded border border-slate-300 px-2 py-1 text-sm text-right" />
                      : moneda === 'USD' ? fmtUSD(c.monto) : fmtARS(c.monto)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {esEditando
                      ? <input value={editData.observacion} onChange={(e) => setEditData({ ...editData, observacion: e.target.value })}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                      : c.observacion ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {esEditando
                      ? <div className="flex gap-1">
                          <Button size="sm" onClick={() => guardarEdicion(c.id)} disabled={saving}><Check className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)}><X className="h-4 w-4" /></Button>
                        </div>
                      : <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => iniciarEdicion(c)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => eliminar(c.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50 border-t border-slate-200">
            <tr>
              <td colSpan={3} className="px-4 py-3 text-right text-slate-600 font-medium">Total mensual</td>
              <td className="px-4 py-3 text-right">
                {totalARS > 0 && <div className="font-bold text-slate-800">{fmtARS(totalARS)}</div>}
                {totalUSD > 0 && <div className="font-bold text-[#27500A]">{fmtUSD(totalUSD)}</div>}
              </td>
              <td colSpan={2} className="px-4 py-3 text-slate-400 text-xs">
                {totalARS > 0 && <div>ARS ≈ {fmtARS(totalARS / 4.33)} / sem.</div>}
                {totalUSD > 0 && <div>USD ≈ {fmtUSD(totalUSD / 4.33)} / sem.</div>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Dialog: Nueva Categoría */}
      <Dialog open={dlgCat} onOpenChange={(o) => { if (!o) { setDlgCat(false); setNombreCat(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nueva categoría</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre de la categoría *</Label>
              <Input
                autoFocus
                value={nombreCat}
                onChange={(e) => setNombreCat(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && crearCategoria()}
                className="mt-1"
                placeholder="Ej: Logística"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDlgCat(false); setNombreCat(''); }}>Cancelar</Button>
            <Button onClick={crearCategoria} disabled={saving || !nombreCat.trim()} className="bg-[#00ADEF] hover:bg-[#0095cc] text-white">
              {saving ? 'Creando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Importar desde Excel */}
      <Dialog open={dlgImport} onOpenChange={(o) => { if (!o) { setDlgImport(false); setFilasImport([]); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar costos fijos desde Excel</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-1">
            {/* Upload area */}
            <div className="flex items-center gap-3">
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-sm text-slate-700 transition-colors">
                  <Upload className="h-4 w-4" />
                  Seleccionar archivo (.xlsx, .xls, .csv)
                </span>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="sr-only"
                  onChange={handleImportFile}
                />
              </label>
              <button
                type="button"
                onClick={descargarPlantilla}
                className="text-xs text-[#00ADEF] hover:underline flex items-center gap-1"
              >
                <FileDown className="h-3.5 w-3.5" />
                Descargar plantilla
              </button>
            </div>

            {/* Preview table */}
            {filasImport.length > 0 && (() => {
              const validas = filasImport.filter((f) => !f.error);
              const conError = filasImport.filter((f) => f.error);
              const catNuevas = new Set(
                validas.map((f) => f.categoria.toLowerCase()).filter((cat) =>
                  !categorias.some((c) => c.nombre.toLowerCase() === cat)
                )
              );
              return (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">{validas.length} filas válidas</span> de {filasImport.length} totales.
                    {catNuevas.size > 0 && (
                      <span className="ml-1 text-[#00ADEF]">{catNuevas.size} {catNuevas.size === 1 ? 'categoría nueva' : 'categorías nuevas'} se crearán.</span>
                    )}
                  </p>
                  <div className="rounded-lg border border-slate-200 overflow-x-auto max-h-72 overflow-y-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-slate-600 font-medium">Fila</th>
                          <th className="px-3 py-2 text-left text-slate-600 font-medium">Nombre</th>
                          <th className="px-3 py-2 text-left text-slate-600 font-medium">Categoría</th>
                          <th className="px-3 py-2 text-left text-slate-600 font-medium">Moneda</th>
                          <th className="px-3 py-2 text-right text-slate-600 font-medium">Monto</th>
                          <th className="px-3 py-2 text-left text-slate-600 font-medium">Observación</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filasImport.map((f) => {
                          const catNueva = !f.error && !categorias.some((c) => c.nombre.toLowerCase() === f.categoria.toLowerCase());
                          return (
                            <tr key={f.fila} className={f.error ? 'bg-red-50' : 'bg-white'}>
                              <td className="px-3 py-1.5 text-slate-400">{f.fila}</td>
                              <td className="px-3 py-1.5 text-slate-800">{f.nombre || <span className="text-red-400 italic">vacío</span>}</td>
                              <td className="px-3 py-1.5">
                                {f.categoria ? (
                                  <span className={cn(
                                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium',
                                    catNueva
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                      : 'bg-slate-100 text-slate-600'
                                  )}>
                                    {f.categoria}
                                    {catNueva && <span className="text-[10px] text-blue-500">nueva</span>}
                                  </span>
                                ) : <span className="text-red-400 italic">vacío</span>}
                              </td>
                              <td className="px-3 py-1.5">
                                <span className={cn('text-xs font-semibold', f.moneda === 'USD' ? 'text-[#27500A]' : 'text-[#0C447C]')}>
                                  {f.moneda}
                                </span>
                                {f.monedaCorregida && (
                                  <span title="Moneda no reconocida, se usó ARS" className="ml-1 text-amber-500 cursor-help"><Info className="h-3 w-3 inline" /></span>
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-right text-slate-700">{f.montoMensual.toLocaleString('es-AR')}</td>
                              <td className="px-3 py-1.5 text-slate-500 max-w-[150px] truncate">{f.observacion ?? '—'}</td>
                              <td className="px-3 py-1.5">
                                {f.error && (
                                  <span title={f.error} className="text-red-500 cursor-help flex items-center gap-1">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    <span className="text-[10px]">{f.error}</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {conError.length > 0 && (
                    <p className="text-xs text-red-500">{conError.length} fila(s) con error serán omitidas.</p>
                  )}
                </div>
              );
            })()}
          </div>

          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => { setDlgImport(false); setFilasImport([]); }}>Cancelar</Button>
            <Button
              onClick={ejecutarImport}
              disabled={importando || filasImport.filter((f) => !f.error).length === 0}
              className="bg-[#00ADEF] hover:bg-[#0095cc] text-white"
            >
              {importando ? 'Importando…' : `Importar ${filasImport.filter((f) => !f.error).length} costos`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toastImport && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2">
          {toastImport}
        </div>
      )}
    </div>
  );
}
