-- CreateEnum
CREATE TYPE "TipoMovimientoPresupuesto" AS ENUM (
  'RETRABAJO_INTERNO',
  'RETRABAJO_PAUSADO',
  'CORRECCION_PREVIA_ENVIO',
  'MODIFICACION_POST_ENVIO',
  'PAUSA_POST_ENVIO'
);

-- AlterTable: agregar campos opcionales para clasificar transiciones
ALTER TABLE "PresupuestoEstadoTransicion"
  ADD COLUMN "motivoMovimiento" TEXT,
  ADD COLUMN "tipoMovimiento" "TipoMovimientoPresupuesto";

-- CreateTable: lista de trabajo diario por usuario
CREATE TABLE "PresupuestoTrabajoDia" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "presupuestoId" TEXT NOT NULL,
  "fechaKey" TEXT NOT NULL,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "completado" BOOLEAN NOT NULL DEFAULT false,
  "completadoAt" TIMESTAMP(3),
  "nota" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PresupuestoTrabajoDia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unicidad por usuario + presupuesto + fecha
CREATE UNIQUE INDEX "PresupuestoTrabajoDia_userId_presupuestoId_fechaKey_key"
  ON "PresupuestoTrabajoDia"("userId", "presupuestoId", "fechaKey");

-- CreateIndex: búsqueda por usuario + fecha
CREATE INDEX "PresupuestoTrabajoDia_userId_fechaKey_idx"
  ON "PresupuestoTrabajoDia"("userId", "fechaKey");

-- CreateIndex: búsqueda por presupuesto
CREATE INDEX "PresupuestoTrabajoDia_presupuestoId_idx"
  ON "PresupuestoTrabajoDia"("presupuestoId");

-- AddForeignKey: usuario
ALTER TABLE "PresupuestoTrabajoDia"
  ADD CONSTRAINT "PresupuestoTrabajoDia_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: presupuesto (cascade delete)
ALTER TABLE "PresupuestoTrabajoDia"
  ADD CONSTRAINT "PresupuestoTrabajoDia_presupuestoId_fkey"
  FOREIGN KEY ("presupuestoId") REFERENCES "Presupuesto"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
