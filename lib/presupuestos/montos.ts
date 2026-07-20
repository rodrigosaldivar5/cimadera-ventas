/**
 * Helper centralizado para obtener el monto final de un presupuesto.
 *
 * Campos del modelo Presupuesto:
 *   totalFinal   — neto calculado (subtotal - descuento), puede ser 0 si no se recalculó
 *   precioFinal  — override manual del neto (nullable)
 *   totalConIva  — neto + IVA, es el monto total real a cobrar
 *
 * Lógica:
 *   neto = precioFinal ?? totalFinal
 *   montoFinal = totalConIva si > 0, sino neto (presupuestos sin IVA o legacy)
 */

type PresupuestoMontoInput = {
  precioFinal?: number | string | null | unknown;
  totalFinal?: number | string | null | unknown;
  totalConIva?: number | string | null | unknown;
};

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function getNetoPresupuesto(p: PresupuestoMontoInput): number {
  const pf = toNum(p.precioFinal);
  const tf = toNum(p.totalFinal);
  return pf > 0 ? pf : tf;
}

export function getMontoFinalPresupuesto(p: PresupuestoMontoInput): number {
  const tci = toNum(p.totalConIva);
  if (tci > 0) return tci;
  return getNetoPresupuesto(p);
}
