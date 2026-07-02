-- AlterTable: snapshot de IVA al momento de creación de la cuenta corriente
ALTER TABLE "CuentaCorriente" ADD COLUMN "tasaIvaContrato" DECIMAL(5,2),
ADD COLUMN "montoContratoNeto" DECIMAL(12,2),
ADD COLUMN "montoContratoIva" DECIMAL(12,2);
