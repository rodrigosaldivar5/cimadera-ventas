-- AlterTable
ALTER TABLE "CuentaCorriente" ADD COLUMN     "montoDevengado" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "notaDevengado" TEXT,
ADD COLUMN     "fechaDevengado" TIMESTAMP(3);
