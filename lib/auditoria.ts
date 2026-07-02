import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type AccionAuditoria =
  | 'CREACION'
  | 'MODIFICACION'
  | 'CAMBIO_ESTADO'
  | 'ACTUALIZACION_PRECIOS'
  | 'ADJUNTO_SUBIDO'
  | 'ADJUNTO_ELIMINADO'
  | 'PEDIDO_AVANCE'
  | 'CIERRE_COMERCIAL'
  | 'QUEJA_REGISTRADA'
  | 'QUEJA_REMOVIDA';

export function registrarAuditoria(params: {
  presupuestoId: string;
  usuarioId: string;
  accion: AccionAuditoria;
  camposModificados?: Record<string, unknown>;
}) {
  // Fire-and-forget: never throws, never blocks the caller
  prisma.auditoriaPresupuesto
    .create({
      data: {
        presupuestoId: params.presupuestoId,
        usuarioId: params.usuarioId,
        accion: params.accion,
        camposModificados: (params.camposModificados ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
    .catch(() => {});
}
