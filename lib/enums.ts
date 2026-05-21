export const ESTADO_PRESUPUESTO = {
  BORRADOR: 'BORRADOR',
  ENVIADO: 'ENVIADO',
  APROBADO: 'APROBADO',
  RECHAZADO: 'RECHAZADO',
  VENCIDO: 'VENCIDO',
} as const;

export type EstadoPresupuesto = (typeof ESTADO_PRESUPUESTO)[keyof typeof ESTADO_PRESUPUESTO];

export const PRIORIDAD = {
  ALTA: 'ALTA',
  MEDIA: 'MEDIA',
  BAJA: 'BAJA',
} as const;

export type Prioridad = (typeof PRIORIDAD)[keyof typeof PRIORIDAD];
