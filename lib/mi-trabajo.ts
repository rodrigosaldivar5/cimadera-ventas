import type { EstadoPresupuesto, TipoMovimientoPresupuesto } from '@prisma/client';

type UserSession = {
  id: string;
  email?: string | null;
  rolNombre?: string | null;
};

export type PerfilMiTrabajo = 'vendedor' | 'gerencia' | 'direccion';

const ESTADOS_POR_PERFIL: Record<PerfilMiTrabajo, EstadoPresupuesto[]> = {
  vendedor: ['PENDIENTE', 'EN_PROCESO', 'FRENADO', 'FINALIZADO'],
  gerencia: ['FINALIZADO', 'PARA_ENVIAR', 'ENVIADO', 'APROBADO', 'RECHAZADO'],
  direccion: ['PARA_ENVIAR', 'ENVIADO', 'APROBADO', 'RECHAZADO'],
};

const ROL_A_PERFIL: Record<string, PerfilMiTrabajo> = {
  Vendedor: 'vendedor',
  Presupuestador: 'vendedor',
  Gerencia: 'gerencia',
  Gerente: 'gerencia',
  'Gerente Comercial': 'gerencia',
  Administrador: 'gerencia',
  Dirección: 'direccion',
  Director: 'direccion',
};

const EMAIL_OVERRIDE: Record<string, PerfilMiTrabajo> = {
  'coordinacion.general@cimadera.net': 'gerencia',
};

const ROLES_GESTION_EQUIPO = new Set([
  'Administrador',
  'Gerencia',
  'Gerente',
  'Gerente Comercial',
  'Dirección',
  'Director',
]);

const EMAIL_GESTION_EQUIPO = new Set([
  'coordinacion.general@cimadera.net',
]);

export function canManageTeamWork(user: UserSession): boolean {
  if (user.email && EMAIL_GESTION_EQUIPO.has(user.email)) return true;
  if (user.rolNombre && ROLES_GESTION_EQUIPO.has(user.rolNombre)) return true;
  return false;
}

export function getPerfilMiTrabajo(user: UserSession): PerfilMiTrabajo {
  if (user.email && EMAIL_OVERRIDE[user.email]) {
    return EMAIL_OVERRIDE[user.email];
  }
  if (user.rolNombre && ROL_A_PERFIL[user.rolNombre]) {
    return ROL_A_PERFIL[user.rolNombre];
  }
  return 'vendedor';
}

export function getEstadosMiTrabajoForUser(user: UserSession): EstadoPresupuesto[] {
  return ESTADOS_POR_PERFIL[getPerfilMiTrabajo(user)];
}

const TRANSICIONES_ESPECIALES: Record<string, TipoMovimientoPresupuesto> = {
  'FINALIZADO->EN_PROCESO': 'RETRABAJO_INTERNO',
  'FINALIZADO->FRENADO': 'RETRABAJO_PAUSADO',
  'PARA_ENVIAR->EN_PROCESO': 'CORRECCION_PREVIA_ENVIO',
  'ENVIADO->EN_PROCESO': 'MODIFICACION_POST_ENVIO',
  'ENVIADO->FRENADO': 'PAUSA_POST_ENVIO',
};

export const LABEL_TIPO_MOVIMIENTO: Record<TipoMovimientoPresupuesto, string> = {
  RETRABAJO_INTERNO: 'Retrabajo interno',
  RETRABAJO_PAUSADO: 'Retrabajo pausado',
  CORRECCION_PREVIA_ENVIO: 'Corrección previa al envío',
  MODIFICACION_POST_ENVIO: 'Modificación post envío',
  PAUSA_POST_ENVIO: 'Pausa post envío',
};

export const MOTIVOS_TRANSICION = [
  'Error de cotización',
  'Falta de datos',
  'Cambio del cliente',
  'Revisión interna',
  'Cambio de alcance',
  'Otro',
] as const;

export function clasificarTransicionPresupuesto(
  estadoAnterior: string | null | undefined,
  estadoNuevo: string,
): TipoMovimientoPresupuesto | null {
  if (!estadoAnterior) return null;
  const key = `${estadoAnterior}->${estadoNuevo}`;
  return TRANSICIONES_ESPECIALES[key] ?? null;
}

export function getFechaKeyArgentina(date?: Date): string {
  const d = date ?? new Date();
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}
