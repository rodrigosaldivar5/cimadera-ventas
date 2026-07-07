export const estadoBadgeClass: Record<string, string> = {
  PENDIENTE:   'bg-red-100 text-red-800 border-red-300',
  EN_PROCESO:  'bg-yellow-100 text-yellow-700 border-yellow-300',
  FRENADO:     'bg-purple-100 text-purple-700 border-purple-200',
  FINALIZADO:  'bg-amber-800 text-white border-amber-900',
  PARA_ENVIAR: 'bg-blue-100 text-blue-700 border-blue-300',
  ENVIADO:     'bg-sky-100 text-[#0089C7] border-sky-300',
  APROBADO:    'bg-green-100 text-green-700 border-green-300',
  RECHAZADO:   'bg-red-100 text-red-700 border-red-300',
};

export const estadoLabel: Record<string, string> = {
  PENDIENTE:   'Pendiente',
  EN_PROCESO:  'En proceso',
  FRENADO:     'Frenado',
  FINALIZADO:  'Finalizado',
  PARA_ENVIAR: 'Para enviar',
  ENVIADO:     'Enviado',
  APROBADO:    'Aprobado',
  RECHAZADO:   'Rechazado',
};

import type { CSSProperties } from 'react';

const ESTILOS_ESTADO: Record<string, CSSProperties> = {
  PENDIENTE:   { backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' },
  EN_PROCESO:  { backgroundColor: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047' },
  FRENADO:     { backgroundColor: '#F3E8FF', color: '#7E22CE', border: '1px solid #D8B4FE' },
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
  FRENADO: 'FRENADO',
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

// ── Resultado comercial ───────────────────────────────────────────────────────

export const RESULTADO_COMERCIAL = {
  ABIERTO:            'ABIERTO',
  GANADO:             'GANADO',
  PERDIDO_COMPUTABLE: 'PERDIDO_COMPUTABLE',
  NO_COMPUTABLE:      'NO_COMPUTABLE',
} as const;

export type ResultadoComercial = (typeof RESULTADO_COMERCIAL)[keyof typeof RESULTADO_COMERCIAL];

export const RESULTADO_COMERCIAL_LABEL: Record<ResultadoComercial, string> = {
  ABIERTO:            'Abierto',
  GANADO:             'Ganado',
  PERDIDO_COMPUTABLE: 'Perdido (computable)',
  NO_COMPUTABLE:      'No computable',
};

export const MOTIVO_CIERRE_LABEL: Record<string, string> = {
  PRECIO:                        'Precio',
  PLAZO_ENTREGA:                 'Plazo de entrega',
  FORMA_PAGO:                    'Forma de pago',
  ELIGIO_COMPETENCIA:            'Eligió competencia',
  PROPUESTA_TECNICA_NO_ADECUADA: 'Propuesta técnica no adecuada',
  FALTA_SEGUIMIENTO:             'Falta de seguimiento',
  CLIENTE_NO_RESPONDE:           'Cliente no responde',
  ERROR_PRESUPUESTO:             'Error en presupuesto',
  LICITACION_NO_EJECUTADA:       'Licitación no ejecutada',
  LICITACION_NO_ADJUDICADA:      'Licitación no adjudicada',
  OBRA_CANCELADA:                'Obra cancelada',
  OBRA_SUSPENDIDA:               'Obra suspendida',
  PRESUPUESTO_REFERENCIA:        'Presupuesto de referencia',
  PRESUPUESTO_DUPLICADO:         'Presupuesto duplicado',
  CLIENTE_FUERA_PERFIL:          'Cliente fuera de perfil',
  PROYECTO_SIN_DECISION_REAL:    'Proyecto sin decisión real',
  OTRO:                          'Otro',
};

export const MOTIVOS_PERDIDO_COMPUTABLE = [
  'PRECIO',
  'PLAZO_ENTREGA',
  'FORMA_PAGO',
  'ELIGIO_COMPETENCIA',
  'PROPUESTA_TECNICA_NO_ADECUADA',
  'FALTA_SEGUIMIENTO',
  'CLIENTE_NO_RESPONDE',
  'ERROR_PRESUPUESTO',
  'OTRO',
] as const;

export const MOTIVOS_NO_COMPUTABLE = [
  'LICITACION_NO_EJECUTADA',
  'LICITACION_NO_ADJUDICADA',
  'OBRA_CANCELADA',
  'OBRA_SUSPENDIDA',
  'PRESUPUESTO_REFERENCIA',
  'PRESUPUESTO_DUPLICADO',
  'CLIENTE_FUERA_PERFIL',
  'PROYECTO_SIN_DECISION_REAL',
  'OTRO',
] as const;

const RESULTADO_COMERCIAL_ESTILOS: Record<ResultadoComercial, CSSProperties> = {
  ABIERTO:            { backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1' },
  GANADO:             { backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC' },
  PERDIDO_COMPUTABLE: { backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' },
  NO_COMPUTABLE:      { backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' },
};

export function getEstiloResultadoComercial(resultado: string): CSSProperties {
  return {
    ...BASE_BADGE_STYLE,
    ...(RESULTADO_COMERCIAL_ESTILOS[resultado as ResultadoComercial] ?? RESULTADO_COMERCIAL_ESTILOS.ABIERTO),
  };
}

export function getLabelResultadoComercial(resultado: string): string {
  return RESULTADO_COMERCIAL_LABEL[resultado as ResultadoComercial] ?? resultado;
}
