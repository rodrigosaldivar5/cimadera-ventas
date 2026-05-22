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

export const TIPO_CLIENTE = {
  CONSTRUCTORA: 'CONSTRUCTORA',
  DESARROLLADOR: 'DESARROLLADOR',
  PARTICULAR: 'PARTICULAR',
} as const;

export type TipoCliente = (typeof TIPO_CLIENTE)[keyof typeof TIPO_CLIENTE];

export const TIPO_CLIENTE_LABEL: Record<TipoCliente, string> = {
  CONSTRUCTORA: 'Constructora',
  DESARROLLADOR: 'Pequeño Desarrollador',
  PARTICULAR: 'Particular',
};
