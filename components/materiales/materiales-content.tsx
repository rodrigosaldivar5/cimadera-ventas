'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, Loader2, FolderPlus, Upload, Download, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { CategoriaItem, Item } from '@prisma/client';
import * as XLSX from 'xlsx';

type CategoriaConItems = CategoriaItem & { items: Item[] };

type FilaImport = {
  nombre: string;
  categoria: string;
  descripcion?: string;
  costoBase: number;
  indiceUtilidad: number;
  unidad: string;
  error?: string;
};

const itemSchema = z.object({
  nombre: z.string().min(2, 'Nombre requerido'),
  descripcion: z.string().optional(),
  categoriaId: z.string().min(1, 'Categoría requerida'),
  costoBase: z.number().min(0, 'Costo inválido'),
  indiceUtilidad: z.number().min(1, 'Índice mínimo 1'),
  unidad: z.string(),
});

type ItemFormData = z.infer<typeof itemSchema>;

export function MateriaisContent({ categorias: iniciales }: { categorias: CategoriaConItems[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<'items' | 'categorias'>('items');
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set(iniciales.map((c) => c.id)));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Categorías state
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoriaItem | null>(null);
  const [catNombre, setCatNombre] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importFilas, setImportFilas] = useState<FilaImport[]>([]);
  const [importando, setImportando] = useState(false);
  const [importResultado, setImportResultado] = useState<{ creados: number; actualizados: number; errores: string[] } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: { indiceUtilidad: 1.3, unidad: 'unidad' },
  });

  const costoBase = watch('costoBase') ?? 0;
  const indice = watch('indiceUtilidad') ?? 1.3;
  const precioCalculado = Number(costoBase) * Number(indice);

  const toggleCategoria = (id: string) => {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openNew = () => {
    setEditingItem(null);
    reset({ indiceUtilidad: 1.3, unidad: 'unidad', costoBase: 0 });
    setDialogOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditingItem(item);
    reset({
      nombre: item.nombre,
      descripcion: item.descripcion ?? '',
      categoriaId: item.categoriaId,
      costoBase: Number(item.costoBase),
      indiceUtilidad: Number(item.indiceUtilidad),
      unidad: item.unidad,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: ItemFormData) => {
    setIsSubmitting(true);
    const url = editingItem ? `/api/materiales/items/${editingItem.id}` : '/api/materiales/items';
    const method = editingItem ? 'PUT' : 'POST';
    const precioVenta = Number(data.costoBase) * Number(data.indiceUtilidad);
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, precioVenta }),
    });
    setIsSubmitting(false);
    setDialogOpen(false);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este ítem?')) return;
    await fetch(`/api/materiales/items/${id}`, { method: 'DELETE' });
    router.refresh();
  };

  // Categorías handlers
  const openNewCat = () => {
    setEditingCat(null);
    setCatNombre('');
    setCatDialogOpen(true);
  };

  const openEditCat = (cat: CategoriaItem) => {
    setEditingCat(cat);
    setCatNombre(cat.nombre);
    setCatDialogOpen(true);
  };

  const saveCat = async () => {
    if (!catNombre.trim()) return;
    setCatSaving(true);
    if (editingCat) {
      await fetch(`/api/materiales/categorias/${editingCat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: catNombre.trim() }),
      });
    } else {
      await fetch('/api/materiales/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: catNombre.trim() }),
      });
    }
    setCatSaving(false);
    setCatDialogOpen(false);
    router.refresh();
  };

  const deleteCat = async (cat: CategoriaConItems) => {
    if (cat.items.length > 0) {
      alert('No se puede eliminar: la categoría tiene ítems asociados.');
      return;
    }
    if (!confirm(`¿Eliminar categoría "${cat.nombre}"?`)) return;
    const res = await fetch(`/api/materiales/categorias/${cat.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json();
      alert(json.error ?? 'Error al eliminar');
      return;
    }
    router.refresh();
  };

  const descargarPlantilla = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['nombre', 'descripcion', 'categoria', 'costoBase', 'indiceUtilidad', 'unidad'],
      ['Bisagra 3"', 'Bisagra de acero inoxidable', 'Bisagras', 150, 1.3, 'unidad'],
      ['Marco MDF 90mm', '', 'Marcos', 2500, 1.4, 'ml'],
      ['Cerradura embutir', 'Con manija incluida', 'Cerraduras', 3200, 1.35, 'unidad'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Materiales');
    XLSX.writeFile(wb, 'plantilla_materiales.xlsx');
  };

  const parsearArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result;
      const wb = XLSX.read(data, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const filas: FilaImport[] = rows.map((row) => {
        const nombre = String(row['nombre'] ?? '').trim();
        const categoria = String(row['categoria'] ?? '').trim();
        const costoBase = Number(row['costoBase'] ?? row['costo_base'] ?? 0);
        const indiceUtilidad = Number(row['indiceUtilidad'] ?? row['indice_utilidad'] ?? 1.3);
        const unidad = String(row['unidad'] ?? 'unidad').trim() || 'unidad';
        const descripcion = String(row['descripcion'] ?? '').trim() || undefined;
        const errores: string[] = [];
        if (!nombre) errores.push('nombre requerido');
        if (!categoria) errores.push('categoría requerida');
        if (isNaN(costoBase) || costoBase < 0) errores.push('costoBase inválido');
        if (isNaN(indiceUtilidad) || indiceUtilidad < 1) errores.push('indiceUtilidad mínimo 1');
        return { nombre, categoria, descripcion, costoBase, indiceUtilidad, unidad, error: errores.join('; ') || undefined };
      });
      setImportFilas(filas);
      setImportResultado(null);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const ejecutarImport = async () => {
    const validas = importFilas.filter((f) => !f.error);
    if (!validas.length) return;
    setImportando(true);
    const res = await fetch('/api/materiales/importar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filas: validas }),
    });
    if (res.ok) {
      const resultado = await res.json();
      setImportResultado(resultado);
      setImportFilas([]);
      router.refresh();
    } else {
      setImportResultado(null);
    }
    setImportando(false);
  };

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setTab('items')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'items' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Ítems
          </button>
          <button
            onClick={() => setTab('categorias')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'categorias' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Categorías
          </button>
        </div>

        {tab === 'items' ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setImportResultado(null); setImportFilas([]); setImportOpen(true); }} className="gap-1.5">
              <Upload className="h-4 w-4" /> Importar materiales
            </Button>
            <Button onClick={openNew} className="bg-[#00ADEF] hover:bg-[#0089C7]">
              <Plus className="mr-2 h-4 w-4" /> Nuevo Ítem
            </Button>
          </div>
        ) : (
          <Button onClick={openNewCat} className="bg-[#00ADEF] hover:bg-[#0089C7]">
            <FolderPlus className="mr-2 h-4 w-4" /> Nueva Categoría
          </Button>
        )}
      </div>

      {/* Tab: Ítems */}
      {tab === 'items' && (
        <>
          {iniciales.map((cat) => (
            <div key={cat.id} className="rounded-2xl border border-slate-100 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
              <button
                onClick={() => toggleCategoria(cat.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandidas.has(cat.id) ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                  <span className="font-medium text-slate-800">{cat.nombre}</span>
                  <Badge variant="secondary">{cat.items.length} ítems</Badge>
                </div>
              </button>

              {expandidas.has(cat.id) && (
                <div className="border-t">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Unidad</TableHead>
                        <TableHead className="text-right">Costo base</TableHead>
                        <TableHead className="text-right">Índice</TableHead>
                        <TableHead className="text-right">Precio venta</TableHead>
                        <TableHead className="w-24">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cat.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.nombre}</p>
                              {item.descripcion && <p className="text-xs text-slate-400">{item.descripcion}</p>}
                            </div>
                          </TableCell>
                          <TableCell>{item.unidad}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(item.costoBase))}</TableCell>
                          <TableCell className="text-right">{Number(item.indiceUtilidad).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium text-[#00ADEF]">{formatCurrency(Number(item.precioVenta))}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="text-red-500">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* Tab: Categorías */}
      {tab === 'categorias' && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-center">Ítems</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {iniciales.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.nombre}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{cat.items.length}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditCat(cat)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteCat(cat)} className="text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {iniciales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-slate-400 py-8">
                    No hay categorías
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog Ítem */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Ítem' : 'Nuevo Ítem'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input {...register('nombre')} />
              {errors.nombre && <p className="text-xs text-red-500">{errors.nombre.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input {...register('descripcion')} />
            </div>
            <div className="space-y-2">
              <Label>Categoría *</Label>
              <Select onValueChange={(v) => setValue('categoriaId', v)} defaultValue={editingItem?.categoriaId ?? ''}>
                <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                <SelectContent>
                  {iniciales.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.categoriaId && <p className="text-xs text-red-500">{errors.categoriaId.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Costo base ($) *</Label>
                <Input type="number" step="0.01" {...register('costoBase', { valueAsNumber: true })} />
                {errors.costoBase && <p className="text-xs text-red-500">{errors.costoBase.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Índice utilidad</Label>
                <Input type="number" step="0.01" min="1" {...register('indiceUtilidad', { valueAsNumber: true })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Unidad</Label>
              <Select onValueChange={(v) => setValue('unidad', v)} defaultValue={editingItem?.unidad ?? 'unidad'}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['unidad', 'ml', 'm2', 'kg', 'litro', 'juego'].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-sky-50 border border-sky-200 p-3 flex justify-between items-center">
              <span className="text-sm text-slate-600">Precio de venta calculado:</span>
              <span className="font-bold text-[#00ADEF] text-lg">{formatCurrency(precioCalculado)}</span>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-[#00ADEF] hover:bg-[#0089C7]" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingItem ? 'Guardar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Categoría */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Nombre *</Label>
            <Input value={catNombre} onChange={(e) => setCatNombre(e.target.value)} placeholder="Ej: Bisagras" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancelar</Button>
            <Button
              className="bg-[#00ADEF] hover:bg-[#0089C7]"
              disabled={!catNombre.trim() || catSaving}
              onClick={saveCat}
            >
              {catSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCat ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Importar */}
      <Dialog open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) { setImportFilas([]); setImportResultado(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Importar materiales desde Excel / CSV</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={descargarPlantilla} className="gap-1.5 shrink-0">
                <Download className="h-4 w-4" /> Descargar plantilla
              </Button>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">
                  <Upload className="h-4 w-4" /> Seleccionar archivo (.xlsx, .xls, .csv)
                </span>
                <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={parsearArchivo} />
              </label>
            </div>

            {importResultado && (
              <div className={`rounded-lg border p-3 text-sm space-y-1 ${importResultado.errores?.length ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-green-50 border-green-200 text-green-700'}`}>
                <p>Importación completada: <strong>{importResultado.creados}</strong> creados, <strong>{importResultado.actualizados}</strong> actualizados.</p>
                {importResultado.errores?.map((e, i) => (
                  <p key={i} className="text-red-500 text-xs flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" />{e}</p>
                ))}
              </div>
            )}

            {importFilas.length > 0 && (
              <>
                <div className="text-sm text-slate-600">
                  <strong>{importFilas.filter((f) => !f.error).length}</strong> válidas de <strong>{importFilas.length}</strong> filas
                  {importFilas.some((f) => f.error) && (
                    <span className="ml-2 text-red-500 flex items-center gap-1 inline-flex">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Las filas con errores no serán importadas
                    </span>
                  )}
                </div>
                <div className="rounded-lg border overflow-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Costo base</TableHead>
                        <TableHead className="text-right">Índice</TableHead>
                        <TableHead className="text-right">Precio venta</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importFilas.map((fila, idx) => (
                        <TableRow key={idx} className={fila.error ? 'bg-red-50' : ''}>
                          <TableCell className="font-medium">{fila.nombre || '—'}</TableCell>
                          <TableCell>{fila.categoria || '—'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(fila.costoBase)}</TableCell>
                          <TableCell className="text-right">{fila.indiceUtilidad}</TableCell>
                          <TableCell className="text-right font-medium text-[#00ADEF]">
                            {formatCurrency(fila.costoBase * fila.indiceUtilidad)}
                          </TableCell>
                          <TableCell>
                            {fila.error ? (
                              <span className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> {fila.error}
                              </span>
                            ) : (
                              <span className="text-xs text-green-600">OK</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            {importFilas.length === 0 && !importResultado && (
              <p className="text-sm text-slate-400 text-center py-6">
                Descargá la plantilla, completala y subila para previsualizar los datos.
              </p>
            )}
          </div>
          <DialogFooter className="pt-2 border-t">
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cerrar</Button>
            <Button
              className="bg-[#00ADEF] hover:bg-[#0089C7] gap-1.5"
              disabled={importFilas.filter((f) => !f.error).length === 0 || importando}
              onClick={ejecutarImport}
            >
              {importando && <Loader2 className="h-4 w-4 animate-spin" />}
              Importar {importFilas.filter((f) => !f.error).length > 0 ? `(${importFilas.filter((f) => !f.error).length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

