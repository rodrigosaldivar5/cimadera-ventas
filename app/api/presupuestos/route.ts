import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { EstadoPresupuesto, Prioridad } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const perPage = 10;
  const estado = searchParams.get('estado') as EstadoPresupuesto | null;
  const clienteId = searchParams.get('clienteId');
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');

  const where: Record<string, unknown> = {};
  if (estado && Object.values(EstadoPresupuesto).includes(estado)) where.estado = estado;
  if (clienteId) where.clienteId = clienteId;
  if (desde || hasta) {
    where.fechaCreacion = {};
    if (desde) (where.fechaCreacion as Record<string, unknown>).gte = new Date(desde);
    if (hasta) (where.fechaCreacion as Record<string, unknown>).lte = new Date(hasta);
  }

  const [presupuestos, total] = await Promise.all([
    prisma.presupuesto.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { fechaCreacion: 'desc' },
      include: { cliente: true, creadoPor: { select: { nombre: true } } },
    }),
    prisma.presupuesto.count({ where }),
  ]);

  return NextResponse.json({ presupuestos, total, page, perPage });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const data = await req.json();

    type LineaInput = {
      itemId?: string;
      productoId?: string;
      productoNombre?: string;
      cantidad: number;
      precioUnitario: number;
      subtotal: number;
      opciones?: { atributoNombre: string; opcionNombre: string; precioUnitario: number; cantidad: number; subtotal: number }[];
    };

    const presupuesto = await prisma.presupuesto.create({
      data: {
        clienteId: data.clienteId,
        creadoPorId: session.user.id,
        nombrePresupuesto: data.nombrePresupuesto || null,
        estado: data.estado ?? 'BORRADOR',
        prioridad: (data.prioridad as Prioridad) ?? 'MEDIA',
        fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
        fechaRecepcion: data.fechaRecepcion ? new Date(data.fechaRecepcion) : null,
        responsableId: data.responsableId || null,
        observaciones: data.observaciones ?? null,
        descuento: data.descuento ?? 0,
        subtotal: data.subtotal ?? 0,
        totalFinal: data.totalFinal ?? 0,
        fechaEnvio: data.estado === 'ENVIADO' ? new Date() : null,
        puertas: {
          create: (data.puertas ?? []).map((p: {
            tipoPuertaId: string; cantidad: number; ancho: number; alto: number;
            bisagraId?: string; cerraduraId?: string; chapaId?: string; marcoId?: string;
            hojaId?: string; colorMarca?: string; observaciones?: string;
            precioUnitario: number; subtotal: number;
          }) => ({
            tipoPuertaId: p.tipoPuertaId, cantidad: p.cantidad, ancho: p.ancho, alto: p.alto,
            bisagraId: p.bisagraId || null, cerraduraId: p.cerraduraId || null,
            chapaId: p.chapaId || null, marcoId: p.marcoId || null, hojaId: p.hojaId || null,
            colorMarca: p.colorMarca || null, observaciones: p.observaciones || null,
            precioUnitario: p.precioUnitario, subtotal: p.subtotal,
          })),
        },
        lineas: {
          create: (data.lineas ?? []).map((l: LineaInput) => ({
            itemId: l.itemId || null,
            productoId: l.productoId || null,
            productoNombre: l.productoNombre || null,
            cantidad: l.cantidad,
            precioUnitario: l.precioUnitario,
            subtotal: l.subtotal,
            opciones: l.opciones?.length
              ? {
                  create: l.opciones.map((o) => ({
                    atributoNombre: o.atributoNombre,
                    opcionNombre: o.opcionNombre,
                    precioUnitario: o.precioUnitario,
                    cantidad: o.cantidad,
                    subtotal: o.subtotal,
                    productoId: l.productoId || null,
                  })),
                }
              : undefined,
          })),
        },
      },
    });

    return NextResponse.json(presupuesto, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al crear presupuesto' }, { status: 500 });
  }
}
