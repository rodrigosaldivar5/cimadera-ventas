-- CreateEnum
CREATE TYPE "MotivoQuejaCliente" AS ENUM ('COTIZACION_MAL_HECHA', 'TIEMPO_COTIZACION', 'MALA_PREDISPOSICION', 'ERROR_DATOS', 'OTRO');

-- AlterTable
ALTER TABLE "Presupuesto" ADD COLUMN "tieneQuejaCliente" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "motivoQuejaCliente" "MotivoQuejaCliente",
ADD COLUMN "comentarioQuejaCliente" TEXT,
ADD COLUMN "fechaQuejaCliente" TIMESTAMP(3),
ADD COLUMN "quejaRegistradaPorNombre" TEXT;
