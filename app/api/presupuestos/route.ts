import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { EstadoPresupuesto, Prioridad } from '@prisma/client';
import { getNextNumeroPresupuesto } from '@/lib/presupuesto-utils';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const perPage = 10;
  const clienteId = searchParams.get('clienteId');
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');

  const where: Record<string, unknown> = {};
  const estadosArr = searchParams.get('estados')?.split(',').filter((e) => Object.values(EstadoPresupuesto).includes(e as EstadoPresupuesto)) ?? [];
  if (estadosArr.length > 0) where.estado = { in: estadosArr };
  const prioridadesArr = searchParams.get('prioridades')?.split(',').filter(Boolean) ?? [];
  if (prioridadesArr.length > 0) where.prioridad = { in: prioridadesArr };
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
      include: {
        cliente: true,
        creadoPor: { select: { nombre: true } },
        responsable: { select: { nombre: true } },
        obra: { select: { id: true, nombre: true } },
        archivos: { select: { id: true } },
      },
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

    const numero = data.numero ? Number(data.numero) : await getNextNumeroPresupuesto();

    const presupuesto = await prisma.presupuesto.create({
      data: {
        numero,
        clienteId: data.clienteId,
        creadoPorId: session.user.id,
        nombrePresupuesto: data.nombrePresupuesto || null,
        obraId: data.obraId || null,
        estado: data.estado ?? 'PENDIENTE',
        prioridad: (data.prioridad as Prioridad) ?? 'MEDIA',
        fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
        fechaRecepcion: data.fechaRecepcion ? new Date(data.fechaRecepcion) : null,
        responsableId: data.responsableId || null,
        observaciones: data.observaciones ?? null,
        descuento: data.descuento ?? 0,
        subtotal: data.subtotal ?? 0,
        totalFinal: data.totalFinal ?? 0,
        tasaIva: data.tasaIva ?? 21,
        montoIva: data.montoIva ?? 0,
        totalConIva: data.totalConIva ?? 0,
        preciosNetos: data.preciosNetos ?? true,
        fechaEnvio: data.estado === 'ENVIADO' ? new Date() : null,
        division: data.division ?? null,
        fechaPrometidaCliente: data.fechaPrometidaCliente ? new Date(data.fechaPrometidaCliente) : null,
        fechaObjetivoProduccion: data.fechaObjetivoProduccion ? new Date(data.fechaObjetivoProduccion) : null,
        anticipoEsperado: data.anticipoEsperado != null ? data.anticipoEsperado : null,
        saldoEsperado: data.saldoEsperado != null ? data.saldoEsperado : null,
        probabilidadCobro: data.probabilidadCobro != null ? data.probabilidadCobro : null,
        motivoRechazo: data.motivoRechazo ?? null,
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

    registrarAuditoria({
      presupuestoId: presupuesto.id,
      usuarioId: session.user.id,
      accion: 'CREACION',
    });

    return NextResponse.json(presupuesto, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al crear presupuesto' }, { status: 500 });
  }
}
