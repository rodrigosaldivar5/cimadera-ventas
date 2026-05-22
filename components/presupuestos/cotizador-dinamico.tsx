'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export interface OpcionSeleccionada {
  atributoNombre: string;
  opcionId: string;
  opcionNombre: string;
  precioUnitario: number;
  cantidad: number;
  unidad: string;
  subtotal: number;
}

export interface ItemProducto {
  productoId: string;
  productoNombre: string;
  cantidad: number;
  opciones: OpcionSeleccionada[];
  subtotal: number;
}

interface OpcionAtributo {
  id: string;
  nombre: string;
  precioVenta: number;
  unidad: string;
}

interface AtributoProducto {
  id: string;
  nombre: string;
  requerido: boolean;
  opciones: OpcionAtributo[];
}

interface Producto {
  id: string;
  nombre: string;
  categoria: { nombre: string };
  atributos: AtributoProducto[];
}

interface Props {
  productos: Producto[];
  items: ItemProducto[];
  onChange: (items: ItemProducto[]) => void;
}

const UNIDADES_CON_MEDIDA = ['m2', 'ml'];

export function CotizadorDinamico({ productos, items, onChange }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [selecciones, setSelecciones] = useState<Record<string, { opcionId: string; medida: number }>>({});

  const resetDialog = () => {
    setProductoSeleccionado(null);
    setCantidad(1);
    setSelecciones({});
  };

  const elegirProducto = (productoId: string) => {
    const p = productos.find((x) => x.id === productoId);
    if (!p) return;
    setProductoSeleccionado(p);
    const sel: Record<string, { opcionId: string; medida: number }> = {};
    p.atributos.forEach((a) => { sel[a.id] = { opcionId: '__none__', medida: 1 }; });
    setSelecciones(sel);
  };

  const setOpcion = (atributoId: string, opcionId: string) => {
    setSelecciones((prev) => ({ ...prev, [atributoId]: { ...prev[atributoId], opcionId } }));
  };

  const setMedida = (atributoId: string, medida: number) => {
    setSelecciones((prev) => ({ ...prev, [atributoId]: { ...prev[atributoId], medida } }));
  };

  const calcularSubtotalItem = (): number => {
    if (!productoSeleccionado) return 0;
    return productoSeleccionado.atributos.reduce((sum, atrib) => {
      const sel = selecciones[atrib.id];
      if (!sel?.opcionId) return sum;
      const opcion = atrib.opciones.find((o) => o.id === sel.opcionId);
      if (!opcion) return sum;
      const medida = UNIDADES_CON_MEDIDA.includes(opcion.unidad) ? (sel.medida || 1) : 1;
      return sum + opcion.precioVenta * medida;
    }, 0) * cantidad;
  };

  const agregarAlPresupuesto = () => {
    if (!productoSeleccionado) return;

    const opciones: OpcionSeleccionada[] = productoSeleccionado.atributos
      .filter((a) => selecciones[a.id]?.opcionId)
      .map((atrib) => {
        const sel = selecciones[atrib.id];
        const opcion = atrib.opciones.find((o) => o.id === sel.opcionId)!;
        const medida = UNIDADES_CON_MEDIDA.includes(opcion.unidad) ? (sel.medida || 1) : 1;
        return {
          atributoNombre: atrib.nombre,
          opcionId: opcion.id,
          opcionNombre: opcion.nombre,
          precioUnitario: opcion.precioVenta,
          cantidad: medida,
          unidad: opcion.unidad,
          subtotal: opcion.precioVenta * medida,
        };
      });

    const subtotal = opciones.reduce((s, o) => s + o.subtotal, 0) * cantidad;

    const nuevoItem: ItemProducto = {
      productoId: productoSeleccionado.id,
      productoNombre: productoSeleccionado.nombre,
      cantidad,
      opciones,
      subtotal,
    };

    onChange([...items, nuevoItem]);
    setDialogOpen(false);
    resetDialog();
  };

  const eliminarItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const totalItems = items.reduce((s, i) => s + i.subtotal, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{items.length} ítem{items.length !== 1 ? 's' : ''} agregado{items.length !== 1 ? 's' : ''}</span>
        <Button size="sm" className="bg-sky-500 hover:bg-sky-600" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Agregar ítem
        </Button>
      </div>

      {/* Lista de ítems */}
      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="rounded-lg border bg-slate-50 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="font-semibold text-slate-800">{item.productoNombre}</span>
                  <span className="ml-2 text-sm text-slate-500">× {item.cantidad}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sky-600">{formatCurrency(item.subtotal)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => eliminarItem(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.opciones.map((op, oi) => (
                  <Badge key={oi} variant="secondary" className="text-xs">
                    {op.atributoNombre}: {op.opcionNombre}
                    {UNIDADES_CON_MEDIDA.includes(op.unidad) && ` (${op.cantidad} ${op.unidad})`}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
          <div className="flex justify-end text-sm font-semibold text-slate-700">
            Subtotal ítems: <span className="ml-2 text-sky-600">{formatCurrency(totalItems)}</span>
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-slate-200 py-10 text-center text-slate-400">
          <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No hay ítems. Agregá productos al presupuesto.</p>
        </div>
      )}

      {/* Dialog de cotización */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cotizar producto</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Selección de producto */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">¿Qué producto querés cotizar?</label>
              <Select
                value={productoSeleccionado?.id ?? '__none__'}
                onValueChange={(v) => { if (v !== '__none__') elegirProducto(v); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un producto" />
                </SelectTrigger>
                <SelectContent>
                  {productos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre} <span className="text-slate-400 ml-1">({p.categoria.nombre})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {productoSeleccionado && (
              <>
                {/* Cantidad */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Cantidad</label>
                  <Input
                    type="number"
                    min={1}
                    value={cantidad}
                    onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24"
                  />
                </div>

                {/* Atributos */}
                <div className="space-y-4">
                  {productoSeleccionado.atributos.map((atrib) => {
                    const sel = selecciones[atrib.id];
                    const opcionElegida = atrib.opciones.find((o) => o.id === sel?.opcionId);
                    const necesitaMedida = opcionElegida && UNIDADES_CON_MEDIDA.includes(opcionElegida.unidad);
                    return (
                      <div key={atrib.id} className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">
                          {atrib.nombre}
                          {atrib.requerido && <span className="text-red-500 ml-0.5">*</span>}
                        </label>
                        <Select value={sel?.opcionId ?? '__none__'} onValueChange={(v) => setOpcion(atrib.id, v)}>
                          <SelectTrigger>
                            <SelectValue placeholder={`Elegir ${atrib.nombre.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {atrib.opciones.map((op) => (
                              <SelectItem key={op.id} value={op.id}>
                                <span>{op.nombre}</span>
                                <span className="ml-2 text-green-600 font-medium">
                                  {formatCurrency(op.precioVenta)}/{op.unidad}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {necesitaMedida && (
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder={`Medida (${opcionElegida.unidad})`}
                              value={sel?.medida ?? ''}
                              onChange={(e) => setMedida(atrib.id, parseFloat(e.target.value) || 0)}
                              className="w-32"
                            />
                            <span className="text-sm text-slate-500">{opcionElegida.unidad}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Total en tiempo real */}
                <div className="rounded-lg bg-sky-50 border border-sky-200 p-4 text-center">
                  <p className="text-sm text-sky-600 mb-1">Total del ítem</p>
                  <p className="text-3xl font-bold text-sky-700">{formatCurrency(calcularSubtotalItem())}</p>
                  <p className="text-xs text-sky-500 mt-1">{cantidad} unidad{cantidad > 1 ? 'es' : ''}</p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setDialogOpen(false); resetDialog(); }}>
                    Cancelar
                  </Button>
                  <Button className="bg-sky-500 hover:bg-sky-600" onClick={agregarAlPresupuesto}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Agregar al presupuesto
                  </Button>
                </div>
              </>
            )}

            {productos.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">
                No hay productos configurados. Creá productos en el módulo Productos.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
