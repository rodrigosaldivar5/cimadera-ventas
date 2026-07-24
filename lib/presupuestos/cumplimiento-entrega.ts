import { calcularMinutosHabiles } from '@/lib/business-time';

export type ResultadoEntrega =
  | 'EN_TERMINO'
  | 'FUERA_DE_TERMINO'
  | 'VENCIDO_SIN_ENTREGAR'
  | 'PENDIENTE'
  | 'SIN_FECHA'
  | 'SIN_TRAZABILIDAD';

export type CumplimientoEntrega = {
  fechaPrometida: Date | null;
  primeraFechaEnviado: Date | null;
  minutosDemoraCalendario: number;
  minutosDemoraHabiles: number;
  resultado: ResultadoEntrega;
};

type Transicion = {
  estadoNuevo: string;
  changedAt: Date;
};

type PresupuestoInput = {
  estado: string;
  fechaPrometidaCliente: Date | null;
};

const ESTADOS_POST_ENVIO = new Set(['ENVIADO', 'APROBADO', 'RECHAZADO']);

// API stores date-only values as UTC midnight (new Date("YYYY-MM-DD") → YYYY-MM-DDT00:00:00Z).
// Extract the calendar date from the UTC representation and build 17:00 ART (20:00 UTC) on that date.
function normalizarFechaPrometida(fecha: Date): Date {
  const y = fecha.getUTCFullYear();
  const m = fecha.getUTCMonth();
  const d = fecha.getUTCDate();
  return new Date(Date.UTC(y, m, d, 20, 0, 0));
}

function demoraCalendario(desde: Date, hasta: Date): number {
  return Math.max(0, Math.floor((hasta.getTime() - desde.getTime()) / 60000));
}

export function getCumplimientoEntregaPresupuesto(
  presupuesto: PresupuestoInput,
  transiciones: Transicion[],
  now?: Date,
): CumplimientoEntrega {
  const fechaPrometidaRaw = presupuesto.fechaPrometidaCliente;

  if (!fechaPrometidaRaw) {
    return {
      fechaPrometida: null,
      primeraFechaEnviado: null,
      minutosDemoraCalendario: 0,
      minutosDemoraHabiles: 0,
      resultado: 'SIN_FECHA',
    };
  }

  const fechaPrometida = normalizarFechaPrometida(fechaPrometidaRaw);

  const primeraEnviado = transiciones
    .filter(t => t.estadoNuevo === 'ENVIADO')
    .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime())[0];

  if (primeraEnviado) {
    const enviadoTs = primeraEnviado.changedAt.getTime();
    const prometidaTs = fechaPrometida.getTime();

    if (enviadoTs <= prometidaTs) {
      return {
        fechaPrometida,
        primeraFechaEnviado: primeraEnviado.changedAt,
        minutosDemoraCalendario: 0,
        minutosDemoraHabiles: 0,
        resultado: 'EN_TERMINO',
      };
    }

    return {
      fechaPrometida,
      primeraFechaEnviado: primeraEnviado.changedAt,
      minutosDemoraCalendario: demoraCalendario(fechaPrometida, primeraEnviado.changedAt),
      minutosDemoraHabiles: calcularMinutosHabiles(fechaPrometida, primeraEnviado.changedAt),
      resultado: 'FUERA_DE_TERMINO',
    };
  }

  // No ENVIADO transition found — check current state for legacy classification
  if (ESTADOS_POST_ENVIO.has(presupuesto.estado)) {
    return {
      fechaPrometida,
      primeraFechaEnviado: null,
      minutosDemoraCalendario: 0,
      minutosDemoraHabiles: 0,
      resultado: 'SIN_TRAZABILIDAD',
    };
  }

  const ahora = now ?? new Date();
  if (ahora.getTime() > fechaPrometida.getTime()) {
    return {
      fechaPrometida,
      primeraFechaEnviado: null,
      minutosDemoraCalendario: demoraCalendario(fechaPrometida, ahora),
      minutosDemoraHabiles: calcularMinutosHabiles(fechaPrometida, ahora),
      resultado: 'VENCIDO_SIN_ENTREGAR',
    };
  }

  return {
    fechaPrometida,
    primeraFechaEnviado: null,
    minutosDemoraCalendario: 0,
    minutosDemoraHabiles: 0,
    resultado: 'PENDIENTE',
  };
}
