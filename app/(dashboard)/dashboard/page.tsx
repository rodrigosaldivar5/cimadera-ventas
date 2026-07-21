export const dynamic = 'force-dynamic';

import { requirePermiso } from '@/lib/check-permiso';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DashboardChart } from '@/components/dashboard/dashboard-chart';
import { DashboardFiscal } from '@/components/dashboard/dashboard-fiscal';
import { PeriodoSelector } from '@/components/dashboard/periodo-selector';
import { AnalisisMonetario } from '@/components/dashboard/analisis-monetario';
import { DashboardOperativo } from '@/components/dashboard/dashboard-operativo';
import { FileText, Send, CheckCircle, XCircle, TrendingUp, Clock } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getEstiloEstado, getLabelEstado } from '@/lib/enums';
import { getFechaKeyArgentina, LABEL_TIPO_MOVIMIENTO } from '@/lib/mi-trabajo';
import { getMontoFinalPresupuesto } from '@/lib/presupuestos/montos';
import type { TipoMovimientoPresupuesto, EstadoPresupuesto, Prisma } from '@prisma/client';

const PESOS_PROB: Record<string, number> = { ALTA: 1.0, MEDIA: 0.6, BAJA: 0.3 };

const MOTIVO_QUEJA_LABELS: Record<string, string> = {
  COTIZACION_MAL_HECHA: 'Cotización mal hecha',
  TIEMPO_COTIZACION: 'Tiempo de cotización',
  MALA_PREDISPOSICION: 'Mala predisposición',
  ERROR_DATOS: 'Error de datos',
  OTRO: 'Otro',
};

const ESTADOS_ABIERTOS = ['PENDIENTE', 'EN_PROCESO', 'FRENADO', 'FINALIZADO', 'PARA_ENVIAR', 'ENVIADO'] as const;

const MONTO_SELECT = {
  precioFinal: true,
  totalFinal: true,
  totalConIva: true,
} as const;

export default async function DashboardPage({ searchParams }: { searchParams: { userId?: string; desde?: string; hasta?: string; tab?: string; responsableId?: string } }) {
  await requirePermiso('dashboard', 'ver', '/presupuestos');
  const userId = searchParams.userId;
  const now = new Date();
  const desde = searchParams.desde;
  const hasta = searchParams.hasta;
  const activeTab = searchParams.tab;
  const filtroResponsableId = searchParams.responsableId;
  const inicioFiltro = desde ? new Date(desde) : startOfMonth(now);
  const finFiltro = hasta ? new Date(hasta) : endOfMonth(now);
  const inicioMes = inicioFiltro;
  const finMes = finFiltro;

  const vendedores = await prisma.user.findMany({
    where: { aprobado: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });

  const whereBase = userId ? { creadoPorId: userId } : {};

  const [ultimoSaldoCaja, costosFijosDB, cuentasPendientes] = await Promise.all([
    prisma.saldoCaja.findFirst({ orderBy: { fecha: 'desc' } }),
    prisma.costoFijo.findMany({ where: { activo: true } }),
    prisma.cuentaCorriente.findMany({
      where: { estado: 'SALDO_PENDIENTE' },
      select: { saldoActualizado: true, proximoCobro: true, probabilidadCobro: true },
    }),
  ]);

  const saldoCaja = ultimoSaldoCaja?.saldo ?? 0;
  const egresosMensuales = costosFijosDB.reduce((s, c) => s + c.monto, 0);
  const egresosSemanal = egresosMensuales / 4.33;
  const hoy = new Date();
  const limite30 = new Date(hoy); limite30.setDate(hoy.getDate() + 30);
  const ingresos30 = cuentasPendientes
    .filter((c) => c.proximoCobro && c.proximoCobro >= hoy && c.proximoCobro <= limite30)
    .reduce((s, c) => s + Number(c.saldoActualizado) * (PESOS_PROB[c.probabilidadCobro] ?? 0.6), 0);
  const runwaySemanas = egresosSemanal > 0 ? (saldoCaja + ingresos30) / egresosSemanal : 99;
  const semaforoColor = runwaySemanas >= 12 ? '#28A745' : runwaySemanas >= 6 ? '#FFC107' : '#DC3545';
  const semaforoLabel = runwaySemanas >= 12 ? 'Saludable' : runwaySemanas >= 6 ? 'Atención' : 'Alerta';

  const [totalMes, enviados, aprobados, rechazados, pendientes, ultimosAprobados, chartData] = await Promise.all([
    prisma.presupuesto.count({ where: { ...whereBase, fechaCreacion: { gte: inicioMes, lte: finMes } } }),
    prisma.presupuesto.count({ where: { ...whereBase, estado: 'ENVIADO' } }),
    prisma.presupuesto.findMany({
      where: { ...whereBase, estado: 'APROBADO', fechaCreacion: { gte: inicioMes, lte: finMes } },
      select: MONTO_SELECT,
    }),
    prisma.presupuesto.count({ where: { ...whereBase, estado: 'RECHAZADO', fechaCreacion: { gte: inicioMes, lte: finMes } } }),
    prisma.presupuesto.count({ where: { ...whereBase, estado: { in: ['PENDIENTE', 'EN_PROCESO'] } } }),
    // Últimos aprobados (reemplaza "últimos presupuestos")
    prisma.presupuesto.findMany({
      where: { ...whereBase, estado: 'APROBADO' },
      take: 10,
      orderBy: { fechaCierreComercial: 'desc' },
      select: {
        id: true,
        numero: true,
        moneda: true,
        ...MONTO_SELECT,
        fechaCierreComercial: true,
        fechaCreacion: true,
        cliente: { select: { razonSocial: true } },
        obra: { select: { nombre: true } },
        responsable: { select: { nombre: true } },
        transicionesEstado: {
          where: { estadoNuevo: 'APROBADO' },
          orderBy: { changedAt: 'desc' },
          take: 1,
          select: { changedAt: true },
        },
      },
    }),
    Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const mes = subMonths(now, 5 - i);
        const inicio = startOfMonth(mes);
        const fin = endOfMonth(mes);
        return prisma.presupuesto.groupBy({
          by: ['estado'],
          where: { ...whereBase, fechaCreacion: { gte: inicio, lte: fin } },
          _count: true,
        }).then((data) => ({
          mes: format(mes, 'MMM', { locale: es }),
          PENDIENTE: data.find((d) => d.estado === 'PENDIENTE')?._count ?? 0,
          EN_PROCESO: data.find((d) => d.estado === 'EN_PROCESO')?._count ?? 0,
          FINALIZADO: data.find((d) => d.estado === 'FINALIZADO')?._count ?? 0,
          PARA_ENVIAR: data.find((d) => d.estado === 'PARA_ENVIAR')?._count ?? 0,
          ENVIADO: data.find((d) => d.estado === 'ENVIADO')?._count ?? 0,
          APROBADO: data.find((d) => d.estado === 'APROBADO')?._count ?? 0,
          RECHAZADO: data.find((d) => d.estado === 'RECHAZADO')?._count ?? 0,
        }));
      })
    ),
  ]);

  // ── Filtro base operativo (respeta responsableId + desde/hasta donde aplica) ──
  const fechaKey = getFechaKeyArgentina();
  const filtroResp: Prisma.PresupuestoWhereInput = filtroResponsableId
    ? { responsableId: filtroResponsableId }
    : {};
  const filtroPeriodo: Prisma.PresupuestoWhereInput = {
    fechaCreacion: { gte: inicioMes, lte: finMes },
  };

  // ── Queries operativas (paralelas) ───────────────────────────────────

  const [
    estadoGroupBy,
    leanTransiciones,
    cargaByResponsable,
    trabajoHoyAll,
    quejasData,
    // Enviado en período: presupuestos que transicionaron a ENVIADO dentro del período
    enviadosEnPeriodoTransiciones,
    // Pendiente de respuesta actual: estado ENVIADO hoy
    pendienteRespuestaActual,
    montosAprobadosPeriodo,
    grandesAbiertosARS,
    grandesAbiertosUSD,
    alertaSinObra,
    alertaSinResponsable,
    alertaAltaPrioridadFrenado,
  ] = await Promise.all([
    // 1. Estado counts — respeta responsable y período
    prisma.presupuesto.groupBy({
      by: ['estado'],
      _count: { id: true },
      where: { ...filtroResp, ...filtroPeriodo },
    }),
    // 3. Lean indicators — respeta período
    prisma.presupuestoEstadoTransicion.findMany({
      where: {
        tipoMovimiento: { not: null },
        changedAt: { gte: inicioMes, lte: finMes },
        ...(filtroResponsableId ? { responsableId: filtroResponsableId } : {}),
      },
      select: {
        tipoMovimiento: true,
        responsableNombre: true,
        presupuestoId: true,
        presupuesto: { select: { id: true, numero: true, nombrePresupuesto: true } },
      },
      orderBy: { changedAt: 'desc' },
    }),
    // 4. Carga por responsable — filtra por responsable si hay filtro
    prisma.presupuesto.groupBy({
      by: ['responsableId', 'estado'],
      _count: { id: true },
      where: {
        responsableId: filtroResponsableId ? filtroResponsableId : { not: null },
        estado: { in: [...ESTADOS_ABIERTOS] },
      },
    }),
    prisma.presupuestoTrabajoDia.findMany({
      where: {
        fechaKey,
        ...(filtroResponsableId ? { userId: filtroResponsableId } : {}),
      },
      select: { userId: true, completado: true },
    }),
    // 5. Calidad comercial — respeta período y responsable
    prisma.presupuesto.findMany({
      where: {
        estado: { in: ['ENVIADO', 'APROBADO', 'RECHAZADO'] },
        ...filtroPeriodo,
        ...filtroResp,
      },
      select: {
        tieneQuejaCliente: true,
        motivoQuejaCliente: true,
        responsable: { select: { nombre: true } },
      },
    }),
    // 6a. Enviado en período: transiciones a ENVIADO dentro del período
    prisma.presupuestoEstadoTransicion.findMany({
      where: {
        estadoNuevo: 'ENVIADO',
        changedAt: { gte: inicioMes, lte: finMes },
        ...(filtroResponsableId ? { responsableId: filtroResponsableId } : {}),
      },
      select: {
        presupuestoId: true,
        presupuesto: { select: { moneda: true, ...MONTO_SELECT } },
      },
    }),
    // 6b. Pendiente de respuesta actual: estado ENVIADO hoy
    prisma.presupuesto.findMany({
      where: { estado: 'ENVIADO', ...filtroResp },
      select: { moneda: true, ...MONTO_SELECT },
    }),
    // 6c. Aprobados del período
    prisma.presupuesto.findMany({
      where: { estado: 'APROBADO', ...filtroPeriodo, ...filtroResp },
      select: { moneda: true, ...MONTO_SELECT },
    }),
    // Grandes abiertos ARS — umbral $5.000.000
    prisma.presupuesto.findMany({
      where: {
        estado: { in: [...ESTADOS_ABIERTOS] },
        moneda: 'ARS',
        ...filtroResp,
        OR: [
          { totalConIva: { gte: 5000000 } },
          { precioFinal: { gte: 5000000 } },
          { totalFinal: { gte: 5000000 } },
        ],
      },
      select: { id: true, numero: true, nombrePresupuesto: true, moneda: true, ...MONTO_SELECT, cliente: { select: { razonSocial: true } } },
      orderBy: { totalConIva: 'desc' },
      take: 10,
    }),
    // Grandes abiertos USD — umbral U$D 5.000
    prisma.presupuesto.findMany({
      where: {
        estado: { in: [...ESTADOS_ABIERTOS] },
        moneda: 'USD',
        ...filtroResp,
        OR: [
          { totalConIva: { gte: 5000 } },
          { precioFinal: { gte: 5000 } },
          { totalFinal: { gte: 5000 } },
        ],
      },
      select: { id: true, numero: true, nombrePresupuesto: true, moneda: true, ...MONTO_SELECT, cliente: { select: { razonSocial: true } } },
      orderBy: { totalConIva: 'desc' },
      take: 10,
    }),
    // Alertas estáticas (sin temporalidad)
    prisma.presupuesto.count({
      where: { estado: { in: [...ESTADOS_ABIERTOS] }, obraId: null, ...filtroResp },
    }),
    prisma.presupuesto.count({
      where: { estado: { in: [...ESTADOS_ABIERTOS] }, responsableId: null, ...filtroResp },
    }),
    prisma.presupuesto.findMany({
      where: { estado: 'FRENADO', prioridad: 'ALTA', ...filtroResp },
      select: { id: true, numero: true },
      take: 10,
    }),
  ]);

  // ── Alertas temporales: usar última transición al estado actual ─────
  const ALERTAS_DEMORA_ESTADOS: EstadoPresupuesto[] = ['PENDIENTE', 'EN_PROCESO', 'FRENADO', 'FINALIZADO', 'PARA_ENVIAR'];
  const ALERTAS_DEMORA: { estado: EstadoPresupuesto; horasLimite: number; label: string; tipo: string }[] = [
    { estado: 'PENDIENTE', horasLimite: 48, label: 'Pendientes hace más de 48 hs', tipo: 'pendientes_48h' },
    { estado: 'EN_PROCESO', horasLimite: 168, label: 'En proceso hace más de 7 días', tipo: 'en_proceso_7d' },
    { estado: 'FRENADO', horasLimite: 336, label: 'Frenados hace más de 14 días', tipo: 'frenados_14d' },
    { estado: 'FINALIZADO', horasLimite: 168, label: 'Finalizados sin pasar a "Para enviar"', tipo: 'finalizados_sin_enviar' },
    { estado: 'PARA_ENVIAR', horasLimite: 168, label: '"Para enviar" sin enviarse', tipo: 'para_enviar_sin_enviar' },
  ];

  const presupuestosParaAlertas = await prisma.presupuesto.findMany({
    where: {
      estado: { in: ALERTAS_DEMORA_ESTADOS },
      ...filtroResp,
    },
    select: {
      id: true,
      numero: true,
      estado: true,
      transicionesEstado: {
        where: { estadoNuevo: { in: ALERTAS_DEMORA_ESTADOS } },
        orderBy: { changedAt: 'desc' },
        take: 1,
        select: { estadoNuevo: true, changedAt: true },
      },
    },
  });

  const alertaEnviadosSinSeguimiento = await prisma.presupuesto.findMany({
    where: {
      estado: 'ENVIADO',
      fechaUltimaActividadComercial: { lt: new Date(hoy.getTime() - 14 * 86400000) },
      ...filtroResp,
    },
    select: { id: true, numero: true },
    take: 20,
  });

  // ── Procesar estado counts ──────────────────────────────────────────
  const estadoCounts = {
    PENDIENTE: 0, EN_PROCESO: 0, FRENADO: 0, FINALIZADO: 0,
    PARA_ENVIAR: 0, ENVIADO: 0, APROBADO: 0, RECHAZADO: 0,
  };
  for (const row of estadoGroupBy) {
    if (row.estado in estadoCounts) {
      estadoCounts[row.estado as keyof typeof estadoCounts] = row._count.id;
    }
  }

  // ── Procesar alertas ────────────────────────────────────────────────
  type AlertaItem = {
    tipo: string;
    mensaje: string;
    presupuestoId?: string;
    numero?: number;
    cantidad?: number;
    fuenteFecha: 'ultima_transicion' | 'fecha_actividad_comercial' | 'estado_actual';
  };
  const alertas: AlertaItem[] = [];

  for (const def of ALERTAS_DEMORA) {
    const limite = new Date(hoy.getTime() - def.horasLimite * 3600000);
    const demorados = presupuestosParaAlertas.filter((p) => {
      if (p.estado !== def.estado) return false;
      const ultima = p.transicionesEstado[0];
      if (!ultima || ultima.estadoNuevo !== p.estado) return false;
      return ultima.changedAt < limite;
    });
    if (demorados.length > 0) {
      alertas.push({
        tipo: def.tipo,
        mensaje: def.label,
        cantidad: demorados.length,
        fuenteFecha: 'ultima_transicion',
      });
    }
  }

  if (alertaEnviadosSinSeguimiento.length > 0) {
    alertas.push({
      tipo: 'enviados_sin_seguimiento',
      mensaje: 'Enviados sin seguimiento (>14 días)',
      cantidad: alertaEnviadosSinSeguimiento.length,
      fuenteFecha: 'fecha_actividad_comercial',
    });
  }
  for (const p of alertaAltaPrioridadFrenado) {
    alertas.push({
      tipo: 'alta_prioridad_frenado',
      mensaje: 'Alta prioridad frenado',
      presupuestoId: p.id,
      numero: p.numero,
      fuenteFecha: 'estado_actual',
    });
  }
  if (alertaSinObra > 0) {
    alertas.push({ tipo: 'sin_obra', mensaje: 'Presupuestos abiertos sin obra', cantidad: alertaSinObra, fuenteFecha: 'estado_actual' });
  }
  if (alertaSinResponsable > 0) {
    alertas.push({ tipo: 'sin_responsable', mensaje: 'Presupuestos abiertos sin responsable', cantidad: alertaSinResponsable, fuenteFecha: 'estado_actual' });
  }

  // ── Procesar Lean ──────────────────────────────────────────────────
  const LEAN_TYPES: TipoMovimientoPresupuesto[] = [
    'RETRABAJO_INTERNO', 'RETRABAJO_PAUSADO', 'CORRECCION_PREVIA_ENVIO',
    'MODIFICACION_POST_ENVIO', 'PAUSA_POST_ENVIO',
  ];
  const leanIndicators = LEAN_TYPES.map((tipo) => {
    const rows = leanTransiciones.filter((t) => t.tipoMovimiento === tipo);
    const responsablesMap = new Map<string, number>();
    for (const r of rows) {
      if (r.responsableNombre) {
        responsablesMap.set(r.responsableNombre, (responsablesMap.get(r.responsableNombre) ?? 0) + 1);
      }
    }
    const responsables = Array.from(responsablesMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
    const seen = new Set<string>();
    const ultimos = rows
      .filter((r) => { if (seen.has(r.presupuestoId)) return false; seen.add(r.presupuestoId); return true; })
      .slice(0, 5)
      .map((r) => ({ id: r.presupuesto.id, numero: r.presupuesto.numero, nombre: r.presupuesto.nombrePresupuesto }));
    return {
      tipo,
      label: LABEL_TIPO_MOVIMIENTO[tipo],
      cantidad: rows.length,
      responsables,
      ultimos,
    };
  });

  // ── Procesar carga por responsable ─────────────────────────────────
  const responsableIds = Array.from(new Set(cargaByResponsable.map((r) => r.responsableId).filter(Boolean))) as string[];
  const trabajoUserIds = Array.from(new Set(trabajoHoyAll.map((t) => t.userId)));
  const allCargaUserIds = Array.from(new Set([...responsableIds, ...trabajoUserIds]));
  const cargaUsers = await prisma.user.findMany({
    where: { id: { in: allCargaUserIds }, aprobado: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });
  const cargaResponsables = cargaUsers.map((u) => {
    const counts: Record<string, number> = {};
    for (const row of cargaByResponsable) {
      if (row.responsableId === u.id) counts[row.estado] = (counts[row.estado] ?? 0) + row._count.id;
    }
    const trabajoItems = trabajoHoyAll.filter((t) => t.userId === u.id);
    const aTerminarHoy = trabajoItems.length;
    const completadosHoy = trabajoItems.filter((t) => t.completado).length;
    return {
      id: u.id,
      nombre: u.nombre,
      pendientes: counts['PENDIENTE'] ?? 0,
      enProceso: counts['EN_PROCESO'] ?? 0,
      frenados: counts['FRENADO'] ?? 0,
      finalizados: counts['FINALIZADO'] ?? 0,
      paraEnviar: counts['PARA_ENVIAR'] ?? 0,
      enviados: counts['ENVIADO'] ?? 0,
      abiertos: (counts['PENDIENTE'] ?? 0) + (counts['EN_PROCESO'] ?? 0) + (counts['FRENADO'] ?? 0) +
        (counts['FINALIZADO'] ?? 0) + (counts['PARA_ENVIAR'] ?? 0) + (counts['ENVIADO'] ?? 0),
      aTerminarHoy,
      completadosHoy,
      efectividadHoy: aTerminarHoy > 0 ? Math.round((completadosHoy / aTerminarHoy) * 100) : null,
    };
  }).filter((u) => u.abiertos > 0 || u.aTerminarHoy > 0);

  // ── Procesar calidad comercial ─────────────────────────────────────
  const totalEnviados = quejasData.length;
  const conQueja = quejasData.filter((q) => q.tieneQuejaCliente).length;
  const motivosCount = new Map<string, number>();
  const responsableQuejas = new Map<string, number>();
  for (const q of quejasData) {
    if (q.tieneQuejaCliente) {
      const m = q.motivoQuejaCliente ?? 'OTRO';
      motivosCount.set(m, (motivosCount.get(m) ?? 0) + 1);
      const rn = q.responsable?.nombre ?? 'Sin responsable';
      responsableQuejas.set(rn, (responsableQuejas.get(rn) ?? 0) + 1);
    }
  }
  const calidadComercial = {
    enviados: totalEnviados,
    conQueja,
    pctSatisfaccion: totalEnviados > 0 ? Math.round(((totalEnviados - conQueja) / totalEnviados) * 100) : 100,
    motivosPrincipales: Array.from(motivosCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([motivo, cantidad]) => ({ motivo: MOTIVO_QUEJA_LABELS[motivo] ?? motivo, cantidad })),
    responsablesMasQuejas: Array.from(responsableQuejas.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, cantidad]) => ({ nombre, cantidad })),
  };

  // ── Procesar resumen dirección ─────────────────────────────────────
  const sumarMontos = (items: { moneda: string; precioFinal: unknown; totalFinal: unknown; totalConIva: unknown }[], moneda: string) =>
    items.filter((p) => p.moneda === moneda).reduce((s, p) => s + getMontoFinalPresupuesto(p), 0);

  // Enviado en período: deduplicar por presupuestoId (un presupuesto puede tener varias transiciones a ENVIADO)
  const enviadosPeriodoDedup = new Map<string, typeof enviadosEnPeriodoTransiciones[0]['presupuesto']>();
  for (const t of enviadosEnPeriodoTransiciones) {
    if (!enviadosPeriodoDedup.has(t.presupuestoId)) {
      enviadosPeriodoDedup.set(t.presupuestoId, t.presupuesto);
    }
  }
  const enviadosPeriodoItems = Array.from(enviadosPeriodoDedup.values());

  const grandesAbiertos = [
    ...grandesAbiertosARS.map((p) => ({
      id: p.id, numero: p.numero, nombre: p.nombrePresupuesto,
      monto: getMontoFinalPresupuesto(p), moneda: p.moneda, cliente: p.cliente.razonSocial,
    })),
    ...grandesAbiertosUSD.map((p) => ({
      id: p.id, numero: p.numero, nombre: p.nombrePresupuesto,
      monto: getMontoFinalPresupuesto(p), moneda: p.moneda, cliente: p.cliente.razonSocial,
    })),
  ];

  const resumenDireccion = {
    enviadoPeriodoARS: sumarMontos(enviadosPeriodoItems, 'ARS'),
    enviadoPeriodoUSD: sumarMontos(enviadosPeriodoItems, 'USD'),
    aprobadoARS: sumarMontos(montosAprobadosPeriodo, 'ARS'),
    aprobadoUSD: sumarMontos(montosAprobadosPeriodo, 'USD'),
    pendienteRespuestaARS: sumarMontos(pendienteRespuestaActual, 'ARS'),
    pendienteRespuestaUSD: sumarMontos(pendienteRespuestaActual, 'USD'),
    grandesAbiertos,
  };

  // ── KPIs y charts (existentes) ─────────────────────────────────────
  const kpis = [
    { title: 'Presupuestos este mes', value: totalMes, icon: FileText, color: 'text-[#00ADEF]', bg: 'bg-sky-50', href: '/presupuestos' },
    { title: 'Pendientes de realizar', value: pendientes, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', href: '/presupuestos?tab=pendientes' },
    { title: 'Enviados (pendientes)', value: enviados, icon: Send, color: 'text-blue-500', bg: 'bg-blue-50', href: '/presupuestos?estado=ENVIADO' },
    {
      title: 'Aprobados este mes',
      value: `${aprobados.length} · ${formatCurrency(aprobados.reduce((s, p) => s + getMontoFinalPresupuesto(p), 0))}`,
      icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', href: '/presupuestos?estado=APROBADO',
    },
    { title: 'Rechazados este mes', value: rechazados, icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', href: '/presupuestos?estado=RECHAZADO' },
  ];

  const selectedVendedor = vendedores.find((v) => v.id === userId);
  const selectedResponsable = vendedores.find((v) => v.id === filtroResponsableId);

  const kpiGrid = (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Link key={kpi.title} href={kpi.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">{kpi.title}</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{kpi.value}</p>
                  </div>
                  <div className={`rounded-full p-2.5 ${kpi.bg}`}>
                    <Icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );

  const fmtMonto = (p: typeof ultimosAprobados[0]) => {
    const m = getMontoFinalPresupuesto(p);
    if (p.moneda === 'USD') return `U$D ${m.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return formatCurrency(m);
  };

  const getFechaAprobacion = (p: typeof ultimosAprobados[0]) => {
    if (p.fechaCierreComercial) return p.fechaCierreComercial;
    if (p.transicionesEstado[0]?.changedAt) return p.transicionesEstado[0].changedAt;
    return p.fechaCreacion;
  };

  const chartsGrid = (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-[#00ADEF]" />
            Presupuestos por mes (últimos 6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DashboardChart data={chartData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos aprobados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nro</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Obra</TableHead>
                <TableHead className="hidden lg:table-cell">Responsable</TableHead>
                <TableHead className="hidden sm:table-cell">Aprobado</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ultimosAprobados.map((p) => (
                <TableRow key={p.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/presupuestos/${p.id}`} className="text-[#00ADEF] hover:underline">
                      #{p.numero}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate">{p.cliente.razonSocial}</TableCell>
                  <TableCell className="hidden md:table-cell max-w-[100px] truncate text-slate-500 text-xs">
                    {p.obra?.nombre ?? 'Sin obra'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-slate-500 text-xs">
                    {p.responsable?.nombre ?? '-'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-slate-500 text-xs">
                    {format(getFechaAprobacion(p), 'dd/MM/yy', { locale: es })}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {fmtMonto(p)}
                  </TableCell>
                </TableRow>
              ))}
              {ultimosAprobados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                    No hay presupuestos aprobados aún
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  // ── Construir query params para links del tab operativo ────────────
  const opQueryParts = ['tab=operativo'];
  if (desde) opQueryParts.push(`desde=${desde}`);
  if (hasta) opQueryParts.push(`hasta=${hasta}`);
  const opBaseQuery = opQueryParts.join('&');

  const defaultTab = activeTab === 'operativo' ? 'operativo' : activeTab === 'monetario' ? 'monetario' : userId ? 'vendedor' : 'general';

  return (
    <div className="space-y-6">
      <Tabs defaultValue={defaultTab}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="general" asChild>
              <Link href="/dashboard">General</Link>
            </TabsTrigger>
            <TabsTrigger value="operativo" asChild>
              <Link href={`/dashboard?${opBaseQuery}`}>Operativo</Link>
            </TabsTrigger>
            <TabsTrigger value="vendedor">Por vendedor</TabsTrigger>
            <TabsTrigger value="fiscal">Resumen fiscal</TabsTrigger>
            <TabsTrigger value="monetario" asChild>
              <Link href={`/dashboard?tab=monetario${desde ? `&desde=${desde}` : ''}${hasta ? `&hasta=${hasta}` : ''}`}>Análisis monetario</Link>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 text-sm text-slate-500">
            {selectedVendedor && (
              <span className="font-medium text-slate-700">{selectedVendedor.nombre}</span>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-4">
          <PeriodoSelector desde={desde} hasta={hasta} />
          {activeTab === 'operativo' && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">Responsable:</label>
              <div className="flex flex-wrap gap-1">
                <Link
                  href={`/dashboard?${opBaseQuery}`}
                  className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                    !filtroResponsableId
                      ? 'bg-[#00ADEF] text-white border-[#00ADEF]'
                      : 'border-slate-300 text-slate-600 hover:border-sky-400'
                  }`}
                >
                  Todos
                </Link>
                {vendedores.map((v) => (
                  <Link
                    key={v.id}
                    href={`/dashboard?${opBaseQuery}&responsableId=${v.id}`}
                    className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                      filtroResponsableId === v.id
                        ? 'bg-[#00ADEF] text-white border-[#00ADEF]'
                        : 'border-slate-300 text-slate-600 hover:border-sky-400'
                    }`}
                  >
                    {v.nombre}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <TabsContent value="general" className="space-y-6 mt-4">
          <Link href="/tesoreria">
            <Card className={`hover:shadow-md transition-shadow cursor-pointer border-2 ${runwaySemanas < 6 ? 'border-red-400 animate-pulse' : 'border-transparent'}`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full flex-shrink-0" style={{ background: semaforoColor }} />
                    <div>
                      <p className="text-xs font-medium text-slate-500">Estado de Tesorería</p>
                      <p className="text-lg font-bold text-slate-800">{semaforoLabel}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Runway</p>
                    <p className="text-2xl font-bold" style={{ color: semaforoColor }}>
                      {Math.min(Math.round(runwaySemanas * 10) / 10, 99)} sem.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          {kpiGrid}
          {chartsGrid}
        </TabsContent>

        <TabsContent value="operativo" className="mt-4">
          {selectedResponsable && (
            <p className="text-sm text-slate-500 mb-3">
              Filtrando por: <span className="font-semibold text-slate-700">{selectedResponsable.nombre}</span>
            </p>
          )}
          <DashboardOperativo
            estadoCounts={estadoCounts}
            alertas={alertas}
            leanIndicators={leanIndicators}
            cargaResponsables={cargaResponsables}
            calidadComercial={calidadComercial}
            resumenDireccion={resumenDireccion}
          />
        </TabsContent>

        <TabsContent value="fiscal" className="mt-4">
          <DashboardFiscal desde={desde} hasta={hasta} />
        </TabsContent>

        <TabsContent value="monetario" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Análisis monetario ARS / USD</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <AnalisisMonetario desde={desde} hasta={hasta} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendedor" className="space-y-6 mt-4">
          <div className="flex flex-wrap gap-2">
            {vendedores.map((v) => (
              <Link
                key={v.id}
                href={`/dashboard?userId=${v.id}`}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  userId === v.id
                    ? 'bg-[#00ADEF] text-white border-[#00ADEF]'
                    : 'border-slate-300 text-slate-600 hover:border-sky-400 hover:text-[#00ADEF]'
                }`}
              >
                {v.nombre}
              </Link>
            ))}
          </div>
          {userId ? (
            <>
              {kpiGrid}
              {chartsGrid}
            </>
          ) : (
            <p className="text-sm text-slate-400 text-center py-10 border rounded-lg bg-white">
              Seleccioná un vendedor para ver sus estadísticas.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
