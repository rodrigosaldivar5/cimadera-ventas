-- CreateEnum
CREATE TYPE "RubroComponentePresupuesto" AS ENUM ('MADERA', 'MELAMINA', 'ALUMINIO');

-- AlterTable
ALTER TABLE "Presupuesto"
  ADD COLUMN "esEstandar" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "rubros" "RubroComponentePresupuesto"[] NOT NULL DEFAULT '{}';

-- Backfill rubros from division
UPDATE "Presupuesto" SET "rubros" = ARRAY['MADERA']::"RubroComponentePresupuesto"[] WHERE "division" = 'MADERA';
UPDATE "Presupuesto" SET "rubros" = ARRAY['MELAMINA']::"RubroComponentePresupuesto"[] WHERE "division" = 'MELAMINA';
UPDATE "Presupuesto" SET "rubros" = ARRAY['ALUMINIO']::"RubroComponentePresupuesto"[] WHERE "division" = 'ALUMINIO';
-- MIXTO históricos quedan con array vacío — no se puede inferir composición
