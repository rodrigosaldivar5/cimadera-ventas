'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Trash2, ChevronRight, ChevronLeft, Save, Send, AlertTriangle, ExternalLink, Clock, RotateCcw } from 'lucide-react';
import { formatCurrency, calcularIva } from '@/lib/utils';
import { CotizadorDinamico, type ItemProducto } from '@/components/presupuestos/cotizador-dinamico';
import { TIPO_CLIENTE, TIPO_CLIENTE_LABEL, type TipoCliente } from '@/lib/enums';

const DRAFT_KEY = 'presupuesto-nuevo-draft';

const paso1Schema = z.object({
  numero: z.number().int().min(1, 'Número inválido').optional(),
  clienteId: z.string().min(1, 'Seleccioná un cliente'),
  obraId: z.string().optional(),
  responsableId: z.string().optional(),
  nombrePresupuesto: z.string().optional(),
  fechaVencimiento: z.string().optional(),
  fechaRecepcion: z.string().optional(),
  observaciones: z.string().optional(),
  descuento: z.number().min(0).max(100),
  prioridad: z.enum(['ALTA', 'MEDIA', 'BAJA']),
});

const nuevoClienteSchema = z.object({
  razonSocial: z.string().min(2, 'Razón social requerida'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefono: z.string().optional(),
  tipoCliente: z.enum(['CONSTRUCTORA', 'DESARROLLADOR', 'PARTICULAR']),
});

type Paso1Data = z.infer<typeof paso1Schema>;
type NuevoClienteData = z.infer<typeof nuevoClienteSchema>;

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

interface LineaLibre {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

type Criterio = { id: string; titulo: string; descripcion: string | null };

export default function NuevoPresupuestoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clienteIdParam = searchParams.get('clienteId') ?? '';

  const [paso, setPaso] = useState(1);
  const [clientes, setClientes] = useState<{ id: string; razonSocial: string; tipoCliente?: string }[]>([]);
  const [todosItems, setTodosItems] = useState<ItemCatalogo[]>([]);
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [itemsProducto, setItemsProducto] = useState<ItemProducto[]>([]);
  const [lineas, setLineas] = useState<LineaAdicional[]>([]);
  const [lineasLibres, setLineasLibres] = useState<LineaLibre[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingPendiente, setIsSavingPendiente] = useState(false);
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [criteriosBanner, setCriteriosBanner] = useState(false);
  const [tasaIva, setTasaIva] = useState<number>(21);
  const [preciosNetos, setPreciosNetos] = useState(true);
  const [nuevoClienteOpen, setNuevoClienteOpen] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftDate, setDraftDate] = useState('');
  const [numeroDisponible, setNumeroDisponible] = useState<boolean | null>(null);
  const [checkingNumero, setCheckingNumero] = useState(false);
  const [nextNumero, setNextNumero] = useState<number>(0);
  const [obras, setObras] = useState<{ id: string; nombre: string }[]>([]);
  const [nuevaObraOpen, setNuevaObraOpen] = useState(false);
  const [nuevaObraNombre, setNuevaObraNombre] = useState('');
  const [nuevaObraDireccion, setNuevaObraDireccion] = useState('');
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string }[]>([]);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Paso1Data>({
    resolver: zodResolver(paso1Schema),
    defaultValues: { descuento: 0, prioridad: 'MEDIA', clienteId: clienteIdParam },
  });

  const { register: regCliente, handleSubmit: handleCliente, reset: resetCliente, setValue: setValueCliente, formState: { errors: errCliente } } = useForm<NuevoClienteData>({
    resolver: zodResolver(nuevoClienteSchema),
    defaultValues: { tipoCliente: 'PARTICULAR' },
  });

  const descuento = watch('descuento') ?? 0;
  const clienteId = watch('clienteId');

  useEffect(() => {
    // Check for saved draft on mount
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setHasDraft(true);
        setDraftDate(new Date(parsed.savedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }));
      } catch { /* ignore */ }
    }

    Promise.all([
      fetch('/api/clientes?all=true').then((r) => r.json()),
      fetch('/api/materiales/items?all=true').then((r) => r.json()),
      fetch('/api/productos').then((r) => r.json()),
      fetch('/api/presupuestos/siguiente-numero').then((r) => r.json()),
      fetch('/api/usuarios/activos').then((r) => r.json()),
    ]).then(([cls, items, prods, sig, usrs]) => {
      setClientes(cls.clientes ?? []);
      setTodosItems(items.items ?? []);
      setProductos(prods.productos ?? []);
      setNextNumero(sig.numero ?? 1001);
      setUsuarios(usrs.usuarios ?? []);
      if (usrs.currentUserId) setValue('responsableId', usrs.currentUserId);
    });
  }, []);

  // Auto-save to localStorage every 30s
  const saveDraft = useCallback(() => {
    const formData = watch();
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      formData,
      itemsProducto,
      lineas,
      lineasLibres,
      paso,
      savedAt: new Date().toISOString(),
    }));
  }, [watch, itemsProducto, lineas, lineasLibres, paso]);

  useEffect(() => {
    const interval = setInterval(saveDraft, 30000);
    return () => clearInterval(interval);
  }, [saveDraft]);

  // Unsaved changes warning
  useEffect(() => {
    const handle = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handle);
    return () => window.removeEventListener('beforeunload', handle);
  }, []);

  const recoverDraft = () => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      const fd = parsed.formData ?? {};
      Object.entries(fd).forEach(([k, v]) => setValue(k as keyof Paso1Data, v as never));
      setItemsProducto(parsed.itemsProducto ?? []);
      setLineas(parsed.lineas ?? []);
      setLineasLibres(parsed.lineasLibres ?? []);
      setPaso(parsed.paso ?? 1);
      setHasDraft(false);
    } catch { /* ignore */ }
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
  };

  const verificarNumero = async (n: number) => {
    if (!n || isNaN(n)) return;
    setCheckingNumero(true);
    const res = await fetch(`/api/presupuestos/verificar-numero?numero=${n}`);
    const data = await res.json();
    setNumeroDisponible(data.disponible);
    setCheckingNumero(false);
  };

  // Fetch descuento, criterios y obras cuando se selecciona cliente
  useEffect(() => {
    if (!clienteId) { setObras([]); return; }
    fetch(`/api/clientes/${clienteId}/indice`).then((r) => r.json()).then((data) => {
      setValue('descuento', Number(data.descuento));
    });
    fetch(`/api/clientes/${clienteId}/criterios`).then((r) => r.json()).then((data) => {
      const activos = (data.criterios ?? []).filter((c: { activo: boolean }) => c.activo);
      setCriterios(activos);
      setCriteriosBanner(activos.length > 0);
    });
    fetch(`/api/clientes/${clienteId}/obras`).then((r) => r.json()).then((data) => {
      setObras(data.obras ?? []);
    });
    setValue('obraId', undefined);
  }, [clienteId, setValue]);

  const tipoClienteLabel = () => {
    const c = clientes.find((cl) => cl.id === clienteId);
    if (!c?.tipoCliente) return '';
    return TIPO_CLIENTE_LABEL[(c.tipoCliente as TipoCliente)] ?? '';
  };

  const crearObraInline = async () => {
    if (!clienteId || !nuevaObraNombre.trim()) return;
    const res = await fetch(`/api/clientes/${clienteId}/obras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nuevaObraNombre.trim(), direccion: nuevaObraDireccion || null }),
    });
    if (!res.ok) return;
    const obra = await res.json();
    setObras((prev) => [...prev, { id: obra.id, nombre: obra.nombre }]);
    setValue('obraId', obra.id);
    setNuevaObraOpen(false);
    setNuevaObraNombre('');
    setNuevaObraDireccion('');
  };

  const crearClienteInline = async (data: NuevoClienteData) => {
    const res = await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return;
    const cliente = await res.json();
    setClientes((prev) => [...prev, { id: cliente.id, razonSocial: cliente.razonSocial, tipoCliente: cliente.tipoCliente }]);
    setValue('clienteId', cliente.id);
    setNuevoClienteOpen(false);
    resetCliente();
  };

  const guardarPendiente = async () => {
    const cId = watch('clienteId');
    if (!cId) return;
    setIsSavingPendiente(true);
    const res = await fetch('/api/presupuestos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero: watch('numero') || nextNumero,
        clienteId: cId,
        nombrePresupuesto: watch('nombrePresupuesto') || null,
        prioridad: watch('prioridad') ?? 'MEDIA',
        responsableId: watch('responsableId') || null,
        observaciones: watch('observaciones') || null,
        estado: 'PENDIENTE',
        descuento: 0,
        subtotal: 0,
        totalFinal: 0,
        puertas: [],
        lineas: [],
      }),
    });
    setIsSavingPendiente(false);
    if (res.ok) {
      localStorage.removeItem(DRAFT_KEY);
      router.push('/presupuestos');
    }
  };

  // Líneas de catálogo
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

  // Líneas libres (ítems adicionales)
  const agregarLineaLibre = () => {
    setLineasLibres([...lineasLibres, { descripcion: '', cantidad: 1, precioUnitario: 0, subtotal: 0 }]);
  };

  const updateLineaLibre = (idx: number, field: keyof LineaLibre, value: string | number) => {
    setLineasLibres((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === 'cantidad' || field === 'precioUnitario') {
        updated[idx].subtotal = Number(updated[idx].cantidad) * Number(updated[idx].precioUnitario);
      }
      return updated;
    });
  };

  const subtotalProductos = itemsProducto.reduce((s, i) => s + i.subtotal, 0);
  const subtotalLineas = lineas.reduce((s, l) => s + l.subtotal, 0);
  const subtotalLibres = lineasLibres.reduce((s, l) => s + l.subtotal, 0);
  const subtotal = subtotalProductos + subtotalLineas + subtotalLibres;
  const descuentoMonto = subtotal * (Number(descuento) / 100);
  const total = subtotal - descuentoMonto;
  const ivaResult = calcularIva(total, tasaIva);

  const guardar = async (data: Paso1Data, enviar: boolean) => {
    setIsSubmitting(true);
    const numero = data.numero ?? nextNumero;

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
      ...lineasLibres.filter((l) => l.descripcion.trim()).map((l) => ({
        productoNombre: l.descripcion.trim(),
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
        numero,
        puertas: [],
        lineas: lineasPayload,
        subtotal,
        totalFinal: total,
        tasaIva,
        montoIva: ivaResult.montoIva,
        totalConIva: ivaResult.totalConIva,
        preciosNetos,
        estado: enviar ? 'ENVIADO' : 'EN_PROCESO',
        obraId: data.obraId || null,
      }),
    });
    setIsSubmitting(false);
    if (res.ok) {
      localStorage.removeItem(DRAFT_KEY);
      const json = await res.json();
      router.push(`/presupuestos/${json.id}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Recovery banner */}
      {hasDraft && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-center gap-3">
          <RotateCcw className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-sm text-amber-700 flex-1">Hay un borrador guardado automáticamente el {draftDate}.</span>
          <Button size="sm" variant="outline" onClick={recoverDraft} className="shrink-0">Recuperar</Button>
          <Button size="sm" variant="ghost" onClick={discardDraft} className="shrink-0 text-amber-600">Descartar</Button>
        </div>
      )}

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

      {/* Paso 1 */}
      {paso === 1 && (
        <Card>
          <CardHeader><CardTitle>Datos generales</CardTitle></CardHeader>
          <CardContent>
            <form id="paso1" onSubmit={handleSubmit(() => setPaso(2))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Número de presupuesto *</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder={nextNumero ? String(nextNumero) : ''}
                    value={watch('numero') ?? ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setValue('numero', isNaN(val) ? undefined : val, { shouldValidate: false });
                    }}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value);
                      if (!val && nextNumero) {
                        setValue('numero', nextNumero);
                        verificarNumero(nextNumero);
                      } else if (val) {
                        verificarNumero(val);
                      }
                    }}
                    className={numeroDisponible === false ? 'border-red-400' : ''}
                  />
                  {checkingNumero && <p className="text-xs text-slate-400">Verificando...</p>}
                  {!checkingNumero && numeroDisponible === false && (
                    <p className="text-xs text-red-500">Este número ya está en uso</p>
                  )}
                  {errors.numero && <p className="text-xs text-red-500">{errors.numero.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Nombre del presupuesto</Label>
                  <Input {...register('nombrePresupuesto')} placeholder="Ej: Reforma baño principal" />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label>Cliente *</Label>
                  <div className="flex gap-2">
                    <Select
                      defaultValue={clienteIdParam || undefined}
                      onValueChange={(v) => setValue('clienteId', v)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccioná un cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.razonSocial}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="sm" onClick={() => setNuevoClienteOpen(true)} className="shrink-0">
                      <Plus className="mr-1 h-3.5 w-3.5" /> Nuevo
                    </Button>
                  </div>
                  {errors.clienteId && <p className="text-xs text-red-500">{errors.clienteId.message}</p>}
                </div>

                {/* Banner criterios */}
                {criteriosBanner && criterios.length > 0 && (
                  <div className="col-span-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-800">
                          Este cliente tiene {criterios.length} criterio{criterios.length > 1 ? 's' : ''} activo{criterios.length > 1 ? 's' : ''}
                        </p>
                        <ul className="mt-1 space-y-1">
                          {criterios.map((c) => (
                            <li key={c.id} className="text-xs text-amber-700">
                              <span className="font-medium">• {c.titulo}</span>
                              {c.descripcion && <span className="text-amber-600"> — {c.descripcion}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCriteriosBanner(false)}
                        className="text-amber-400 hover:text-amber-600 text-xs shrink-0"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Responsable */}
                <div className="col-span-2 space-y-2">
                  <Label>Responsable</Label>
                  <Select
                    value={watch('responsableId') || '__none__'}
                    onValueChange={(v) => setValue('responsableId', v === '__none__' ? undefined : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin responsable asignado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin responsable</SelectItem>
                      {usuarios.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Selector de obra */}
                {clienteId && (
                  <div className="col-span-2 space-y-2">
                    <Label>Obra (opcional)</Label>
                    <div className="flex gap-2">
                      <Select
                        value={watch('obraId') || '__none__'}
                        onValueChange={(v) => setValue('obraId', v === '__none__' ? undefined : v)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Sin obra asociada" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin obra</SelectItem>
                          {obras.map((o) => (
                            <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="sm" onClick={() => setNuevaObraOpen(true)} className="shrink-0">
                        <Plus className="mr-1 h-3.5 w-3.5" /> Nueva obra
                      </Button>
                    </div>
                  </div>
                )}

                {/* Tipo cliente */}
                {clienteId && (
                  <div className="space-y-2">
                    <Label>Tipo de cliente</Label>
                    <Input value={tipoClienteLabel()} disabled className="bg-slate-50 text-slate-500" />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <Select defaultValue="MEDIA" onValueChange={(v) => setValue('prioridad', v as 'ALTA' | 'MEDIA' | 'BAJA')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                  {clienteId && <p className="text-xs text-slate-400">Auto-completado según tipo de cliente. Editable.</p>}
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

              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={guardarPendiente}
                  disabled={isSavingPendiente || !watch('clienteId')}
                >
                  {isSavingPendiente && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Clock className="mr-2 h-4 w-4" /> Guardar como pendiente
                </Button>
                <Button type="submit" className="bg-sky-500 hover:bg-sky-600">
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
            <Button onClick={() => setPaso(3)} className="bg-sky-500 hover:bg-sky-600">
              Siguiente <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Paso 3 — Materiales + ítems libres + resumen */}
      {paso === 3 && (
        <div className="space-y-4">
          {/* Materiales de catálogo */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Materiales adicionales</CardTitle>
              <Button size="sm" onClick={agregarLinea} variant="outline">
                <Plus className="mr-1 h-4 w-4" /> Agregar del catálogo
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
                        {todosItems.map((i) => <SelectItem key={i.id} value={i.id}>{i.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input type="number" min={0.1} step={0.1} value={linea.cantidad} onChange={(e) => updateLinea(idx, 'cantidad', Number(e.target.value))} placeholder="Cant." />
                  </div>
                  <div className="col-span-3 text-sm font-medium text-right">{formatCurrency(linea.subtotal)}</div>
                  <div className="col-span-2 flex justify-end">
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setLineas(lineas.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {lineas.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-3">Sin materiales de catálogo</p>
              )}
            </CardContent>
          </Card>

          {/* Ítems adicionales libres */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Ítems adicionales</CardTitle>
              <Button size="sm" onClick={agregarLineaLibre} variant="outline">
                <Plus className="mr-1 h-4 w-4" /> Agregar ítem
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {lineasLibres.map((linea, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Input
                      value={linea.descripcion}
                      onChange={(e) => updateLineaLibre(idx, 'descripcion', e.target.value)}
                      placeholder="Descripción libre..."
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={linea.cantidad}
                      onChange={(e) => updateLineaLibre(idx, 'cantidad', Number(e.target.value))}
                      placeholder="Cant."
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={linea.precioUnitario}
                      onChange={(e) => updateLineaLibre(idx, 'precioUnitario', Number(e.target.value))}
                      placeholder="P. unit."
                    />
                  </div>
                  <div className="col-span-2 text-sm font-medium text-right">{formatCurrency(linea.subtotal)}</div>
                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setLineasLibres(lineasLibres.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {lineasLibres.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-3">Sin ítems adicionales</p>
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
              {lineas.filter((l) => l.itemId).map((l, idx) => {
                const item = todosItems.find((i) => i.id === l.itemId);
                return (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-slate-600">{item?.nombre ?? 'Ítem'} × {l.cantidad}</span>
                    <span>{formatCurrency(l.subtotal)}</span>
                  </div>
                );
              })}
              {lineasLibres.filter((l) => l.descripcion.trim()).map((l, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-slate-600">{l.descripcion} × {l.cantidad}</span>
                  <span>{formatCurrency(l.subtotal)}</span>
                </div>
              ))}
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {Number(descuento) > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Descuento ({descuento}%)</span>
                    <span>-{formatCurrency(descuentoMonto)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-slate-600">Neto</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm text-slate-600 shrink-0">Tasa IVA</Label>
                  <Select value={String(tasaIva)} onValueChange={(v) => setTasaIva(Number(v))}>
                    <SelectTrigger className="h-8 text-sm w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0% — Exento</SelectItem>
                      <SelectItem value="10.5">10,5%</SelectItem>
                      <SelectItem value="21">21%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {tasaIva > 0 && (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>IVA ({tasaIva}%)</span>
                    <span>{formatCurrency(ivaResult.montoIva)}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between font-bold text-lg text-[#00ADEF]">
                  <span>{tasaIva === 0 ? 'Total (exento)' : 'Total c/IVA'}</span>
                  <span>{formatCurrency(ivaResult.totalConIva)}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-1">
                  <span className="text-slate-500" title="Si los precios de los ítems ya incluyen IVA, desactivá esta opción">
                    Precios cargados son netos
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreciosNetos(!preciosNetos)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${preciosNetos ? 'bg-[#00ADEF]' : 'bg-slate-200'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${preciosNetos ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
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

      {/* Dialog: Nueva obra */}
      <Dialog open={nuevaObraOpen} onOpenChange={setNuevaObraOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nueva obra</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={nuevaObraNombre} onChange={(e) => setNuevaObraNombre(e.target.value)} autoFocus placeholder="Ej: Torre Madero Piso 3" />
            </div>
            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input value={nuevaObraDireccion} onChange={(e) => setNuevaObraDireccion(e.target.value)} placeholder="Ej: Av. Madero 1234" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNuevaObraOpen(false); setNuevaObraNombre(''); setNuevaObraDireccion(''); }}>Cancelar</Button>
            <Button onClick={crearObraInline} disabled={!nuevaObraNombre.trim()} className="bg-sky-500 hover:bg-sky-600">Crear obra</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Crear nuevo cliente */}
      <Dialog open={nuevoClienteOpen} onOpenChange={setNuevoClienteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCliente(crearClienteInline)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Razón Social *</Label>
              <Input {...regCliente('razonSocial')} autoFocus />
              {errCliente.razonSocial && <p className="text-xs text-red-500">{errCliente.razonSocial.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" {...regCliente('email')} />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input {...regCliente('telefono')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de cliente</Label>
              <Select defaultValue="PARTICULAR" onValueChange={(v) => setValueCliente('tipoCliente', v as 'CONSTRUCTORA' | 'DESARROLLADOR' | 'PARTICULAR')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.values(TIPO_CLIENTE).map((t) => (
                    <SelectItem key={t} value={t}>{TIPO_CLIENTE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setNuevoClienteOpen(false); resetCliente(); }}>Cancelar</Button>
              <Button type="submit" className="bg-sky-500 hover:bg-sky-600">Crear cliente</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
