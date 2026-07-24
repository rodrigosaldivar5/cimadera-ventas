import { describe, it, expect } from 'vitest';
import { normalizarRubrosPresupuesto } from '../normalizar-rubros';

describe('normalizarRubrosPresupuesto', () => {
  it('MADERA ignora rubros incompatibles y normaliza [MADERA]', () => {
    const result = normalizarRubrosPresupuesto('MADERA', ['ALUMINIO', 'MELAMINA']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rubros).toEqual(['MADERA']);
  });

  it('MELAMINA → [MELAMINA]', () => {
    const result = normalizarRubrosPresupuesto('MELAMINA', null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rubros).toEqual(['MELAMINA']);
  });

  it('ALUMINIO → [ALUMINIO]', () => {
    const result = normalizarRubrosPresupuesto('ALUMINIO', undefined);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rubros).toEqual(['ALUMINIO']);
  });

  it('MIXTO con solo 1 rubro → error', () => {
    const result = normalizarRubrosPresupuesto('MIXTO', ['MADERA']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('al menos 2');
  });

  it('MIXTO con 2 rubros → válido', () => {
    const result = normalizarRubrosPresupuesto('MIXTO', ['MADERA', 'ALUMINIO']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rubros).toEqual(['MADERA', 'ALUMINIO']);
  });

  it('MIXTO con 3 rubros → válido', () => {
    const result = normalizarRubrosPresupuesto('MIXTO', ['MADERA', 'ALUMINIO', 'MELAMINA']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rubros).toHaveLength(3);
  });

  it('MIXTO con duplicados → deduplicar y validar', () => {
    const result = normalizarRubrosPresupuesto('MIXTO', ['MADERA', 'MADERA', 'ALUMINIO']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rubros).toEqual(['MADERA', 'ALUMINIO']);
    }
  });

  it('MIXTO con duplicados que resultan en 1 único → error', () => {
    const result = normalizarRubrosPresupuesto('MIXTO', ['MADERA', 'MADERA']);
    expect(result.ok).toBe(false);
  });

  it('MIXTO con valores inválidos mezclados → filtra y valida', () => {
    const result = normalizarRubrosPresupuesto('MIXTO', ['MADERA', 'VIDRIO' as any, 'ALUMINIO']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rubros).toEqual(['MADERA', 'ALUMINIO']);
  });

  it('MIXTO sin rubros → error', () => {
    const result = normalizarRubrosPresupuesto('MIXTO', []);
    expect(result.ok).toBe(false);
  });

  it('division null → rubros vacío', () => {
    const result = normalizarRubrosPresupuesto(null, ['MADERA']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rubros).toEqual([]);
  });
});
