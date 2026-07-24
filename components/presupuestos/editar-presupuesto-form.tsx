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
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Trash2, ChevronRight, ChevronLeft, Save, Send, ArrowLeft } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import type { EstadoPresupuesto } from '@prisma/client';
import { CotizadorDinamico, type ItemProducto } from '@/components/presupuestos/cotizador-dinamico';
import type { DivisionProductiva, RubroComponentePresupuesto } from '@prisma/client';

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

interface PresupuestoInicial {
  id: string;
  numero: number;
  clienteId: string;
  obraId: string;
  fechaVencimiento: string;
  observaciones: string;
  descuento: number;
  estado: EstadoPresupuesto;
  moneda?: string;
  division?: DivisionProductiva | null;
  esEstandar?: boolean;
  rubros?: RubroComponentePresupuesto[];
  fechaPrometidaCliente?: string | null;
  itemsProducto: ItemProducto[];
  lineas: LineaAdicional[];
}

export function EditarPresupuestoForm({ presupuesto }: { presupuesto: PresupuestoInicial }) {
  const router = useRouter();
  const [paso, setPaso] = useState(1);
  const [numeroDisponible, setNumeroDisponible] = useState<boolean | null>(null);
  const [checkingNumero, setCheckingNumero] = useState(false);
  const [clientes, setClientes] = useState<{ id: string; razonSocial: string }[]>([]);
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [todosItems, setTodosItems] = useState<ItemCatalogo[]>([]);
  const [itemsProducto, setItemsProducto] = useState<ItemProducto[]>(presupuesto.itemsProducto);
  const [lineas, setLineas] = useState<LineaAdicional[]>(presupuesto.lineas);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [obraId, setObraId] = useState(presupuesto.obraId);
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>((presupuesto.moneda as 'ARS' | 'USD') ?? 'ARS');
  const [obras, setObras] = useState<{ id: string; nombre: string }[]>([]);
  const [division, setDivision] = useState<string>(presupuesto.division ?? '');
  const [esEstandar, setEsEstandar] = useState(presupuesto.esEstandar ?? false);
  const [rubros, setRubros] = useState<string[]>(presupuesto.rubros ?? []);
  const [fechaPrometidaCliente, setFechaPrometidaCliente] = useState(presupuesto.fechaPrometidaCliente ? presupuesto.fechaPrometidaCliente.slice(0, 10) : '');

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

  const descuento = watch('descuento') ?? 0;
  const clienteIdActual = watch('clienteId');

  useEffect(() => {
    if (!clienteIdActual) { setObras([]); return; }
    fetch(`/api/clientes/${clienteIdActual}/obras`)
      .then((r) => r.json())
      .then((d) => {
        const lista = d.obras ?? [];
        setObras(lista);
        if (clienteIdActual !== presupuesto.clienteId) {
          setObraId('');
        }
      });
  }, [clienteIdActual, presupuesto.clienteId]);

  useEffect(() => {
    Promise.all([
      fetch('/api/clientes?all=true').then((r) => r.json()),
      fetch('/api/materiales/items?all=true').then((r) => r.json()),
      fetch('/api/productos').then((r) => r.json()),
    ]).then(([cls, items, prods]) => {
      setClientes(cls.clientes ?? []);
      setTodosItems(items.items ?? []);
      setProductos(prods.productos ?? []);
      setValue('clienteId', presupuesto.clienteId);
    });
  }, [presupuesto.clienteId, setValue]);

  const verificarNumero = async (n: number) => {
    if (!n || isNaN(n) || n === presupuesto.numero) { setNumeroDisponible(null); return; }
    setCheckingNumero(true);
    const res = await fetch(`/api/presupuestos/verificar-numero?numero=${n}&excludeId=${presupuesto.id}`);
    const data = await res.json();
    setNumeroDisponible(data.disponible);
    setCheckingNumero(false);
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
          precioUnitario: parseFloat(String(item?.precioVenta ?? 0)),
          subtotal: parseFloat(String(item?.precioVenta ?? 0)) * updated[idx].cantidad,
        };
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
    if (division === 'MIXTO' && rubros.length < 2) return;
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
    const res = await fetch(`/api/presupuestos/${presupuesto.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        moneda,
        obraId: obraId || null,
        division: division || null,
        esEstandar,
        rubros,
        fechaPrometidaCliente: fechaPrometidaCliente || null,
        puertas: [],
        lineas: lineasPayload,
        subtotal,
        totalFinal: total,
        estado: enviar ? 'ENVIADO' : presupuesto.estado,
      }),
    });
    setIsSubmitting(false);
    if (res.ok) router.push(`/presupuestos/${presupuesto.id}`);
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
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${paso >= s ? 'bg-[#00ADEF] text-white' : 'bg-slate-200 text-slate-500'}`}>
              {s}
            </div>
            {s < 3 && <div className={`h-0.5 w-16 ${paso > s ? 'bg-[#00ADEF]' : 'bg-slate-200'}`} />}
          </div>
        ))}
        <span className="ml-2 text-sm text-slate-500">
          {paso === 1 && 'Datos generales'}
          {paso === 2 && 'Productos cotizados'}
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
                <SearchableSelect
                  value={watch('clienteId') || presupuesto.clienteId}
                  onValueChange={(v) => setValue('clienteId', v, { shouldValidate: true })}
                  options={clientes.map((c) => ({ value: c.id, label: c.razonSocial }))}
                  placeholder="Seleccioná un cliente"
                  searchPlaceholder="Buscar cliente…"
                  emptyText="Sin resultados"
                />
                {errors.clienteId && <p className="text-xs text-red-500">{errors.clienteId.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Moneda del presupuesto</Label>
                <div className="flex gap-3">
                  {(['ARS', 'USD'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMoneda(m)}
                      className={`flex-1 py-2 px-4 rounded-md border text-sm font-medium transition-colors ${
                        moneda === m
                          ? m === 'USD'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-[#00ADEF] bg-[#E6F1FB] text-[#0C447C]'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {m === 'ARS' ? '$ ARS — Pesos' : 'U$D USD — Dólares'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Obra</Label>
                <SearchableSelect
                  value={obraId || ''}
                  onValueChange={(v) => setObraId(v)}
                  options={[
                    { value: '', label: 'Sin obra' },
                    ...obras.map((o) => ({ value: o.id, label: o.nombre })),
                  ]}
                  placeholder={
                    obras.length === 0
                      ? 'Sin obras para este cliente'
                      : 'Sin obra asignada'
                  }
                  searchPlaceholder="Buscar obra…"
                  emptyText="Sin obras para este cliente"
                />
              </div>

              {/* División productiva */}
              <div className="space-y-2">
                <Label>División productiva</Label>
                <Select
                  value={division || '__none__'}
                  onValueChange={(v) => {
                    const val = v === '__none__' ? '' : v;
                    setDivision(val);
                    if (val !== 'MIXTO') setRubros([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin selección" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin selección</SelectItem>
                    <SelectItem value="MADERA">Madera</SelectItem>
                    <SelectItem value="MELAMINA">Melamina</SelectItem>
                    <SelectItem value="ALUMINIO">Aluminio</SelectItem>
                    <SelectItem value="MIXTO">Mixto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Rubros MIXTO */}
              {division === 'MIXTO' && (
                <div className="space-y-2">
                  <Label>Rubros del presupuesto mixto *</Label>
                  <div className="flex gap-4">
                    {(['MADERA', 'MELAMINA', 'ALUMINIO'] as const).map((r) => (
                      <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rubros.includes(r)}
                          onChange={(e) => setRubros(prev => e.target.checked ? [...prev, r] : prev.filter(x => x !== r))}
                          className="rounded border-slate-300"
                        />
                        {r.charAt(0) + r.slice(1).toLowerCase()}
                      </label>
                    ))}
                  </div>
                  {rubros.length === 0 && presupuesto.division === 'MIXTO' && (
                    <p className="text-xs text-amber-600">Este presupuesto mixto todavía no tiene rubros especificados.</p>
                  )}
                  {rubros.length > 0 && rubros.length < 2 && (
                    <p className="text-xs text-red-500">Seleccioná al menos 2 rubros para un presupuesto mixto</p>
                  )}
                </div>
              )}

              {/* Estándar */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={esEstandar}
                    onChange={(e) => setEsEstandar(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm font-medium">Presupuesto estándar</span>
                </label>
                <p className="text-xs text-slate-400 ml-6">Objetivo de finalización: hasta 27 horas hábiles.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha de vencimiento</Label>
                  <Input type="date" {...register('fechaVencimiento')} />
                </div>
                <div className="space-y-2">
                  <Label>Fecha prometida al cliente</Label>
                  <Input type="date" value={fechaPrometidaCliente} onChange={(e) => setFechaPrometidaCliente(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Descuento (%)</Label>
                  <Input type="number" min={0} max={100} step={0.5} {...register('descuento', { valueAsNumber: true })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observaciones</Label>
                <Textarea {...register('observaciones')} rows={3} placeholder="Notas adicionales..." />
              </div>

              <div className="flex justify-end">
                <Button type="submit" className="bg-[#00ADEF] hover:bg-[#0089C7]">
                  Siguiente <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Paso 2 — Cotizador */}
      {paso === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Productos cotizados</CardTitle></CardHeader>
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
            <Button onClick={() => setPaso(3)} className="bg-[#00ADEF] hover:bg-[#0089C7]">
              Siguiente <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Paso 3 */}
      {paso === 3 && (
        <div className="space-y-4">
          {/* Materiales adicionales */}
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
                      value={linea.itemId || '__none__'}
                      onValueChange={(v) => updateLinea(idx, 'itemId', v === '__none__' ? '' : v)}
                    >
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
                    <Input
                      type="number" min={0.1} step={0.1}
                      value={linea.cantidad}
                      onChange={(e) => updateLinea(idx, 'cantidad', Number(e.target.value))}
                      placeholder="Cant."
                    />
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
                <p className="text-center text-slate-400 text-sm py-4">Sin materiales adicionales</p>
              )}
            </CardContent>
          </Card>

          {/* Resumen */}
          <Card>
            <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {itemsProducto.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-slate-600">{item.productoNombre} × {item.cantidad}</span>
                  <span>{formatCurrency(item.subtotal)}</span>
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
                <div className="flex justify-between font-bold text-lg text-[#00ADEF]">
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
                <Save className="mr-2 h-4 w-4" /> Guardar cambios
              </Button>
              <Button onClick={handleSubmit((data) => guardar(data, true))} className="bg-[#00ADEF] hover:bg-[#0089C7]" disabled={isSubmitting}>
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
