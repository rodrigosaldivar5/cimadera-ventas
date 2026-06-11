import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { EstadoPresupuesto } from '@prisma/client';
import { registrarAuditoria } from '@/lib/auditoria';
import { emitEvent, EVENT_TYPES } from '@/lib/events/event-emitter';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { estado, motivoRechazo } = await req.json();

  if (!Object.values(EstadoPresupuesto).includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }

  const prev = await prisma.presupuesto.findUnique({
    where: { id: params.id },
    select: { estado: true },
  });

  const presupuesto = await prisma.presupuesto.update({
    where: { id: params.id },
    data: {
      estado,
      fechaEnvio: estado === 'ENVIADO' ? new Date() : undefined,
      motivoRechazo: estado === 'RECHAZADO' ? (motivoRechazo ?? null) : undefined,
    },
  });

  registrarAuditoria({
    presupuestoId: params.id,
    usuarioId: session.user.id,
    accion: 'CAMBIO_ESTADO',
    camposModificados: { estado: { antes: prev?.estado, despues: estado } },
  });

  // Notificar cambio de estado a coordinacion.general
  try {
    const { crearYEnviarNotificacion } = await import('@/lib/notificaciones');
    // Buscar usuario coordinacion.general
    const coordUser = await prisma.user.findUnique({
      where: { email: 'coordinacion.general@cimadera.net' },
      select: { id: true },
    });
    if (coordUser && coordUser.id !== session.user.id) {
      const presup = await prisma.presupuesto.findUnique({
        where: { id: params.id },
        include: {
          cliente: { select: { razonSocial: true } },
          responsable: { select: { nombre: true } },
        },
      });
      const estadoLabels: Record<string, string> = {
        PENDIENTE: 'Pendiente', EN_PROCESO: 'En proceso', FINALIZADO: 'Finalizado',
        PARA_ENVIAR: 'Para enviar', ENVIADO: 'Enviado', APROBADO: 'Aprobado', RECHAZADO: 'Rechazado',
      };
      await crearYEnviarNotificacion(coordUser.id, {
        titulo: `#${presup?.numero} → ${estadoLabels[estado] ?? estado}`,
        mensaje: `${session.user.nombre ?? 'Usuario'} cambió el estado de "${presup?.nombrePresupuesto ?? 'Presupuesto'}" — ${presup?.cliente?.razonSocial ?? ''}`,
        tipo: 'estado_cambio',
        linkUrl: `/presupuestos/${params.id}`,
      });
    }
  } catch (err) {
    console.error('[NOTIF] Error notificando cambio de estado:', err);
  }

  if (estado === 'APROBADO') {
    const p = await prisma.presupuesto.findUnique({
      where: { id: params.id },
      include: {
        cliente: { select: { id: true, razonSocial: true, email: true, tipoCliente: true } },
        obra: { select: { id: true, nombre: true, direccion: true } },
        creadoPor: { select: { id: true, nombre: true, email: true } },
        responsable: { select: { id: true, nombre: true, email: true } },
        lineas: { include: { item: { select: { id: true, nombre: true, categoria: { select: { nombre: true } } } }, opciones: true } },
      },
    });
    if (p) {
      const divisionGlobal = p.division ?? 'MADERA';
      const neto = Number(p.precioFinal ?? p.totalFinal ?? 0);
      const productos = p.lineas.map((l) => ({
        lineaId: l.id,
        productoNombre: l.productoNombre ?? l.item?.nombre ?? 'Sin nombre',
        productoId: l.productoId ?? l.itemId ?? null,
        categoriaNombre: l.item?.categoria?.nombre ?? null,
        division: l.division ?? null,
        cantidad: Number(l.cantidad),
        precioUnitario: Number(l.precioUnitario),
        subtotal: Number(l.subtotal),
        opciones: (l.opciones ?? []).map((o) => ({
          atributo: o.atributoNombre,
          opcion: o.opcionNombre,
          precio: Number(o.precioUnitario),
        })),
      }));
      await emitEvent({
        eventType: EVENT_TYPES.PRESUPUESTO_APROBADO,
        entityType: 'presupuesto',
        entityId: p.id,
        userId: session.user.id,
        data: {
          presupuestoId: p.id,
          numero: p.numero,
          nombrePresupuesto: p.nombrePresupuesto ?? null,
          cliente: { id: p.cliente.id, razonSocial: p.cliente.razonSocial, email: p.cliente.email ?? null, tipoCliente: p.cliente.tipoCliente },
          obra: p.obra ? { id: p.obra.id, nombre: p.obra.nombre, direccion: p.obra.direccion ?? null } : null,
          responsable: { id: p.responsable?.id ?? p.creadoPor.id, nombre: p.responsable?.nombre ?? p.creadoPor.nombre, email: p.responsable?.email ?? p.creadoPor.email },
          division: divisionGlobal,
          monto: {
            neto,
            descuentoPorcentaje: Number(p.descuento ?? 0),
            descuentoMonto: neto > 0 && Number(p.descuento) > 0 ? neto * Number(p.descuento) / (100 - Number(p.descuento)) : 0,
            tasaIva: Number(p.tasaIva ?? 21),
            montoIva: Number(p.montoIva ?? 0),
            totalConIva: Number(p.totalConIva ?? neto),
          },
          productos,
          condicionesComerciales: {
            observaciones: p.observaciones ?? null,
            fechaVencimiento: p.fechaVencimiento?.toISOString() ?? null,
          },
          fechaCreacion: p.fechaCreacion.toISOString(),
          fechaAprobacion: new Date().toISOString(),
          fechaPrometidaCliente: p.fechaPrometidaCliente?.toISOString() ?? null,
          fechaObjetivoProduccion: p.fechaObjetivoProduccion?.toISOString() ?? null,
        },
      }).catch((err: Error) => console.error('[EVENT] Error emitiendo presupuesto.aprobado:', err.message));
    }
  }

  return NextResponse.json(presupuesto);
}
