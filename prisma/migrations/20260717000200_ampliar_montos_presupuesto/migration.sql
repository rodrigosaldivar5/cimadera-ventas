-- Ampliar precisión de campos monetarios de Presupuesto
-- de DECIMAL(10,2) a DECIMAL(12,2) para soportar montos > $100M
-- (consistente con montoIva y totalConIva que ya eran 12,2)

ALTER TABLE "Presupuesto"
  ALTER COLUMN "subtotal" TYPE DECIMAL(12,2),
  ALTER COLUMN "totalFinal" TYPE DECIMAL(12,2),
  ALTER COLUMN "precioFinal" TYPE DECIMAL(12,2);
