'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, PlusCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Producto, CategoriaProducto, AtributoProducto, OpcionAtributo } from '@prisma/client';

type OpcionForm = { nombre: string; costoBase: string; indiceUtilidad: string; unidad: string };
type AtributoForm = { nombre: string; requerido: boolean; opciones: OpcionForm[] };

type ProductoCompleto = Producto & {
  categoria: CategoriaProducto;
  atributos: (AtributoProducto & { opciones: OpcionAtributo[] })[];
};

interface Props {
  productos: ProductoCompleto[];
  categorias: CategoriaProducto[];
}

const UNIDADES = ['unidad', 'm2', 'ml', 'juego', 'par'];

function precioVenta(costo: string, indice: string): number {
  const c = parseFloat(costo) || 0;
  const i = parseFloat(indice) || 1.3;
  return Math.round(c * i);
}

export function ProductosContent({ productos, categorias }: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [atributos, setAtributos] = useState<AtributoForm[]>([]);

  const resetForm = () => {
    setNombre('');
    setDescripcion('');
    setCategoriaId('');
    setAtributos([]);
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
          ? {
              ...a,
              opciones: a.opciones.map((o, odx) =>
                odx === oi ? { ...o, [field]: value } : o
              ),
            }
          : a
      )
    );

  const guardar = async () => {
    if (!nombre.trim() || !categoriaId) return;
    setSaving(true);
    await fetch('/api/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
    });
    setSaving(false);
    setDialogOpen(false);
    resetForm();
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Productos</h1>
        <Button className="bg-sky-500 hover:bg-sky-600" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Producto
        </Button>
      </div>

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Atributos</TableHead>
              <TableHead>Opciones totales</TableHead>
              <TableHead>Estado</TableHead>
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
                  <Badge variant={p.activo ? 'success' : 'secondary'}>
                    {p.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {productos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-400 py-10">
                  No hay productos. Creá el primero.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Producto</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            {/* Datos base */}
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
                    {categorias.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                    ))}
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
                  <PlusCircle className="mr-1.5 h-4 w-4" />
                  Agregar atributo
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

                  {/* Opciones del atributo */}
                  <div className="space-y-2 pl-2">
                    {atrib.opciones.map((op, oi) => (
                      <div key={oi} className="grid grid-cols-12 gap-2 items-center">
                        <Input className="col-span-3" value={op.nombre} onChange={(e) => updateOpcion(ai, oi, 'nombre', e.target.value)} placeholder="Opción" />
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
                    ))}
                    <Button variant="ghost" size="sm" className="text-sky-600 hover:text-sky-700" onClick={() => addOpcion(ai)}>
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Agregar opción
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
                className="bg-sky-500 hover:bg-sky-600"
                disabled={!nombre.trim() || !categoriaId || saving}
                onClick={guardar}
              >
                {saving ? 'Guardando...' : 'Guardar Producto'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
