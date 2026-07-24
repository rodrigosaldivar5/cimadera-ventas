import { calcularMinutosHabiles } from '@/lib/business-time';

const UMBRAL_MINUTOS = 1620; // 27 horas habiles

const ESTADOS_FINALIZADOS = new Set([
  'FINALIZADO', 'PARA_ENVIAR', 'ENVIADO', 'APROBADO', 'RECHAZADO',
]);

const ESTADOS_ABIERTOS = new Set(['PENDIENTE', 'EN_PROCESO', 'FRENADO']);

export type ResultadoEstandar =
  | 'EN_TERMINO'
  | 'DEMORADO'
  | 'ABIERTO_EN_TERMINO'
  | 'ABIERTO_VENCIDO'
  | 'SIN_TRAZABILIDAD';

export type CumplimientoEstandar = {
  inicio: Date | null;
  finMedicion: Date | null;
  ultimoFinalizado: Date | null;
  minutosHabiles: number;
  horasHabiles: number;
  resultado: ResultadoEstandar;
};

type Transicion = {
  estadoNuevo: string;
  changedAt: Date;
};

type PresupuestoInput = {
  estado: string;
  fechaCreacion: Date;
};

export function getTiempoEstandarPresupuesto(
  presupuesto: PresupuestoInput,
  transiciones: Transicion[],
  now?: Date,
): CumplimientoEstandar {
  const primeraPendiente = transiciones.find(t => t.estadoNuevo === 'PENDIENTE');
  const inicio: Date | null = primeraPendiente?.changedAt ?? presupuesto.fechaCreacion;

  const transicionesFinalizadoAsc = transiciones
    .filter(t => t.estadoNuevo === 'FINALIZADO')
    .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());

  const ultimoFinalizado: Date | null =
    transicionesFinalizadoAsc.length > 0
      ? transicionesFinalizadoAsc[transicionesFinalizadoAsc.length - 1].changedAt
      : null;

  const estadoActual = presupuesto.estado;
  const esFinalizado = ESTADOS_FINALIZADOS.has(estadoActual);
  const esAbierto = ESTADOS_ABIERTOS.has(estadoActual);

  if (esFinalizado) {
    if (!ultimoFinalizado) {
      return {
        inicio,
        finMedicion: null,
        ultimoFinalizado: null,
        minutosHabiles: 0,
        horasHabiles: 0,
        resultado: 'SIN_TRAZABILIDAD',
      };
    }
    const minutos = calcularMinutosHabiles(inicio, ultimoFinalizado);
    return {
      inicio,
      finMedicion: ultimoFinalizado,
      ultimoFinalizado,
      minutosHabiles: minutos,
      horasHabiles: Math.round((minutos / 60) * 100) / 100,
      resultado: minutos <= UMBRAL_MINUTOS ? 'EN_TERMINO' : 'DEMORADO',
    };
  }

  if (esAbierto) {
    const ahora = now ?? new Date();
    const minutos = calcularMinutosHabiles(inicio, ahora);
    return {
      inicio,
      finMedicion: ahora,
      ultimoFinalizado,
      minutosHabiles: minutos,
      horasHabiles: Math.round((minutos / 60) * 100) / 100,
      resultado: minutos <= UMBRAL_MINUTOS ? 'ABIERTO_EN_TERMINO' : 'ABIERTO_VENCIDO',
    };
  }

  return {
    inicio,
    finMedicion: null,
    ultimoFinalizado: null,
    minutosHabiles: 0,
    horasHabiles: 0,
    resultado: 'SIN_TRAZABILIDAD',
  };
}
