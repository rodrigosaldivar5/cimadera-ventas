-- AlterTable
ALTER TABLE "Presupuesto" ADD COLUMN "ftpDriveFileId" TEXT,
ADD COLUMN "ftpDriveUrl" TEXT,
ADD COLUMN "ftpNombreArchivo" TEXT,
ADD COLUMN "ftpCreatedAt" TIMESTAMP(3),
ADD COLUMN "ftpUpdatedAt" TIMESTAMP(3),
ADD COLUMN "ftpCreatedBy" TEXT;
