import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { registrarAuditoria } from '@/lib/auditoria';
import { normalizarRubrosPresupuesto } from '@/lib/presupuestos/normalizar-rubros';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const presupuesto = await prisma.presupuesto.findUnique({
    where: { id: params.id },
    include: {
      cliente: true,
      creadoPor: true,
      obra: true,
      responsable: true,
      lineas: { include: { item: true, opciones: true } },
      puertas: { include: { tipoPuerta: true } },
    },
  });

  if (!presupuesto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(presupuesto);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const data = await req.json();

    const prev = await prisma.presupuesto.findUnique({
      where: { id: params.id },
      select: { estado: true, clienteId: true, obraId: true, fechaVencimiento: true, totalFinal: true, descuento: true, observaciones: true },
    });

    const rubrosResult = normalizarRubrosPresupuesto(data.division, data.rubros);
    if (!rubrosResult.ok) {
      return NextResponse.json({ error: rubrosResult.error }, { status: 400 });
    }

    // Eliminar puertas y líneas existentes para recrearlas
    await prisma.puertaPresupuesto.deleteMany({ where: { presupuestoId: params.id } });
    await prisma.lineaPresupuesto.deleteMany({ where: { presupuestoId: params.id } });

    type LineaInput = {
      itemId?: string;
      productoId?: string;
      productoNombre?: string;
      cantidad: number;
      precioUnitario: number;
      subtotal: number;
      opciones?: { atributoNombre: string; opcionNombre: string; precioUnitario: number; cantidad: number; subtotal: number }[];
    };

    const presupuesto = await prisma.presupuesto.update({
      where: { id: params.id },
      data: {
        ...(data.numero ? { numero: data.numero } : {}),
        clienteId: data.clienteId,
        estado: data.estado,
        obraId: data.obraId || null,
        fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
        observaciones: data.observaciones ?? null,
        descuento: data.descuento ?? 0,
        subtotal: data.subtotal ?? 0,
        totalFinal: data.totalFinal ?? 0,
        tasaIva: data.tasaIva ?? 21,
        montoIva: data.montoIva ?? 0,
        totalConIva: data.totalConIva ?? 0,
        preciosNetos: data.preciosNetos ?? true,
        division: data.division ?? null,
        esEstandar: data.esEstandar != null ? !!data.esEstandar : undefined,
        rubros: rubrosResult.rubros,
        fechaPrometidaCliente: data.fechaPrometidaCliente ? new Date(data.fechaPrometidaCliente) : null,
        fechaObjetivoProduccion: data.fechaObjetivoProduccion ? new Date(data.fechaObjetivoProduccion) : null,
        anticipoEsperado: data.anticipoEsperado != null ? data.anticipoEsperado : null,
        saldoEsperado: data.saldoEsperado != null ? data.saldoEsperado : null,
        probabilidadCobro: data.probabilidadCobro != null ? data.probabilidadCobro : null,
        motivoRechazo: data.motivoRechazo ?? null,
        ...(data.moneda ? { moneda: data.moneda === 'USD' ? 'USD' : 'ARS' } : {}),
        puertas: { create: data.puertas ?? [] },
        lineas: {
          create: (data.lineas ?? []).map((l: LineaInput) => ({
            itemId: l.itemId || null,
            productoId: l.productoId || null,
            productoNombre: l.productoNombre || null,
            cantidad: l.cantidad,
            precioUnitario: l.precioUnitario,
            subtotal: l.subtotal,
            opciones: l.opciones?.length ? {
              create: l.opciones.map((o) => ({
                atributoNombre: o.atributoNombre,
                opcionNombre: o.opcionNombre,
                precioUnitario: o.precioUnitario,
                cantidad: o.cantidad,
                subtotal: o.subtotal,
                productoId: l.productoId || null,
              })),
            } : undefined,
          })),
        },
      },
    });

    const camposModificados: Record<string, { antes: unknown; despues: unknown }> = {};
    const check = [
      ['estado', prev?.estado, data.estado],
      ['clienteId', prev?.clienteId, data.clienteId],
      ['obraId', prev?.obraId, data.obraId || null],
      ['fechaVencimiento', prev?.fechaVencimiento?.toISOString() ?? null, data.fechaVencimiento ?? null],
      ['totalFinal', Number(prev?.totalFinal ?? 0), data.totalFinal ?? 0],
      ['descuento', Number(prev?.descuento ?? 0), data.descuento ?? 0],
      ['observaciones', prev?.observaciones ?? null, data.observaciones ?? null],
    ] as const;
    for (const [campo, antes, despues] of check) {
      if (String(antes) !== String(despues)) camposModificados[campo] = { antes, despues };
    }

    registrarAuditoria({
      presupuestoId: params.id,
      usuarioId: session.user.id,
      accion: 'MODIFICACION',
      camposModificados: Object.keys(camposModificados).length ? camposModificados : undefined,
    });

    // Notificar cambio de estado a coordinacion.general
    if (data.estado && prev?.estado !== data.estado) {
      try {
        const { crearYEnviarNotificacion } = await import('@/lib/notificaciones');
        // Buscar usuario coordinacion.general
        const coordUser = await prisma.user.findUnique({
          where: { email: 'coordinacion.general@cimadera.net' },
          select: { id: true },
        });
        // Solo notificar si no es el mismo usuario que hizo el cambio
        if (coordUser && coordUser.id !== session.user.id) {
          const presup = await prisma.presupuesto.findUnique({
            where: { id: params.id },
            include: { cliente: { select: { razonSocial: true } } },
          });
          const estadoLabels: Record<string, string> = {
            PENDIENTE: 'Pendiente', EN_PROCESO: 'En proceso', FINALIZADO: 'Finalizado',
            PARA_ENVIAR: 'Para enviar', ENVIADO: 'Enviado', APROBADO: 'Aprobado', RECHAZADO: 'Rechazado',
          };
          await crearYEnviarNotificacion(coordUser.id, {
            titulo: `#${presup?.numero} → ${estadoLabels[data.estado] ?? data.estado}`,
            mensaje: `${session.user.nombre ?? 'Usuario'} cambió el estado de "${presup?.nombrePresupuesto ?? 'Presupuesto'}" — ${presup?.cliente?.razonSocial ?? ''}`,
            tipo: 'estado_cambio',
            linkUrl: `/presupuestos/${params.id}`,
          });
        }
      } catch (err) {
        console.error('[NOTIF] Error notificando cambio de estado:', err);
      }
    }

    return NextResponse.json(presupuesto);
  } catch (err) {
    console.error('[PUT /presupuestos]', params.id, err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Error al actualizar', detail }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const data = await req.json();
    const updateData: Record<string, unknown> = {};
    if ('responsableId' in data) updateData.responsableId = data.responsableId ?? null;
    if ('precioFinal' in data) {
      const pf = data.precioFinal != null && data.precioFinal !== '' ? Number(data.precioFinal) : 0;
      updateData.precioFinal = pf > 0 ? pf : null;
    }

    if ('precioFinal' in data || 'tasaIva' in data) {
      const current = await prisma.presupuesto.findUnique({
        where: { id: params.id },
        select: { precioFinal: true, totalFinal: true, tasaIva: true },
      });
      const pfSent = data.precioFinal != null ? Number(data.precioFinal) : 0;
      const base = pfSent > 0
        ? pfSent
        : (current?.precioFinal != null && Number(current.precioFinal) > 0 ? Number(current.precioFinal) : Number(current?.totalFinal ?? 0));
      const tasa = data.tasaIva != null ? Number(data.tasaIva) : Number(current?.tasaIva ?? 21);
      const montoIva = base * (tasa / 100);
      const totalConIva = tasa === 0 ? base : base + montoIva;
      updateData.tasaIva = tasa;
      updateData.montoIva = montoIva;
      updateData.totalConIva = totalConIva;
    }

    let quejaAccion: 'QUEJA_REGISTRADA' | 'QUEJA_REMOVIDA' | null = null;
    let quejaCampos: Record<string, unknown> | undefined;

    if ('tieneQuejaCliente' in data) {
      const tieneQueja = !!data.tieneQuejaCliente;
      if (tieneQueja && !data.motivoQuejaCliente) {
        return NextResponse.json({ error: 'El motivo es obligatorio cuando hay queja' }, { status: 400 });
      }
      updateData.tieneQuejaCliente = tieneQueja;
      if (tieneQueja) {
        updateData.motivoQuejaCliente = data.motivoQuejaCliente;
        updateData.comentarioQuejaCliente = data.comentarioQuejaCliente ?? null;
        updateData.fechaQuejaCliente = new Date();
        updateData.quejaRegistradaPorNombre = session.user.nombre ?? session.user.email ?? 'Desconocido';
        quejaAccion = 'QUEJA_REGISTRADA';
        quejaCampos = { motivo: data.motivoQuejaCliente, comentario: data.comentarioQuejaCliente ?? null };
      } else {
        updateData.motivoQuejaCliente = null;
        updateData.comentarioQuejaCliente = null;
        updateData.fechaQuejaCliente = null;
        updateData.quejaRegistradaPorNombre = null;
        quejaAccion = 'QUEJA_REMOVIDA';
        quejaCampos = { accion: 'Queja removida' };
      }
    }

    const presupuesto = await prisma.presupuesto.update({ where: { id: params.id }, data: updateData });

    if (quejaAccion) {
      registrarAuditoria({
        presupuestoId: params.id,
        usuarioId: session.user.id,
        accion: quejaAccion,
        camposModificados: quejaCampos,
      });
    }

    return NextResponse.json(presupuesto);
  } catch (err) {
    console.error('[PATCH /presupuestos]', params.id, err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Error al actualizar', detail }, { status: 500 });
  }
}

const EMAILS_AUTORIZADOS_BORRAR = ['coordinacion.general@cimadera.net', 'admin@cimadera.net'];

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (!EMAILS_AUTORIZADOS_BORRAR.includes(session.user.email ?? ''))
    return NextResponse.json({ error: 'No tenés permiso para eliminar presupuestos' }, { status: 403 });

  await prisma.presupuesto.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
