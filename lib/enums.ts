export const estadoBadgeClass: Record<string, string> = {
  PENDIENTE:   'bg-slate-100 text-slate-600 border-slate-300',
  EN_PROCESO:  'bg-yellow-100 text-yellow-700 border-yellow-300',
  FINALIZADO:  'bg-amber-800 text-white border-amber-900',
  PARA_ENVIAR: 'bg-blue-100 text-blue-700 border-blue-300',
  ENVIADO:     'bg-sky-100 text-[#0089C7] border-sky-300',
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

import type { CSSProperties } from 'react';

const ESTILOS_ESTADO: Record<string, CSSProperties> = {
  PENDIENTE:   { backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1' },
  EN_PROCESO:  { backgroundColor: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047' },
  FINALIZADO:  { backgroundColor: '#8B6C3E', color: '#FFFFFF', border: '1px solid #6B4F2C' },
  PARA_ENVIAR: { backgroundColor: '#DBEAFE', color: '#1E40AF', border: '1px solid #93C5FD' },
  ENVIADO:     { backgroundColor: '#E0F2FE', color: '#0369A1', border: '1px solid #7DD3FC' },
  APROBADO:    { backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC' },
  RECHAZADO:   { backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' },
};

const BASE_BADGE_STYLE: CSSProperties = {
  fontWeight: 500,
  fontSize: '12px',
  padding: '2px 8px',
  borderRadius: '6px',
  display: 'inline-flex',
  alignItems: 'center',
  whiteSpace: 'nowrap',
};

export function getEstiloEstado(estado: string): CSSProperties {
  return {
    ...BASE_BADGE_STYLE,
    ...(ESTILOS_ESTADO[estado] ?? { backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1' }),
  };
}

export function getLabelEstado(estado: string): string {
  return estadoLabel[estado] ?? estado;
}

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
