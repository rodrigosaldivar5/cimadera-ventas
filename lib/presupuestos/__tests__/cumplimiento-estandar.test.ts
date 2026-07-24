import { describe, it, expect } from 'vitest';
import { getTiempoEstandarPresupuesto } from '../cumplimiento-estandar';

function d(iso: string): Date {
  return new Date(iso);
}

function transicion(estadoNuevo: string, changedAt: string) {
  return { estadoNuevo, changedAt: d(changedAt) };
}

describe('getTiempoEstandarPresupuesto', () => {
  it('26 horas hábiles → EN_TERMINO', () => {
    // Lunes 08:00 ART = 11:00 UTC → Miércoles 16:00 ART (26h = 2 días completos + 8h)
    // Day 1 (Mon): 08:00-17:00 = 9h, Day 2 (Tue): 08:00-17:00 = 9h, Day 3 (Wed): 08:00-16:00 = 8h = 26h total
    const result = getTiempoEstandarPresupuesto(
      { estado: 'FINALIZADO', fechaCreacion: d('2026-07-20T11:00:00Z') }, // Mon 08:00 ART
      [
        transicion('PENDIENTE', '2026-07-20T11:00:00Z'),
        transicion('FINALIZADO', '2026-07-22T19:00:00Z'), // Wed 16:00 ART
      ],
    );
    expect(result.resultado).toBe('EN_TERMINO');
    expect(result.minutosHabiles).toBe(1560); // 26h * 60
  });

  it('27 horas exactas → EN_TERMINO', () => {
    // Mon 08:00 → Wed 17:00 = 27h (3 full days)
    const result = getTiempoEstandarPresupuesto(
      { estado: 'APROBADO', fechaCreacion: d('2026-07-20T11:00:00Z') },
      [
        transicion('PENDIENTE', '2026-07-20T11:00:00Z'),
        transicion('FINALIZADO', '2026-07-22T20:00:00Z'), // Wed 17:00 ART
      ],
    );
    expect(result.resultado).toBe('EN_TERMINO');
    expect(result.minutosHabiles).toBe(1620); // 27h
  });

  it('28 horas → DEMORADO', () => {
    // Mon 08:00 → Thu 09:00 = 28h (3 full days + 1h)
    const result = getTiempoEstandarPresupuesto(
      { estado: 'ENVIADO', fechaCreacion: d('2026-07-20T11:00:00Z') },
      [
        transicion('PENDIENTE', '2026-07-20T11:00:00Z'),
        transicion('FINALIZADO', '2026-07-23T12:00:00Z'), // Thu 09:00 ART
      ],
    );
    expect(result.resultado).toBe('DEMORADO');
    expect(result.minutosHabiles).toBe(1680); // 28h
  });

  it('FINALIZADO → FRENADO, actualmente FRENADO → mide hasta ahora (ABIERTO)', () => {
    const result = getTiempoEstandarPresupuesto(
      { estado: 'FRENADO', fechaCreacion: d('2026-07-20T11:00:00Z') },
      [
        transicion('PENDIENTE', '2026-07-20T11:00:00Z'),
        transicion('FINALIZADO', '2026-07-21T11:00:00Z'),
        transicion('FRENADO', '2026-07-21T14:00:00Z'),
      ],
    );
    expect(['ABIERTO_EN_TERMINO', 'ABIERTO_VENCIDO']).toContain(result.resultado);
    expect(result.ultimoFinalizado).toEqual(d('2026-07-21T11:00:00Z'));
  });

  it('FINALIZADO → FRENADO → FINALIZADO → usa último FINALIZADO', () => {
    const result = getTiempoEstandarPresupuesto(
      { estado: 'PARA_ENVIAR', fechaCreacion: d('2026-07-20T11:00:00Z') },
      [
        transicion('PENDIENTE', '2026-07-20T11:00:00Z'),
        transicion('FINALIZADO', '2026-07-21T11:00:00Z'), // Tue 08:00 ART
        transicion('FRENADO', '2026-07-21T14:00:00Z'),
        transicion('EN_PROCESO', '2026-07-22T11:00:00Z'),
        transicion('FINALIZADO', '2026-07-22T19:00:00Z'), // Wed 16:00 ART — this is the last
      ],
    );
    expect(result.ultimoFinalizado).toEqual(d('2026-07-22T19:00:00Z'));
    expect(result.minutosHabiles).toBe(1560); // 26h
    expect(result.resultado).toBe('EN_TERMINO');
  });

  it('estado finalizado sin transición a FINALIZADO → SIN_TRAZABILIDAD', () => {
    const result = getTiempoEstandarPresupuesto(
      { estado: 'APROBADO', fechaCreacion: d('2026-01-15T11:00:00Z') },
      [],
    );
    expect(result.resultado).toBe('SIN_TRAZABILIDAD');
  });

  it('sin transición a PENDIENTE → usa fechaCreacion como inicio', () => {
    const result = getTiempoEstandarPresupuesto(
      { estado: 'FINALIZADO', fechaCreacion: d('2026-07-20T11:00:00Z') },
      [
        transicion('FINALIZADO', '2026-07-22T19:00:00Z'),
      ],
    );
    expect(result.inicio).toEqual(d('2026-07-20T11:00:00Z'));
    expect(result.resultado).toBe('EN_TERMINO');
  });
});
