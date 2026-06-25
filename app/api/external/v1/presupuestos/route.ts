import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/external-auth';
import { corsHeaders, jsonWithCors } from '@/lib/external-cors';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const origin = request.headers.get('origin');
  const { searchParams } = new URL(request.url);
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const estado = searchParams.get('estado');
  const clienteId = searchParams.get('clienteId');
  const responsableId = searchParams.get('responsableId');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  try {
    const where: Prisma.PresupuestoWhereInput = {};
    if (estado) where.estado = estado as Prisma.PresupuestoWhereInput['estado'];
    if (clienteId) where.clienteId = clienteId;
    if (responsableId) where.responsableId = responsableId;
    if (desde || hasta) {
      where.fechaCreacion = {};
      if (desde) where.fechaCreacion.gte = new Date(desde);
      if (hasta) where.fechaCreacion.lte = new Date(hasta);
    }

    const [total, presupuestos] = await Promise.all([
      prisma.presupuesto.count({ where }),
      prisma.presupuesto.findMany({
        where,
        orderBy: { fechaCreacion: 'desc' },
        take: limit,
        skip: offset,
        include: {
          cliente: { select: { id: true, razonSocial: true, tipoCliente: true } },
          obra: { select: { id: true, nombre: true } },
          responsable: { select: { id: true, nombre: true, email: true } },
          creadoPor: { select: { id: true, nombre: true } },
        },
      }),
    ]);

    return jsonWithCors({
      total,
      limit,
      offset,
      data: presupuestos.map((p) => ({
        id: p.id,
        numero: p.numero,
        nombrePresupuesto: p.nombrePresupuesto,
        cliente: p.cliente,
        obra: p.obra,
        responsable: p.responsable,
        creadoPor: p.creadoPor,
        estado: p.estado,
        prioridad: p.prioridad,
        moneda: p.moneda,
        subtotal: Number(p.subtotal),
        descuento: Number(p.descuento),
        totalFinal: Number(p.totalFinal),
        tasaIva: Number(p.tasaIva),
        montoIva: Number(p.montoIva),
        totalConIva: Number(p.totalConIva),
        precioFinal: p.precioFinal ? Number(p.precioFinal) : null,
        monto: {
          moneda: p.moneda,
          subtotal: Number(p.subtotal),
          totalFinal: Number(p.totalFinal),
          totalConIva: Number(p.totalConIva),
        },
        fechaCreacion: p.fechaCreacion,
        fechaEnvio: p.fechaEnvio,
        fechaVencimiento: p.fechaVencimiento,
      })),
    }, 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/presupuestos:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
