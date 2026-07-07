-- AlterEnum: add FRENADO to EstadoPresupuesto
-- Note: ADD VALUE cannot run inside a transaction in PostgreSQL; Prisma handles this.
ALTER TYPE "EstadoPresupuesto" ADD VALUE 'FRENADO';

-- CreateTable: registro de transiciones de estado (para tiempos hábiles)
CREATE TABLE "PresupuestoEstadoTransicion" (
    "id"                TEXT        NOT NULL,
    "presupuestoId"     TEXT        NOT NULL,
    "estadoAnterior"    TEXT,
    "estadoNuevo"       TEXT        NOT NULL,
    "changedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsableId"     TEXT,
    "responsableNombre" TEXT,
    "usuarioId"         TEXT        NOT NULL,
    "usuarioNombre"     TEXT        NOT NULL,
    CONSTRAINT "PresupuestoEstadoTransicion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PresupuestoEstadoTransicion_presupuestoId_idx" ON "PresupuestoEstadoTransicion"("presupuestoId");
CREATE INDEX "PresupuestoEstadoTransicion_changedAt_idx" ON "PresupuestoEstadoTransicion"("changedAt");

-- AddForeignKey
ALTER TABLE "PresupuestoEstadoTransicion"
    ADD CONSTRAINT "PresupuestoEstadoTransicion_presupuestoId_fkey"
    FOREIGN KEY ("presupuestoId") REFERENCES "Presupuesto"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
