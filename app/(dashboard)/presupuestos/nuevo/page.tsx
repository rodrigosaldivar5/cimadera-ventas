'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Trash2, ChevronRight, ChevronLeft, Save, Send } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { CotizadorDinamico, type ItemProducto } from '@/components/presupuestos/cotizador-dinamico';

const paso1Schema = z.object({
  clienteId: z.string().min(1, 'Seleccioná un cliente'),
  nombrePresupuesto: z.string().optional(),
  fechaVencimiento: z.string().optional(),
  fechaRecepcion: z.string().optional(),
  observaciones: z.string().optional(),
  descuento: z.number().min(0).max(100),
  prioridad: z.enum(['ALTA', 'MEDIA', 'BAJA']),
});

type Paso1Data = z.infer<typeof paso1Schema>;

interface ItemCatalogo {
  id: string;
  nombre: string;
  precioVenta: number;
  unidad: string;
  categoria: { nombre: string };
}

interface ProductoCatalogo {
  id: string;
  nombre: string;
  categoria: { nombre: string };
  atributos: {
    id: string;
    nombre: string;
    requerido: boolean;
    opciones: { id: string; nombre: string; precioVenta: number; unidad: string }[];
  }[];
}

interface LineaAdicional {
  itemId: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export default function NuevoPresupuestoPage() {
  const router = useRouter();
  const [paso, setPaso] = useState(1);
  const [clientes, setClientes] = useState<{ id: string; razonSocial: string }[]>([]);
  const [todosItems, setTodosItems] = useState<ItemCatalogo[]>([]);
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [itemsProducto, setItemsProducto] = useState<ItemProducto[]>([]);
  const [lineas, setLineas] = useState<LineaAdicional[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Paso1Data>({
    resolver: zodResolver(paso1Schema),
    defaultValues: { descuento: 0, prioridad: 'MEDIA' },
  });

  const descuento = watch('descuento') ?? 0;

  useEffect(() => {
    Promise.all([
      fetch('/api/clientes?all=true').then((r) => r.json()),
      fetch('/api/materiales/items?all=true').then((r) => r.json()),
      fetch('/api/productos').then((r) => r.json()),
    ]).then(([cls, items, prods]) => {
      setClientes(cls.clientes ?? []);
      setTodosItems(items.items ?? []);
      setProductos(prods.productos ?? []);
    });
  }, []);

  const agregarLinea = () => {
    setLineas([...lineas, { itemId: '', cantidad: 1, precioUnitario: 0, subtotal: 0 }]);
  };

  const updateLinea = (idx: number, field: keyof LineaAdicional, value: string | number) => {
    setLineas((prev) => {
      const updated = [...prev];
      if (field === 'itemId') {
        const item = todosItems.find((i) => i.id === value);
        updated[idx] = { ...updated[idx], itemId: value as string, precioUnitario: item?.precioVenta ?? 0, subtotal: (item?.precioVenta ?? 0) * updated[idx].cantidad };
      } else {
        updated[idx] = { ...updated[idx], [field]: value };
        updated[idx].subtotal = updated[idx].precioUnitario * updated[idx].cantidad;
      }
      return updated;
    });
  };

  const subtotalProductos = itemsProducto.reduce((s, i) => s + i.subtotal, 0);
  const subtotalLineas = lineas.reduce((s, l) => s + l.subtotal, 0);
  const subtotal = subtotalProductos + subtotalLineas;
  const descuentoMonto = subtotal * (Number(descuento) / 100);
  const total = subtotal - descuentoMonto;

  const guardar = async (data: Paso1Data, enviar: boolean) => {
    setIsSubmitting(true);

    const lineasPayload = [
      ...itemsProducto.map((item) => ({
        productoId: item.productoId,
        productoNombre: item.productoNombre,
        cantidad: item.cantidad,
        precioUnitario: item.subtotal / item.cantidad,
        subtotal: item.subtotal,
        opciones: item.opciones,
      })),
      ...lineas.filter((l) => l.itemId).map((l) => ({
        itemId: l.itemId,
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        subtotal: l.subtotal,
      })),
    ];

    const res = await fetch('/api/presupuestos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        puertas: [],
        lineas: lineasPayload,
        subtotal,
        totalFinal: total,
        estado: enviar ? 'ENVIADO' : 'BORRADOR',
      }),
    });
    setIsSubmitting(false);
    if (res.ok) {
      const json = await res.json();
      router.push(`/presupuestos/${json.id}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${paso >= s ? 'bg-sky-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{s}</div>
            {s < 3 && <div className={`h-0.5 w-16 ${paso > s ? 'bg-sky-500' : 'bg-slate-200'}`} />}
          </div>
        ))}
        <span className="ml-2 text-sm text-slate-500">
          {paso === 1 && 'Datos generales'}
          {paso === 2 && 'Productos cotizados'}
          {paso === 3 && 'Resumen y totales'}
        </span>
      </div>

      {/* Paso 1 — Datos generales */}
      {paso === 1 && (
        <Card>
          <CardHeader><CardTitle>Datos generales</CardTitle></CardHeader>
          <CardContent>
            <form id="paso1" onSubmit={handleSubmit(() => setPaso(2))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Nombre del presupuesto</Label>
                  <Input {...register('nombrePresupuesto')} placeholder="Ej: Reforma baño principal" />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label>Cliente *</Label>
                  <Select onValueChange={(v) => setValue('clienteId', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná un cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.razonSocial}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.clienteId && <p className="text-xs text-red-500">{errors.clienteId.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <Select defaultValue="MEDIA" onValueChange={(v) => setValue('prioridad', v as 'ALTA' | 'MEDIA' | 'BAJA')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALTA">Alta</SelectItem>
                      <SelectItem value="MEDIA">Media</SelectItem>
                      <SelectItem value="BAJA">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Descuento (%)</Label>
                  <Input type="number" min={0} max={100} step={0.5} {...register('descuento', { valueAsNumber: true })} />
                </div>

                <div className="space-y-2">
                  <Label>Fecha de recepción</Label>
                  <Input type="date" {...register('fechaRecepcion')} />
                </div>

                <div className="space-y-2">
                  <Label>Fecha de vencimiento</Label>
                  <Input type="date" {...register('fechaVencimiento')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observaciones</Label>
                <Textarea {...register('observaciones')} rows={3} placeholder="Notas adicionales..." />
              </div>

              <div className="flex justify-end">
                <Button type="submit" className="bg-sky-500 hover:bg-sky-600">
                  Siguiente <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Paso 2 — Cotizador dinámico */}
      {paso === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Productos cotizados</CardTitle>
            </CardHeader>
            <CardContent>
              <CotizadorDinamico
                productos={productos}
                items={itemsProducto}
                onChange={setItemsProducto}
              />
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setPaso(1)}>
              <ChevronLeft className="mr-2 h-4 w-4" /> Anterior
            </Button>
            <Button onClick={() => setPaso(3)} className="bg-sky-500 hover:bg-sky-600">
              Siguiente <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Paso 3 — Materiales adicionales + resumen */}
      {paso === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Materiales adicionales</CardTitle>
              <Button size="sm" onClick={agregarLinea} variant="outline">
                <Plus className="mr-1 h-4 w-4" /> Agregar línea
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {lineas.map((linea, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Select value={linea.itemId || '__none__'} onValueChange={(v) => updateLinea(idx, 'itemId', v === '__none__' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar ítem" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Seleccioná —</SelectItem>
                        {todosItems.map((i) => (
                          <SelectItem key={i.id} value={i.id}>{i.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input type="number" min={0.1} step={0.1} value={linea.cantidad} onChange={(e) => updateLinea(idx, 'cantidad', Number(e.target.value))} placeholder="Cant." />
                  </div>
                  <div className="col-span-3 text-sm font-medium text-right">
                    {formatCurrency(linea.subtotal)}
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setLineas(lineas.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {lineas.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-3">Sin materiales adicionales</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {itemsProducto.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-slate-600">{item.productoNombre} × {item.cantidad}</span>
                  <span>{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
              {lineas.filter((l) => l.itemId).map((l, idx) => {
                const item = todosItems.find((i) => i.id === l.itemId);
                return (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-slate-600">{item?.nombre ?? 'Ítem'} × {l.cantidad}</span>
                    <span>{formatCurrency(l.subtotal)}</span>
                  </div>
                );
              })}
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-red-600">
                  <span>Descuento ({descuento}%)</span>
                  <span>-{formatCurrency(descuentoMonto)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg text-sky-600">
                  <span>Total Final</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setPaso(2)}>
              <ChevronLeft className="mr-2 h-4 w-4" /> Anterior
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleSubmit((data) => guardar(data, false))} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> Guardar borrador
              </Button>
              <Button onClick={handleSubmit((data) => guardar(data, true))} className="bg-sky-500 hover:bg-sky-600" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" /> Guardar y enviar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
