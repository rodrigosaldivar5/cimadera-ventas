import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/external-auth';
import { corsHeaders, jsonWithCors } from '@/lib/external-cors';
import { prisma } from '@/lib/prisma';
import { CanalSeguimiento, ResultadoSeguimiento } from '@prisma/client';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

// ── GET /api/external/v1/seguimientos ────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const origin = request.headers.get('origin');
  const { searchParams } = new URL(request.url);

  const presupuestoId  = searchParams.get('presupuestoId');
  const clienteId      = searchParams.get('clienteId');
  const responsableId  = searchParams.get('responsableId');
  const desde          = searchParams.get('desde');
  const hasta          = searchParams.get('hasta');
  const pendientes     = searchParams.get('pendientes') === 'true';
  const limit          = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const offset         = parseInt(searchParams.get('offset') ?? '0');

  try {
    const where: Record<string, unknown> = {};
    if (presupuestoId) where.presupuestoId = presupuestoId;
    if (clienteId)     where.clienteId     = clienteId;
    if (responsableId) where.responsableId = responsableId;
    if (desde || hasta) {
      where.fechaContacto = {
        ...(desde ? { gte: new Date(desde) } : {}),
        ...(hasta ? { lte: new Date(hasta) } : {}),
      };
    }
    if (pendientes) {
      where.proximoContacto = { not: null };
    }

    const [total, seguimientos] = await Promise.all([
      prisma.seguimientoComercial.count({ where }),
      prisma.seguimientoComercial.findMany({
        where,
        orderBy: { fechaContacto: 'desc' },
        take: limit,
        skip: offset,
        include: {
          presupuesto: { select: { id: true, numero: true, nombrePresupuesto: true, estado: true } },
          cliente:     { select: { id: true, razonSocial: true } },
          responsable: { select: { id: true, nombre: true, email: true } },
          createdBy:   { select: { id: true, nombre: true } },
        },
      }),
    ]);

    return jsonWithCors({
      total,
      limit,
      offset,
      data: seguimientos.map((s) => ({
        id:                s.id,
        presupuesto:       s.presupuesto,
        cliente:           s.cliente,
        responsable:       s.responsable ?? { nombre: s.responsableNombre ?? null },
        responsableNombre: s.responsableNombre,
        fechaContacto:     s.fechaContacto,
        canal:             s.canal,
        resultado:         s.resultado,
        comentario:        s.comentario,
        proximoContacto:   s.proximoContacto,
        createdBy:         s.createdBy,
        createdAt:         s.createdAt,
        updatedAt:         s.updatedAt,
      })),
    }, 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/seguimientos GET:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}

// ── POST /api/external/v1/seguimientos ───────────────────────────────────────

const CANALES_VALIDOS = Object.values(CanalSeguimiento);
const RESULTADOS_VALIDOS = Object.values(ResultadoSeguimiento);

export async function POST(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const origin = request.headers.get('origin');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonWithCors({ error: 'Body JSON inválido' }, 400, origin);
  }

  const {
    presupuestoId,
    clienteId,
    responsableId,
    responsableNombre,
    fechaContacto,
    canal,
    resultado,
    comentario,
    proximoContacto,
  } = body as Record<string, string | null | undefined>;

  // Validaciones
  if (!fechaContacto) return jsonWithCors({ error: 'fechaContacto es requerido' }, 400, origin);
  if (!canal || !CANALES_VALIDOS.includes(canal as CanalSeguimiento))
    return jsonWithCors({ error: `canal inválido. Valores: ${CANALES_VALIDOS.join(', ')}` }, 400, origin);
  if (!resultado || !RESULTADOS_VALIDOS.includes(resultado as ResultadoSeguimiento))
    return jsonWithCors({ error: `resultado inválido. Valores: ${RESULTADOS_VALIDOS.join(', ')}` }, 400, origin);
  if (!comentario || typeof comentario !== 'string' || comentario.trim() === '')
    return jsonWithCors({ error: 'comentario es requerido' }, 400, origin);
  if (!presupuestoId && !clienteId)
    return jsonWithCors({ error: 'Debe indicar presupuestoId o clienteId' }, 400, origin);

  try {
    // Verificar que presupuesto exista si se proporcionó
    if (presupuestoId) {
      const pExists = await prisma.presupuesto.findUnique({
        where: { id: presupuestoId },
        select: { id: true },
      });
      if (!pExists) return jsonWithCors({ error: 'presupuestoId no encontrado' }, 404, origin);
    }

    // Verificar que cliente exista si se proporcionó
    if (clienteId) {
      const cExists = await prisma.cliente.findUnique({
        where: { id: clienteId },
        select: { id: true },
      });
      if (!cExists) return jsonWithCors({ error: 'clienteId no encontrado' }, 404, origin);
    }

    // Verificar que responsable exista si se proporcionó
    if (responsableId) {
      const rExists = await prisma.user.findUnique({
        where: { id: responsableId },
        select: { id: true },
      });
      if (!rExists) return jsonWithCors({ error: 'responsableId no encontrado' }, 404, origin);
    }

    const seguimiento = await prisma.seguimientoComercial.create({
      data: {
        presupuestoId:    presupuestoId  ?? null,
        clienteId:        clienteId      ?? null,
        responsableId:    responsableId  ?? null,
        responsableNombre: responsableNombre ?? null,
        fechaContacto:    new Date(fechaContacto),
        canal:            canal as CanalSeguimiento,
        resultado:        resultado as ResultadoSeguimiento,
        comentario:       comentario.trim(),
        proximoContacto:  proximoContacto ? new Date(proximoContacto) : null,
      },
      include: {
        presupuesto: { select: { id: true, numero: true, nombrePresupuesto: true, estado: true } },
        cliente:     { select: { id: true, razonSocial: true } },
        responsable: { select: { id: true, nombre: true, email: true } },
      },
    });

    // Actualizar fechaUltimaActividadComercial del presupuesto
    if (presupuestoId) {
      await prisma.presupuesto.update({
        where: { id: presupuestoId },
        data:  { fechaUltimaActividadComercial: new Date(fechaContacto) },
      });
    }

    return jsonWithCors({
      id:                seguimiento.id,
      presupuesto:       seguimiento.presupuesto,
      cliente:           seguimiento.cliente,
      responsable:       seguimiento.responsable ?? { nombre: responsableNombre ?? null },
      responsableNombre: seguimiento.responsableNombre,
      fechaContacto:     seguimiento.fechaContacto,
      canal:             seguimiento.canal,
      resultado:         seguimiento.resultado,
      comentario:        seguimiento.comentario,
      proximoContacto:   seguimiento.proximoContacto,
      createdAt:         seguimiento.createdAt,
      updatedAt:         seguimiento.updatedAt,
    }, 201, origin);
  } catch (error) {
    console.error('Error en /external/v1/seguimientos POST:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
