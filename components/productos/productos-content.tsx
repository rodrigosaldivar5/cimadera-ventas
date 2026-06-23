'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, PlusCircle, FolderPlus, Edit, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Producto, CategoriaProducto, AtributoProducto, OpcionAtributo, CategoriaItem, Item } from '@prisma/client';

type OpcionForm = {
  nombre: string;
  costoBase: string;
  indiceUtilidad: string;
  unidad: string;
  _catId?: string;
  _itemId?: string;
};
type AtributoForm = { nombre: string; requerido: boolean; opciones: OpcionForm[] };

type ProductoCompleto = Producto & {
  categoria: CategoriaProducto;
  atributos: (AtributoProducto & { opciones: OpcionAtributo[] })[];
};

type CategoriaConItems = CategoriaItem & { items: Item[] };

interface Props {
  productos: ProductoCompleto[];
  categorias: CategoriaProducto[];
  categoriasItem: CategoriaConItems[];
}

const UNIDADES = ['unidad', 'm2', 'ml', 'juego', 'par'];

function precioVenta(costo: string, indice: string): number {
  const c = parseFloat(costo) || 0;
  const i = parseFloat(indice) || 1.3;
  return Math.round(c * i);
}

export function ProductosContent({ productos, categorias, categoriasItem }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'productos' | 'categorias'>('productos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProductoId, setEditingProductoId] = useState<string | null>(null);

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [atributos, setAtributos] = useState<AtributoForm[]>([]);

  // Categorías CRUD
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoriaProducto | null>(null);
  const [catNombre, setCatNombre] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  const resetForm = () => {
    setNombre('');
    setDescripcion('');
    setCategoriaId('');
    setAtributos([]);
    setEditingProductoId(null);
  };

  const openEdit = (p: ProductoCompleto) => {
    setEditingProductoId(p.id);
    setNombre(p.nombre);
    setDescripcion(p.descripcion ?? '');
    setCategoriaId(p.categoriaId);
    setAtributos(
      p.atributos.map((a) => ({
        nombre: a.nombre,
        requerido: a.requerido,
        opciones: a.opciones.map((o) => ({
          nombre: o.nombre,
          costoBase: String(Number(o.costoBase)),
          indiceUtilidad: String(Number(o.indiceUtilidad)),
          unidad: o.unidad,
        })),
      }))
    );
    setDialogOpen(true);
  };

  const addAtributo = () =>
    setAtributos((prev) => [...prev, { nombre: '', requerido: true, opciones: [] }]);

  const removeAtributo = (i: number) =>
    setAtributos((prev) => prev.filter((_, idx) => idx !== i));

  const updateAtributo = (i: number, field: keyof AtributoForm, value: unknown) =>
    setAtributos((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));

  const addOpcion = (ai: number) =>
    setAtributos((prev) =>
      prev.map((a, idx) =>
        idx === ai
          ? { ...a, opciones: [...a.opciones, { nombre: '', costoBase: '', indiceUtilidad: '1.30', unidad: 'unidad' }] }
          : a
      )
    );

  const removeOpcion = (ai: number, oi: number) =>
    setAtributos((prev) =>
      prev.map((a, idx) =>
        idx === ai ? { ...a, opciones: a.opciones.filter((_, odx) => odx !== oi) } : a
      )
    );

  const updateOpcion = (ai: number, oi: number, field: keyof OpcionForm, value: string) =>
    setAtributos((prev) =>
      prev.map((a, idx) =>
        idx === ai
          ? { ...a, opciones: a.opciones.map((o, odx) => (odx === oi ? { ...o, [field]: value } : o)) }
          : a
      )
    );

  const selectItemForOpcion = (ai: number, oi: number, itemId: string) => {
    setAtributos((prev) =>
      prev.map((a, idx) => {
        if (idx !== ai) return a;
        const updatedOpciones = a.opciones.map((o, odx) => {
          if (odx !== oi) return o;
          const catId = o._catId;
          const cat = categoriasItem.find((c) => c.id === catId);
          const item = cat?.items.find((i) => i.id === itemId);
          if (!item) return { ...o, _itemId: itemId };
          return {
            ...o,
            _itemId: item.id,
            nombre: item.nombre,
            costoBase: String(Number(item.costoBase)),
            indiceUtilidad: String(Number(item.indiceUtilidad)),
            unidad: item.unidad,
          };
        });
        return { ...a, opciones: updatedOpciones };
      })
    );
  };

  const guardar = async () => {
    if (!nombre.trim() || !categoriaId) return;
    setSaving(true);
    const payload = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      categoriaId,
      atributos: atributos.map((a) => ({
        nombre: a.nombre,
        requerido: a.requerido,
        opciones: a.opciones.map((o) => ({
          nombre: o.nombre,
          costoBase: parseFloat(o.costoBase) || 0,
          indiceUtilidad: parseFloat(o.indiceUtilidad) || 1.3,
          unidad: o.unidad,
        })),
      })),
    };

    if (editingProductoId) {
      await fetch(`/api/productos/${editingProductoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    setSaving(false);
    setDialogOpen(false);
    resetForm();
    router.refresh();
  };

  const openNewCat = () => { setEditingCat(null); setCatNombre(''); setCatDialogOpen(true); };
  const openEditCat = (cat: CategoriaProducto) => { setEditingCat(cat); setCatNombre(cat.nombre); setCatDialogOpen(true); };

  const saveCat = async () => {
    if (!catNombre.trim()) return;
    setCatSaving(true);
    if (editingCat) {
      await fetch(`/api/productos/categorias/${editingCat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: catNombre.trim() }),
      });
    } else {
      await fetch('/api/productos/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: catNombre.trim() }),
      });
    }
    setCatSaving(false);
    setCatDialogOpen(false);
    router.refresh();
  };

  const deleteCat = async (cat: CategoriaProducto & { productos?: { length?: number } }) => {
    if (!confirm(`¿Eliminar categoría "${cat.nombre}"?`)) return;
    const res = await fetch(`/api/productos/categorias/${cat.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json();
      alert(json.error ?? 'Error al eliminar');
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setTab('productos')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'productos' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Productos
          </button>
          <button
            onClick={() => setTab('categorias')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'categorias' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Categorías
          </button>
        </div>

        {tab === 'productos' ? (
          <Button className="bg-[#00ADEF] hover:bg-[#0089C7]" onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo Producto
          </Button>
        ) : (
          <Button className="bg-[#00ADEF] hover:bg-[#0089C7]" onClick={openNewCat}>
            <FolderPlus className="mr-2 h-4 w-4" /> Nueva Categoría
          </Button>
        )}
      </div>

      {/* Tab Productos */}
      {tab === 'productos' && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Atributos</TableHead>
                <TableHead>Opciones totales</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-20">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell>{p.categoria.nombre}</TableCell>
                  <TableCell>{p.atributos.length}</TableCell>
                  <TableCell>{p.atributos.reduce((s, a) => s + a.opciones.length, 0)}</TableCell>
                  <TableCell>
                    <Badge variant={p.activo ? 'success' : 'secondary'}>{p.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {productos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 py-10">No hay productos.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tab Categorías */}
      {tab === 'categorias' && (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categorias.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.nombre}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditCat(cat)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteCat(cat)} className="text-red-500"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {categorias.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-slate-400 py-8">No hay categorías</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog Producto (nuevo o editar) */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProductoId ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Nombre del producto *</label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Puerta interior" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Categoría *</label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                  <SelectTrigger><SelectValue placeholder="Seleccioná categoría" /></SelectTrigger>
                  <SelectContent>
                    {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Descripción</label>
                <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Opcional" />
              </div>
            </div>

            {/* Atributos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-slate-800">Atributos configurables</h3>
                <Button variant="outline" size="sm" onClick={addAtributo}>
                  <PlusCircle className="mr-1.5 h-4 w-4" /> Agregar atributo
                </Button>
              </div>

              {atributos.map((atrib, ai) => (
                <div key={ai} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Input
                      className="flex-1"
                      value={atrib.nombre}
                      onChange={(e) => updateAtributo(ai, 'nombre', e.target.value)}
                      placeholder="Nombre del atributo (ej: Bisagra)"
                    />
                    <label className="flex items-center gap-1.5 text-sm text-slate-600 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={atrib.requerido}
                        onChange={(e) => updateAtributo(ai, 'requerido', e.target.checked)}
                        className="rounded"
                      />
                      Requerido
                    </label>
                    <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600" onClick={() => removeAtributo(ai)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Opciones */}
                  <div className="space-y-3 pl-2">
                    {atrib.opciones.map((op, oi) => (
                      <div key={oi} className="rounded border bg-slate-50 p-3 space-y-2">
                        {/* Material selectors */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500">Categoría de material</label>
                            <Select
                              value={op._catId ?? '__none__'}
                              onValueChange={(v) => updateOpcion(ai, oi, '_catId', v === '__none__' ? '' : v)}
                            >
                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Elegir categoría..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— Ninguna —</SelectItem>
                                {categoriasItem.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-slate-500">Material / Accesorio</label>
                            <Select
                              value={op._itemId ?? '__none__'}
                              onValueChange={(v) => v !== '__none__' && selectItemForOpcion(ai, oi, v)}
                              disabled={!op._catId}
                            >
                              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Elegir ítem..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— Seleccioná —</SelectItem>
                                {(categoriasItem.find((c) => c.id === op._catId)?.items ?? []).map((item) => (
                                  <SelectItem key={item.id} value={item.id}>{item.nombre}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {/* Fields */}
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <Input className="col-span-3" value={op.nombre} onChange={(e) => updateOpcion(ai, oi, 'nombre', e.target.value)} placeholder="Nombre opción" />
                          <Input className="col-span-2" type="number" value={op.costoBase} onChange={(e) => updateOpcion(ai, oi, 'costoBase', e.target.value)} placeholder="Costo" />
                          <Input className="col-span-2" type="number" step="0.01" value={op.indiceUtilidad} onChange={(e) => updateOpcion(ai, oi, 'indiceUtilidad', e.target.value)} placeholder="Índice" />
                          <div className="col-span-2">
                            <Select value={op.unidad} onValueChange={(v) => updateOpcion(ai, oi, 'unidad', v)}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <span className="col-span-2 text-sm text-green-600 font-medium text-right">
                            {formatCurrency(precioVenta(op.costoBase, op.indiceUtilidad))}
                          </span>
                          <Button variant="ghost" size="icon" className="col-span-1 text-red-400 hover:text-red-600" onClick={() => removeOpcion(ai, oi)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="text-[#00ADEF] hover:text-[#0089C7]" onClick={() => addOpcion(ai)}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Agregar opción
                    </Button>
                  </div>
                </div>
              ))}

              {atributos.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4 border rounded-lg">
                  Sin atributos — este producto tendrá precio fijo
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
              <Button
                className="bg-[#00ADEF] hover:bg-[#0089C7]"
                disabled={!nombre.trim() || !categoriaId || saving}
                onClick={guardar}
              >
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : (editingProductoId ? 'Guardar cambios' : 'Guardar Producto')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Categoría */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Editar Categoría' : 'Nueva Categoría de Producto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm font-medium text-slate-700">Nombre *</label>
            <Input value={catNombre} onChange={(e) => setCatNombre(e.target.value)} placeholder="Ej: Puertas interiores" autoFocus />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-[#00ADEF] hover:bg-[#0089C7]" disabled={!catNombre.trim() || catSaving} onClick={saveCat}>
              {catSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCat ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

