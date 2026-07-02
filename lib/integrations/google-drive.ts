import { google } from 'googleapis';

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
