export const estadoBadgeClass: Record<string, string> = {
  PENDIENTE:   'bg-slate-100 text-slate-600 border-slate-300',
  EN_PROCESO:  'bg-yellow-100 text-yellow-700 border-yellow-300',
  FINALIZADO:  'bg-amber-800 text-white border-amber-900',
  PARA_ENVIAR: 'bg-blue-100 text-blue-700 border-blue-300',
  ENVIADO:     'bg-sky-100 text-sky-700 border-sky-300',
  APROBADO:    'bg-green-100 text-green-700 border-green-300',
  RECHAZADO:   'bg-red-100 text-red-700 border-red-300',
};

export const estadoLabel: Record<string, string> = {
  PENDIENTE:   'Pendiente',
  EN_PROCESO:  'En proceso',
  FINALIZADO:  'Finalizado',
  PARA_ENVIAR: 'Para enviar',
  ENVIADO:     'Enviado',
  APROBADO:    'Aprobado',
  RECHAZADO:   'Rechazado',
};

export const ESTADO_PRESUPUESTO = {
  PENDIENTE: 'PENDIENTE',
  EN_PROCESO: 'EN_PROCESO',
  FINALIZADO: 'FINALIZADO',
  PARA_ENVIAR: 'PARA_ENVIAR',
  ENVIADO: 'ENVIADO',
  APROBADO: 'APROBADO',
  RECHAZADO: 'RECHAZADO',
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
