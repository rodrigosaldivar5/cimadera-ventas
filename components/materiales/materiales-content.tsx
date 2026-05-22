'use client';

import { useState } from 'react';
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
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, Loader2, FolderPlus } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { CategoriaItem, Item } from '@prisma/client';

type CategoriaConItems = CategoriaItem & { items: Item[] };

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
          <Button onClick={openNew} className="bg-sky-500 hover:bg-sky-600">
            <Plus className="mr-2 h-4 w-4" /> Nuevo Ítem
          </Button>
        ) : (
          <Button onClick={openNewCat} className="bg-sky-500 hover:bg-sky-600">
            <FolderPlus className="mr-2 h-4 w-4" /> Nueva Categoría
          </Button>
        )}
      </div>

      {/* Tab: Ítems */}
      {tab === 'items' && (
        <>
          {iniciales.map((cat) => (
            <div key={cat.id} className="rounded-lg border bg-white shadow-sm overflow-hidden">
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
                          <TableCell className="text-right font-medium text-sky-600">{formatCurrency(Number(item.precioVenta))}</TableCell>
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
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
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
              <span className="font-bold text-sky-600 text-lg">{formatCurrency(precioCalculado)}</span>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-sky-500 hover:bg-sky-600" disabled={isSubmitting}>
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
              className="bg-sky-500 hover:bg-sky-600"
              disabled={!catNombre.trim() || catSaving}
              onClick={saveCat}
            >
              {catSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCat ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
