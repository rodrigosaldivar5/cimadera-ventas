import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const EVENT_TYPES = {
  PRESUPUESTO_APROBADO: 'presupuesto.aprobado',
} as const;

const TARGET_URLS: Record<string, { url: string }> = {
  crm: { url: process.env.EVENT_TARGET_CRM_URL ?? '' },
  produccion: { url: process.env.EVENT_TARGET_PRODUCCION_URL ?? '' },
};

interface EmitEventParams {
  eventType: string;
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
  targets?: string[];
  userId?: string;
  correlationId?: string;
  causationId?: string;
}

export async function emitEvent({
  eventType,
  entityType,
  entityId,
  data,
  targets = ['crm', 'produccion'],
  userId,
  correlationId,
  causationId,
}: EmitEventParams): Promise<string> {
  const eventId = crypto.randomUUID();

  const payloadString = JSON.stringify(data);
  const hash = crypto.createHash('sha256').update(payloadString).digest('hex');

  const corrId = correlationId ?? entityId;
  // Si no se pasa causationId, usar el eventId (este evento es el origen)
  const causId = causationId ?? eventId;

  // Validar campos críticos
  if (eventType === EVENT_TYPES.PRESUPUESTO_APROBADO) {
    if (!data.presupuestoId) {
      console.error('[EVENT] presupuesto.aprobado sin presupuestoId — evento cancelado');
      return 'CANCELLED';
    }
    if (!(data.cliente as Record<string, unknown>)?.id) {
      console.error('[EVENT] presupuesto.aprobado sin clienteId — evento cancelado');
      return 'CANCELLED';
    }
    const monto = data.monto as Record<string, unknown> | undefined;
    if (!monto || monto.neto == null) {
      console.warn('[EVENT] presupuesto.aprobado sin monto.neto — enviando con warning');
    }
    if (!data.division) {
      console.warn('[EVENT] presupuesto.aprobado sin division — defaulteando MADERA');
      data.division = 'MADERA';
    }
  }

  const payload: Record<string, unknown> = {
    eventId,
    eventType,
    version: '1.0',
    correlationId: corrId,
    causationId: causId,
    emittedAt: new Date().toISOString(),
    emittedBy: null,
    source: 'ventas.cimadera.net',
    hash,
    entityType,
    entityId,
    data,
  };

  // Completar emittedBy si hay userId
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nombre: true, email: true, rol: { select: { nombre: true } } },
    });
    if (user) {
      payload.emittedBy = {
        userId: user.id,
        userName: user.nombre,
        userEmail: user.email,
        userRol: user.rol?.nombre ?? 'Sin rol',
      };
    }
  }

  const eventLog = await prisma.eventLog.create({
    data: {
      eventId,
      eventType,
      version: '1.0',
      entityType,
      entityId,
      correlationId: corrId,
      causationId: causId,
      hash,
      payload: payload as never,
      status: 'PENDING',
      creadoPorId: userId ?? null,
      destinatarios: {
        create: targets
          .filter((t) => TARGET_URLS[t]?.url)
          .map((target) => ({
            target,
            targetUrl: TARGET_URLS[target].url,
            status: 'PENDING',
          })),
      },
    },
    include: { destinatarios: true },
  });

  if (eventLog.destinatarios.length === 0) {
    await prisma.eventLog.update({
      where: { id: eventLog.id },
      data: { status: 'DELIVERED', processedAt: new Date() },
    });
    console.log('[EVENT] ' + eventType + ' registrado sin targets configurados');
    return eventId;
  }

  const { deliverEvent } = await import('./event-delivery');
  for (const dest of eventLog.destinatarios) {
    deliverEvent(eventLog.id, dest.id, payload).catch((err: Error) => {
      console.error('[EVENT] Error enviando a ' + dest.target + ':', err.message);
    });
  }

  console.log(
    '[EVENT] ' + eventType + ' emitido (' + eventId + ') -> ' +
    eventLog.destinatarios.map((d) => d.target).join(', '),
  );
  return eventId;
}
