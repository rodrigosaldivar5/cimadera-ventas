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
import { Loader2, Plus, Trash2, ChevronRight, ChevronLeft, Save, Send, ArrowLeft } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import type { EstadoPresupuesto } from '@prisma/client';

const paso1Schema = z.object({
  numero: z.number().int().min(1, 'Número inválido'),
  clienteId: z.string().min(1, 'Seleccioná un cliente'),
  fechaVencimiento: z.string().optional(),
  observaciones: z.string().optional(),
  descuento: z.number().min(0).max(100),
});

type Paso1Data = z.infer<typeof paso1Schema>;

interface ItemCatalogo {
  id: string;
  nombre: string;
  precioVenta: number;
  unidad: string;
  categoria: { nombre: string };
}

interface TipoPuerta { id: string; nombre: string; }

interface PuertaConfig {
  tipoPuertaId: string;
  cantidad: number;
  ancho: number;
  alto: number;
  bisagraId: string;
  cerraduraId: string;
  chapaId: string;
  marcoId: string;
  hojaId: string;
  colorMarca: string;
  observaciones: string;
  precioUnitario: number;
  subtotal: number;
}

interface LineaAdicional {
  itemId: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

interface PresupuestoInicial {
  id: string;
  numero: number;
  clienteId: string;
  fechaVencimiento: string;
  observaciones: string;
  descuento: number;
  estado: EstadoPresupuesto;
  puertas: PuertaConfig[];
  lineas: LineaAdicional[];
}

export function EditarPresupuestoForm({ presupuesto }: { presupuesto: PresupuestoInicial }) {
  const router = useRouter();
  const [paso, setPaso] = useState(1);
  const [numeroDisponible, setNumeroDisponible] = useState<boolean | null>(null);
  const [checkingNumero, setCheckingNumero] = useState(false);
  const [clientes, setClientes] = useState<{ id: string; razonSocial: string }[]>([]);
  const [tiposPuerta, setTiposPuerta] = useState<TipoPuerta[]>([]);
  const [itemsBisagra, setItemsBisagra] = useState<ItemCatalogo[]>([]);
  const [itemsCerradura, setItemsCerradura] = useState<ItemCatalogo[]>([]);
  const [itemsChapa, setItemsChapa] = useState<ItemCatalogo[]>([]);
  const [itemsMarco, setItemsMarco] = useState<ItemCatalogo[]>([]);
  const [itemsHoja, setItemsHoja] = useState<ItemCatalogo[]>([]);
  const [todosItems, setTodosItems] = useState<ItemCatalogo[]>([]);
  const [puertas, setPuertas] = useState<PuertaConfig[]>(presupuesto.puertas);
  const [lineas, setLineas] = useState<LineaAdicional[]>(presupuesto.lineas);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Paso1Data>({
    resolver: zodResolver(paso1Schema),
    defaultValues: {
      numero: presupuesto.numero,
      clienteId: presupuesto.clienteId,
      fechaVencimiento: presupuesto.fechaVencimiento,
      observaciones: presupuesto.observaciones,
      descuento: presupuesto.descuento,
    },
  });

  const verificarNumero = async (n: number) => {
    if (!n || isNaN(n) || n === presupuesto.numero) { setNumeroDisponible(null); return; }
    setCheckingNumero(true);
    const res = await fetch(`/api/presupuestos/verificar-numero?numero=${n}&excludeId=${presupuesto.id}`);
    const data = await res.json();
    setNumeroDisponible(data.disponible);
    setCheckingNumero(false);
  };

  const descuento = watch('descuento') ?? 0;

  useEffect(() => {
    Promise.all([
      fetch('/api/clientes?all=true').then((r) => r.json()),
      fetch('/api/materiales/tipos-puerta').then((r) => r.json()),
      fetch('/api/materiales/items?all=true').then((r) => r.json()),
    ]).then(([cls, tipos, items]) => {
      setClientes(cls.clientes ?? []);
      setTiposPuerta(tipos.tipos ?? []);
      const allItems: ItemCatalogo[] = items.items ?? [];
      setTodosItems(allItems);
      setItemsBisagra(allItems.filter((i) => i.categoria.nombre === 'Bisagras'));
      setItemsCerradura(allItems.filter((i) => i.categoria.nombre === 'Cerraduras'));
      setItemsChapa(allItems.filter((i) => i.categoria.nombre === 'Chapas'));
      setItemsMarco(allItems.filter((i) => i.categoria.nombre === 'Marcos'));
      setItemsHoja(allItems.filter((i) => i.categoria.nombre === 'Hojas de Puerta'));
      // Pre-seleccionar el cliente actual
      setValue('clienteId', presupuesto.clienteId);
    });
  }, [presupuesto.clienteId, setValue]);

  const calcularPuerta = (p: PuertaConfig): number => {
    const sup = p.ancho * p.alto;
    const perim = 2 * (p.ancho + p.alto);
    const bisagra = itemsBisagra.find((i) => i.id === p.bisagraId)?.precioVenta ?? 0;
    const cerradura = itemsCerradura.find((i) => i.id === p.cerraduraId)?.precioVenta ?? 0;
    const chapa = itemsChapa.find((i) => i.id === p.chapaId)?.precioVenta ?? 0;
    const marco = (itemsMarco.find((i) => i.id === p.marcoId)?.precioVenta ?? 0) * perim;
    const hoja = (itemsHoja.find((i) => i.id === p.hojaId)?.precioVenta ?? 0) * sup;
    return bisagra + cerradura + chapa + marco + hoja;
  };

  const agregarPuerta = () => {
    setPuertas([...puertas, {
      tipoPuertaId: tiposPuerta[0]?.id ?? '',
      cantidad: 1, ancho: 0.9, alto: 2.1,
      bisagraId: '', cerraduraId: '', chapaId: '', marcoId: '', hojaId: '',
      colorMarca: '', observaciones: '', precioUnitario: 0, subtotal: 0,
    }]);
  };

  const updatePuerta = (idx: number, field: keyof PuertaConfig, value: string | number) => {
    setPuertas((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      const precio = calcularPuerta(updated[idx]);
      updated[idx].precioUnitario = precio;
      updated[idx].subtotal = precio * updated[idx].cantidad;
      return updated;
    });
  };

  const agregarLinea = () => {
    setLineas([...lineas, { itemId: '', cantidad: 1, precioUnitario: 0, subtotal: 0 }]);
  };

  const updateLinea = (idx: number, field: keyof LineaAdicional, value: string | number) => {
    setLineas((prev) => {
      const updated = [...prev];
      if (field === 'itemId') {
        const item = todosItems.find((i) => i.id === value);
        updated[idx] = {
          ...updated[idx],
          itemId: value as string,
          precioUnitario: item?.precioVenta ?? 0,
          subtotal: (item?.precioVenta ?? 0) * updated[idx].cantidad,
        };
      } else {
        updated[idx] = { ...updated[idx], [field]: value };
        updated[idx].subtotal = updated[idx].precioUnitario * updated[idx].cantidad;
      }
      return updated;
    });
  };

  const subtotalPuertas = puertas.reduce((s, p) => s + p.subtotal, 0);
  const subtotalLineas = lineas.reduce((s, l) => s + l.subtotal, 0);
  const subtotal = subtotalPuertas + subtotalLineas;
  const descuentoMonto = subtotal * (Number(descuento) / 100);
  const total = subtotal - descuentoMonto;

  const guardar = async (data: Paso1Data, enviar: boolean) => {
    setIsSubmitting(true);
    const res = await fetch(`/api/presupuestos/${presupuesto.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        numero: data.numero,
        puertas,
        lineas,
        subtotal,
        totalFinal: total,
        estado: enviar ? 'ENVIADO' : presupuesto.estado,
      }),
    });
    setIsSubmitting(false);
    if (res.ok) {
      router.push(`/presupuestos/${presupuesto.id}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href={`/presupuestos/${presupuesto.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Link>
        </Button>
        <h2 className="text-sm text-slate-500 font-medium">
          Editando Presupuesto #{presupuesto.numero}
        </h2>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${paso >= s ? 'bg-sky-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
              {s}
            </div>
            {s < 3 && <div className={`h-0.5 w-16 ${paso > s ? 'bg-sky-500' : 'bg-slate-200'}`} />}
          </div>
        ))}
        <span className="ml-2 text-sm text-slate-500">
          {paso === 1 && 'Datos generales'}
          {paso === 2 && 'Configuración de puertas'}
          {paso === 3 && 'Resumen y totales'}
        </span>
      </div>

      {/* Paso 1 */}
      {paso === 1 && (
        <Card>
          <CardHeader><CardTitle>Datos generales</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(() => setPaso(2))} className="space-y-4">
              <div className="space-y-2">
                <Label>Número de presupuesto *</Label>
                <Input
                  type="number"
                  min={1}
                  {...register('numero', { valueAsNumber: true })}
                  onBlur={(e) => verificarNumero(Number(e.target.value))}
                  className={numeroDisponible === false ? 'border-red-400' : ''}
                />
                {checkingNumero && <p className="text-xs text-slate-400">Verificando...</p>}
                {!checkingNumero && numeroDisponible === false && (
                  <p className="text-xs text-red-500">Este número ya está en uso</p>
                )}
                {errors.numero && <p className="text-xs text-red-500">{errors.numero.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select
                  defaultValue={presupuesto.clienteId}
                  onValueChange={(v) => setValue('clienteId', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná un cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.razonSocial}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.clienteId && (
                  <p className="text-xs text-red-500">{errors.clienteId.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha de vencimiento</Label>
                  <Input type="date" {...register('fechaVencimiento')} />
                </div>
                <div className="space-y-2">
                  <Label>Descuento (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    {...register('descuento', { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observaciones generales</Label>
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

      {/* Paso 2 */}
      {paso === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Configuración de puertas</CardTitle>
              <Button size="sm" onClick={agregarPuerta} className="bg-sky-500 hover:bg-sky-600">
                <Plus className="mr-1 h-4 w-4" /> Agregar puerta
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {puertas.map((puerta, idx) => (
                <div key={idx} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Puerta #{idx + 1}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500"
                      onClick={() => setPuertas(puertas.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1 col-span-2">
                      <Label>Tipo</Label>
                      <Select
                        value={puerta.tipoPuertaId}
                        onValueChange={(v) => updatePuerta(idx, 'tipoPuertaId', v)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {tiposPuerta.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        min={1}
                        value={puerta.cantidad}
                        onChange={(e) => updatePuerta(idx, 'cantidad', Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Color/Terminación</Label>
                      <Input
                        value={puerta.colorMarca}
                        onChange={(e) => updatePuerta(idx, 'colorMarca', e.target.value)}
                        placeholder="Ej: Blanco"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Ancho (m)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={puerta.ancho}
                        onChange={(e) => updatePuerta(idx, 'ancho', Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Alto (m)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={puerta.alto}
                        onChange={(e) => updatePuerta(idx, 'alto', Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { label: 'Bisagra', field: 'bisagraId' as const, items: itemsBisagra },
                      { label: 'Cerradura', field: 'cerraduraId' as const, items: itemsCerradura },
                      { label: 'Chapa/Tirador', field: 'chapaId' as const, items: itemsChapa },
                      { label: 'Marco', field: 'marcoId' as const, items: itemsMarco },
                      { label: 'Hoja', field: 'hojaId' as const, items: itemsHoja },
                    ].map(({ label, field, items }) => (
                      <div key={field} className="space-y-1">
                        <Label>{label}</Label>
                        <Select
                          value={puerta[field]}
                          onValueChange={(v) => updatePuerta(idx, field, v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Seleccionar ${label.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Sin {label.toLowerCase()}</SelectItem>
                            {items.map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.nombre} — {formatCurrency(i.precioVenta)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <Label>Observaciones de esta puerta</Label>
                    <Input
                      value={puerta.observaciones}
                      onChange={(e) => updatePuerta(idx, 'observaciones', e.target.value)}
                      placeholder="Notas específicas..."
                    />
                  </div>

                  <div className="flex justify-end gap-4 text-sm font-medium text-slate-700">
                    <span>Precio unitario: {formatCurrency(puerta.precioUnitario)}</span>
                    <span className="text-sky-600">Subtotal: {formatCurrency(puerta.subtotal)}</span>
                  </div>
                </div>
              ))}

              {puertas.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  No hay puertas. Hacé click en "Agregar puerta".
                </div>
              )}
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

      {/* Paso 3 */}
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
                    <Select
                      value={linea.itemId}
                      onValueChange={(v) => updateLinea(idx, 'itemId', v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Seleccionar ítem" /></SelectTrigger>
                      <SelectContent>
                        {todosItems.map((i) => (
                          <SelectItem key={i.id} value={i.id}>{i.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={linea.cantidad}
                      onChange={(e) => updateLinea(idx, 'cantidad', Number(e.target.value))}
                      placeholder="Cant."
                    />
                  </div>
                  <div className="col-span-3 text-sm font-medium text-right">
                    {formatCurrency(linea.subtotal)}
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500"
                      onClick={() => setLineas(lineas.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {lineas.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-4">
                  Sin materiales adicionales
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {puertas.map((p, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-slate-600">Puerta #{idx + 1} × {p.cantidad}</span>
                  <span>{formatCurrency(p.subtotal)}</span>
                </div>
              ))}
              {lineas.map((l, idx) => {
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
              <Button
                variant="outline"
                onClick={handleSubmit((data) => guardar(data, false))}
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> Guardar cambios
              </Button>
              <Button
                onClick={handleSubmit((data) => guardar(data, true))}
                className="bg-sky-500 hover:bg-sky-600"
                disabled={isSubmitting}
              >
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
