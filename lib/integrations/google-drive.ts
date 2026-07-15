import { google } from 'googleapis';
import { Readable } from 'stream';

function getDriveClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail) throw new Error('Variable de entorno faltante: GOOGLE_CLIENT_EMAIL');
  if (!privateKey) throw new Error('Variable de entorno faltante: GOOGLE_PRIVATE_KEY');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

export function buildFtpFileName(params: {
  numero: number;
  obraNombre?: string | null;
  clienteNombre?: string | null;
  presupuestoNombre?: string | null;
}): string {
  const { numero, obraNombre, clienteNombre, presupuestoNombre } = params;
  const sufijo = obraNombre ?? clienteNombre ?? presupuestoNombre ?? 'Sin nombre';
  const nombre = `Presupuesto N°${numero} - ${sufijo}`;
  return nombre.replace(/[\r\n\t]/g, ' ').replace(/[/\\?%*:|"<>]/g, '-').slice(0, 200).trim();
}

export async function findFtpTemplate(): Promise<string> {
  const templateId = process.env.GOOGLE_DRIVE_FTP_TEMPLATE_ID;
  if (templateId) return templateId;

  const folderId = process.env.GOOGLE_DRIVE_FTP_FOLDER_ID;
  if (!folderId) throw new Error('Variable de entorno faltante: GOOGLE_DRIVE_FTP_FOLDER_ID');

  const drive = getDriveClient();

  const res = await drive.files.list({
    q: `name = 'Formato FTP' and '${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = res.data.files ?? [];
  if (files.length === 0) {
    throw new Error('No se encontró la plantilla "Formato FTP" en la carpeta de Drive configurada.');
  }
  if (files.length > 1) {
    throw new Error(
      `Se encontraron ${files.length} archivos llamados "Formato FTP" en la carpeta. Eliminá los duplicados o configurá GOOGLE_DRIVE_FTP_TEMPLATE_ID con el ID correcto.`,
    );
  }

  return files[0].id!;
}

export async function copyFtpTemplateForPresupuesto(params: {
  nombre: string;
}): Promise<{ fileId: string; url: string }> {
  const folderId = process.env.GOOGLE_DRIVE_FTP_FOLDER_ID;
  if (!folderId) throw new Error('Variable de entorno faltante: GOOGLE_DRIVE_FTP_FOLDER_ID');

  const drive = getDriveClient();
  const templateId = await findFtpTemplate();

  const copy = await drive.files.copy({
    fileId: templateId,
    supportsAllDrives: true,
    requestBody: {
      name: params.nombre,
      parents: [folderId],
    },
    fields: 'id, webViewLink',
  });

  const fileId = copy.data.id;
  const url = copy.data.webViewLink;

  if (!fileId || !url) {
    throw new Error('Google Drive no devolvió ID o URL del archivo copiado.');
  }

  return { fileId, url };
}

// ── Adjuntos ──────────────────────────────────────────────────────────────────

export function buildPresupuestoFolderName(params: {
  numero: number;
  obraNombre?: string | null;
  clienteNombre?: string | null;
  presupuestoNombre?: string | null;
}): string {
  const sufijo = params.obraNombre ?? params.clienteNombre ?? params.presupuestoNombre ?? 'Sin nombre';
  return `Presupuesto N°${params.numero} - ${sufijo}`
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .slice(0, 200)
    .trim();
}

export function buildSafeFileName(nombre: string): string {
  return nombre.replace(/[\r\n\t]/g, ' ').replace(/[/\\?%*:|"<>]/g, '-').slice(0, 200).trim();
}

export async function getOrCreatePresupuestoAdjuntosFolder(params: {
  parentFolderId: string;
  folderName: string;
}): Promise<string> {
  const drive = getDriveClient();
  const escapedName = params.folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const res = await drive.files.list({
    q: `name = '${escapedName}' and '${params.parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 1,
  });

  const existing = res.data.files?.[0];
  if (existing?.id) return existing.id;

  const created = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: params.folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [params.parentFolderId],
    },
    fields: 'id',
  });

  if (!created.data.id) throw new Error('No se pudo crear la subcarpeta en Google Drive.');
  return created.data.id;
}

export async function uploadPresupuestoAdjuntoToDrive(params: {
  folderId: string;
  nombre: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<{ fileId: string; url: string }> {
  const drive = getDriveClient();
  const stream = Readable.from(params.buffer);

  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: buildSafeFileName(params.nombre),
      parents: [params.folderId],
    },
    media: {
      mimeType: params.mimeType,
      body: stream,
    },
    fields: 'id, webViewLink',
  });

  const fileId = res.data.id;
  const url = res.data.webViewLink;
  if (!fileId || !url) throw new Error('Google Drive no devolvió ID o URL del archivo subido.');
  return { fileId, url };
}

export async function initResumableUpload(params: {
  folderId: string;
  nombre: string;
  mimeType: string;
}): Promise<string> {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const token = await auth.getAccessToken();
  if (!token) throw new Error('No se pudo obtener token de Google Drive');

  const metadata = {
    name: buildSafeFileName(params.nombre),
    parents: [params.folderId],
  };

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,size,mimeType,webViewLink,parents',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': params.mimeType,
      },
      body: JSON.stringify(metadata),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive resumable init falló (${res.status}): ${text}`);
  }

  const uploadUrl = res.headers.get('Location');
  if (!uploadUrl) throw new Error('Google Drive no devolvió Location para resumable upload');

  return uploadUrl;
}

export async function verifyDriveFile(fileId: string): Promise<{
  id: string;
  name: string;
  size: number;
  mimeType: string;
  webViewLink: string;
  parents: string[];
}> {
  const drive = getDriveClient();
  const res = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: 'id, name, size, mimeType, webViewLink, parents',
  });

  if (!res.data.id) throw new Error('Archivo no encontrado en Google Drive');

  return {
    id: res.data.id,
    name: res.data.name ?? '',
    size: Number(res.data.size ?? 0),
    mimeType: res.data.mimeType ?? '',
    webViewLink: res.data.webViewLink ?? '',
    parents: (res.data.parents as string[]) ?? [],
  };
}

export async function trashDriveFile(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.files.update({
    fileId,
    supportsAllDrives: true,
    requestBody: { trashed: true },
  });
}
