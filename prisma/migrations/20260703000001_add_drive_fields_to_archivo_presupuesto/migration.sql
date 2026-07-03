-- AlterTable: campos de Google Drive en ArchivoPresupuesto
ALTER TABLE "ArchivoPresupuesto"
  ADD COLUMN "driveFileId"     TEXT,
  ADD COLUMN "driveUrl"        TEXT,
  ADD COLUMN "driveFolderId"   TEXT,
  ADD COLUMN "storageProvider" TEXT,
  ADD COLUMN "uploadedBy"      TEXT;
