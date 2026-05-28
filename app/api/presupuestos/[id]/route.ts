import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    return NextResponse.json(presupuesto);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const data = await req.json();
    const updateData: Record<string, unknown> = {};
    if ('responsableId' in data) updateData.responsableId = data.responsableId ?? null;
    if ('precioFinal' in data) updateData.precioFinal = data.precioFinal != null && data.precioFinal !== '' ? Number(data.precioFinal) : null;

    if ('precioFinal' in data || 'tasaIva' in data) {
      const current = await prisma.presupuesto.findUnique({
        where: { id: params.id },
        select: { precioFinal: true, totalFinal: true, tasaIva: true },
      });
      const base = data.precioFinal != null
        ? Number(data.precioFinal)
        : (current?.precioFinal != null ? Number(current.precioFinal) : Number(current?.totalFinal ?? 0));
      const tasa = data.tasaIva != null ? Number(data.tasaIva) : Number(current?.tasaIva ?? 21);
      const montoIva = base * (tasa / 100);
      const totalConIva = tasa === 0 ? base : base + montoIva;
      updateData.tasaIva = tasa;
      updateData.montoIva = montoIva;
      updateData.totalConIva = totalConIva;
    }

    const presupuesto = await prisma.presupuesto.update({ where: { id: params.id }, data: updateData });
    return NextResponse.json(presupuesto);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
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
