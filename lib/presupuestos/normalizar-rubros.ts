import type { DivisionProductiva, RubroComponentePresupuesto } from '@prisma/client';

const RUBROS_VALIDOS = new Set<string>(['MADERA', 'MELAMINA', 'ALUMINIO']);

const DIVISION_TO_RUBRO: Record<string, RubroComponentePresupuesto[]> = {
  MADERA: ['MADERA'],
  MELAMINA: ['MELAMINA'],
  ALUMINIO: ['ALUMINIO'],
};

export type NormalizarRubrosResult =
  | { ok: true; rubros: RubroComponentePresupuesto[] }
  | { ok: false; error: string };

export function normalizarRubrosPresupuesto(
  division: DivisionProductiva | string | null | undefined,
  rubrosInput: string[] | null | undefined,
): NormalizarRubrosResult {
  if (!division) {
    return { ok: true, rubros: [] };
  }

  const fixed = DIVISION_TO_RUBRO[division];
  if (fixed) {
    return { ok: true, rubros: fixed };
  }

  if (division === 'MIXTO') {
    const unique = Array.from(new Set((rubrosInput ?? []).filter(r => RUBROS_VALIDOS.has(r))));
    const cleaned = unique as RubroComponentePresupuesto[];
    if (cleaned.length < 2) {
      return { ok: false, error: 'Un presupuesto MIXTO requiere al menos 2 rubros distintos' };
    }
    return { ok: true, rubros: cleaned };
  }

  return { ok: true, rubros: [] };
}
