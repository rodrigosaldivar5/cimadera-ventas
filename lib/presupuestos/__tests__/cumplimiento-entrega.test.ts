import { describe, it, expect } from 'vitest';
import { getCumplimientoEntregaPresupuesto } from '../cumplimiento-entrega';

function d(iso: string): Date {
  return new Date(iso);
}

function transicion(estadoNuevo: string, changedAt: string) {
  return { estadoNuevo, changedAt: d(changedAt) };
}

describe('getCumplimientoEntregaPresupuesto', () => {
  // All fechaPrometidaCliente use UTC midnight — the real form persisted by POST/PUT:
  // new Date("2026-07-25") → 2026-07-25T00:00:00.000Z
  // Normalized to 25/07/2026 17:00 ART = 2026-07-25T20:00:00.000Z

  it('prometido 25/07 — enviado 25/07 16:59 ART → EN_TERMINO', () => {
    const result = getCumplimientoEntregaPresupuesto(
      { estado: 'ENVIADO', fechaPrometidaCliente: d('2026-07-25T00:00:00.000Z') },
      [transicion('ENVIADO', '2026-07-25T19:59:00.000Z')],
    );
    expect(result.resultado).toBe('EN_TERMINO');
    expect(result.minutosDemoraCalendario).toBe(0);
    expect(result.minutosDemoraHabiles).toBe(0);
  });

  it('prometido 25/07 — enviado 25/07 17:00 ART → EN_TERMINO', () => {
    const result = getCumplimientoEntregaPresupuesto(
      { estado: 'ENVIADO', fechaPrometidaCliente: d('2026-07-25T00:00:00.000Z') },
      [transicion('ENVIADO', '2026-07-25T20:00:00.000Z')],
    );
    expect(result.resultado).toBe('EN_TERMINO');
    expect(result.minutosDemoraCalendario).toBe(0);
    expect(result.minutosDemoraHabiles).toBe(0);
  });

  it('prometido 25/07 — enviado 25/07 17:01 ART → FUERA_DE_TERMINO con 1 min calendario', () => {
    const result = getCumplimientoEntregaPresupuesto(
      { estado: 'ENVIADO', fechaPrometidaCliente: d('2026-07-25T00:00:00.000Z') },
      [transicion('ENVIADO', '2026-07-25T20:01:00.000Z')],
    );
    expect(result.resultado).toBe('FUERA_DE_TERMINO');
    expect(result.minutosDemoraCalendario).toBe(1);
    expect(result.minutosDemoraHabiles).toBe(0);
  });

  it('prometido 22/07 (mié) — enviado 23/07 11:00 ART (jue) → ambas demoras > 0', () => {
    const result = getCumplimientoEntregaPresupuesto(
      { estado: 'APROBADO', fechaPrometidaCliente: d('2026-07-22T00:00:00.000Z') },
      [transicion('ENVIADO', '2026-07-23T14:00:00.000Z')],
    );
    expect(result.resultado).toBe('FUERA_DE_TERMINO');
    expect(result.minutosDemoraCalendario).toBeGreaterThan(0);
    expect(result.minutosDemoraHabiles).toBeGreaterThan(0);
  });

  it('prometido viernes — enviado lunes 10:00 ART → calendario alto, hábiles bajo', () => {
    const result = getCumplimientoEntregaPresupuesto(
      { estado: 'ENVIADO', fechaPrometidaCliente: d('2026-07-24T00:00:00.000Z') },
      [transicion('ENVIADO', '2026-07-27T13:00:00.000Z')],
    );
    expect(result.resultado).toBe('FUERA_DE_TERMINO');
    expect(result.minutosDemoraCalendario).toBe(65 * 60);
    expect(result.minutosDemoraHabiles).toBe(120);
  });

  it('prometido fecha futura, estado PENDIENTE, sin ENVIADO → PENDIENTE', () => {
    const result = getCumplimientoEntregaPresupuesto(
      { estado: 'PENDIENTE', fechaPrometidaCliente: d('2027-12-31T00:00:00.000Z') },
      [],
    );
    expect(result.resultado).toBe('PENDIENTE');
    expect(result.minutosDemoraCalendario).toBe(0);
    expect(result.minutosDemoraHabiles).toBe(0);
  });

  it('prometido fecha pasada, estado PARA_ENVIAR, sin ENVIADO → VENCIDO_SIN_ENTREGAR', () => {
    const result = getCumplimientoEntregaPresupuesto(
      { estado: 'PARA_ENVIAR', fechaPrometidaCliente: d('2026-07-10T00:00:00.000Z') },
      [transicion('FINALIZADO', '2026-07-09T14:00:00.000Z')],
    );
    expect(result.resultado).toBe('VENCIDO_SIN_ENTREGAR');
    expect(result.primeraFechaEnviado).toBeNull();
    expect(result.minutosDemoraCalendario).toBeGreaterThan(0);
    expect(result.minutosDemoraHabiles).toBeGreaterThan(0);
  });

  it('normaliza UTC midnight a 17:00 ART (20:00 UTC) del mismo día calendario', () => {
    const result = getCumplimientoEntregaPresupuesto(
      { estado: 'ENVIADO', fechaPrometidaCliente: d('2026-07-25T00:00:00.000Z') },
      [transicion('ENVIADO', '2026-07-25T19:30:00.000Z')],
    );
    expect(result.resultado).toBe('EN_TERMINO');
    expect(result.fechaPrometida).toEqual(d('2026-07-25T20:00:00.000Z'));
  });

  it('enviado, vuelto atrás y reenviado → usa primer ENVIADO', () => {
    const result = getCumplimientoEntregaPresupuesto(
      { estado: 'ENVIADO', fechaPrometidaCliente: d('2026-07-25T00:00:00.000Z') },
      [
        transicion('ENVIADO', '2026-07-24T14:00:00.000Z'),
        transicion('EN_PROCESO', '2026-07-24T16:00:00.000Z'),
        transicion('ENVIADO', '2026-07-26T14:00:00.000Z'),
      ],
    );
    expect(result.resultado).toBe('EN_TERMINO');
    expect(result.primeraFechaEnviado).toEqual(d('2026-07-24T14:00:00.000Z'));
  });

  it('sin fecha prometida → SIN_FECHA', () => {
    const result = getCumplimientoEntregaPresupuesto(
      { estado: 'ENVIADO', fechaPrometidaCliente: null },
      [transicion('ENVIADO', '2026-07-24T14:00:00.000Z')],
    );
    expect(result.resultado).toBe('SIN_FECHA');
  });

  // ── Legacy / SIN_TRAZABILIDAD tests ──

  it('estado ENVIADO sin transición ENVIADO → SIN_TRAZABILIDAD', () => {
    const result = getCumplimientoEntregaPresupuesto(
      { estado: 'ENVIADO', fechaPrometidaCliente: d('2026-06-22T00:00:00.000Z') },
      [],
    );
    expect(result.resultado).toBe('SIN_TRAZABILIDAD');
    expect(result.minutosDemoraCalendario).toBe(0);
    expect(result.minutosDemoraHabiles).toBe(0);
  });

  it('estado APROBADO sin transición ENVIADO → SIN_TRAZABILIDAD', () => {
    const result = getCumplimientoEntregaPresupuesto(
      { estado: 'APROBADO', fechaPrometidaCliente: d('2026-06-15T00:00:00.000Z') },
      [transicion('FINALIZADO', '2026-06-10T14:00:00.000Z')],
    );
    expect(result.resultado).toBe('SIN_TRAZABILIDAD');
  });

  it('estado RECHAZADO sin transición ENVIADO → SIN_TRAZABILIDAD', () => {
    const result = getCumplimientoEntregaPresupuesto(
      { estado: 'RECHAZADO', fechaPrometidaCliente: d('2026-06-15T00:00:00.000Z') },
      [],
    );
    expect(result.resultado).toBe('SIN_TRAZABILIDAD');
  });

  it('estado FINALIZADO, fecha futura, sin transición ENVIADO → PENDIENTE', () => {
    const result = getCumplimientoEntregaPresupuesto(
      { estado: 'FINALIZADO', fechaPrometidaCliente: d('2027-12-31T00:00:00.000Z') },
      [],
    );
    expect(result.resultado).toBe('PENDIENTE');
  });

  it('transición ENVIADO existente → clasificación por primera transición (ignora estado)', () => {
    const result = getCumplimientoEntregaPresupuesto(
      { estado: 'APROBADO', fechaPrometidaCliente: d('2026-07-25T00:00:00.000Z') },
      [transicion('ENVIADO', '2026-07-25T19:00:00.000Z')],
    );
    expect(result.resultado).toBe('EN_TERMINO');
    expect(result.primeraFechaEnviado).toEqual(d('2026-07-25T19:00:00.000Z'));
  });
});
