'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Paperclip, X, Loader2, FolderOpen, RefreshCw,
  FileText, FileSpreadsheet, FileCode, File, Download, ExternalLink,
  Image as ImageIcon, Archive, ChevronDown, ChevronUp,
} from 'lucide-react';

type Archivo = {
  id: string;
  nombre: string;
  url: string;
  tipo: string;
  tamanio: number;
  createdAt: string;
  driveUrl?: string | null;
  storageProvider?: string | null;
};

interface Props {
  presupuestoId: string;
  precioFinalInicial?: number | null;
  archivosIniciales: Archivo[];
}

const FRONTEND_EXTS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.jpg', '.jpeg', '.png', '.webp',
  '.dwg', '.dxf',
  '.zip', '.rar',
  '.skp', '.step', '.stp',
]);
const MAX_UPLOAD_MB = 20;
const FRONTEND_MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const TIPOS_LABEL = 'PDF, Word, Excel, imágenes, DWG, DXF, ZIP/RAR, SKP, STEP';

function validarArchivoFrontend(file: File): string | null {
  const lastDot = file.name.lastIndexOf('.');
  const ext = lastDot >= 0 ? file.name.slice(lastDot).toLowerCase() : '';
  if (!ext) return `"${file.name}": sin extensión, no permitido`;
  if (!FRONTEND_EXTS.has(ext)) return `Tipo no permitido. Permitidos: ${TIPOS_LABEL}`;
  if (file.size > FRONTEND_MAX_BYTES)
    return `"${file.name}" supera el máximo permitido de ${MAX_UPLOAD_MB} MB.`;
  return null;
}

function IconArchivo({ tipo }: { tipo: string }) {
  if (tipo === 'pdf') return <FileText className="h-4 w-4 text-red-500 shrink-0" />;
  if (tipo === 'xlsx' || tipo === 'xls') return <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />;
  if (tipo === 'doc' || tipo === 'docx') return <File className="h-4 w-4 text-blue-500 shrink-0" />;
  if (tipo === 'jpg' || tipo === 'jpeg' || tipo === 'png' || tipo === 'webp')
    return <ImageIcon className="h-4 w-4 text-purple-500 shrink-0" />;
  if (tipo === 'zip' || tipo === 'rar')
    return <Archive className="h-4 w-4 text-amber-600 shrink-0" />;
  if (tipo === 'dwg' || tipo === 'dxf' || tipo === 'skp' || tipo === 'step' || tipo === 'stp' || tipo === 'xml')
    return <FileCode className="h-4 w-4 text-orange-500 shrink-0" />;
  return <Paperclip className="h-4 w-4 text-slate-400 shrink-0" />;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function BadgeStorage({ provider }: { provider?: string | null }) {
  if (provider === 'DRIVE') {
    return (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
        Drive
      </span>
    );
  }
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 border border-slate-200 shrink-0">
      Local
    </span>
  );
}

export function DocumentacionPresupuesto({ presupuestoId, archivosIniciales }: Props) {
  const [archivos, setArchivos] = useState<Archivo[]>(archivosIniciales);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState<Archivo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, tipo: 'ok' | 'error' = 'ok') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  };

  const cargarArchivos = useCallback(async () => {
    try {
      const res = await fetch(`/api/presupuestos/${presupuestoId}/archivos`);
      if (res.ok) {
        const data: Archivo[] = await res.json();
        setArchivos(data);
      }
    } catch {}
  }, [presupuestoId]);

  useEffect(() => {
    cargarArchivos();
  }, [cargarArchivos]);

  const abrirCarpeta = async () => {
    setAbriendo(true);
    try {
      const res = await fetch(`/api/presupuestos/${presupuestoId}/archivos/carpeta`, {
        method: 'POST',
      });
      const data = await res.json() as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'No se pudo abrir la carpeta');
      }
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al abrir carpeta de Drive';
      showToast(msg, 'error');
    } finally {
      setAbriendo(false);
    }
  };

  const intentarSyncDrive = async (): Promise<number> => {
    try {
      const res = await fetch(`/api/presupuestos/${presupuestoId}/archivos/sync-drive`, {
        method: 'POST',
      });
      const data = (await res.json()) as { ok?: boolean; creados?: number };
      if (res.ok && data.ok) {
        await cargarArchivos();
        return data.creados ?? 0;
      }
    } catch {
      console.error('[ADJUNTOS] sync-drive fallback también falló');
    }
    return 0;
  };

  const subirArchivoDriveDirecto = (file: File, uploadUrl: string, mimeType: string): Promise<{ id: string; webViewLink: string }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', mimeType);
      xhr.timeout = 5 * 60 * 1000;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgreso(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText) as { id?: string; webViewLink?: string };
            if (!data.id) { reject(new Error('drive_no_id')); return; }
            resolve({ id: data.id, webViewLink: data.webViewLink ?? '' });
          } catch {
            reject(new Error('drive_parse_error'));
          }
        } else {
          console.error('[ADJUNTOS] PUT Drive error:', xhr.status, xhr.responseText?.slice(0, 200));
          reject(new Error('drive_http_error'));
        }
      };

      xhr.onerror = () => reject(new Error('drive_network_error'));
      xhr.ontimeout = () => reject(new Error('drive_timeout'));
      xhr.send(file);
    });
  };

  const subirArchivos = async (files: FileList | File[]) => {
    const lista = Array.from(files);
    if (lista.length === 0) return;

    for (const file of lista) {
      const error = validarArchivoFrontend(file);
      if (error) {
        showToast(error, 'error');
        return;
      }
    }

    setSubiendo(true);
    let subidos = 0;
    let recuperados = 0;
    let ultimoError = '';

    for (const file of lista) {
      let etapa = 'init';
      let initOk = false;
      try {
        setProgreso(0);

        const initRes = await fetch(`/api/presupuestos/${presupuestoId}/archivos/init-upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: file.name,
            tamano: file.size,
            contentType: file.type || undefined,
          }),
        });

        const initData = (await initRes.json()) as {
          ok?: boolean;
          uploadUrl?: string;
          mimeType?: string;
          error?: string;
        };

        if (!initRes.ok || !initData.uploadUrl) {
          throw new Error(initData.error ?? 'No se pudo preparar la subida.');
        }

        initOk = true;
        etapa = 'upload';
        const driveResult = await subirArchivoDriveDirecto(
          file,
          initData.uploadUrl,
          initData.mimeType || file.type || 'application/octet-stream',
        );

        etapa = 'confirm';
        const ext = file.name.lastIndexOf('.') >= 0 ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase() : '';

        const confirmRes = await fetch(`/api/presupuestos/${presupuestoId}/archivos/confirm-upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driveFileId: driveResult.id,
            nombre: file.name,
            tipo: ext,
            tamano: file.size,
          }),
        });

        const confirmData = (await confirmRes.json()) as { ok?: boolean; error?: string };

        if (!confirmRes.ok || !confirmData.ok) {
          throw new Error(confirmData.error ?? 'confirm_failed');
        }

        subidos++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'unknown';
        console.error('[ADJUNTOS]', file.name, 'etapa:', etapa, msg);

        if (initOk && (etapa === 'upload' || etapa === 'confirm')) {
          setProgreso(null);
          setSincronizando(true);
          await new Promise((r) => setTimeout(r, 2000));
          const syncCreados = await intentarSyncDrive();
          setSincronizando(false);

          if (syncCreados > 0) {
            recuperados += syncCreados;
            continue;
          }
        }

        if (etapa === 'init') {
          ultimoError = 'No se pudo preparar la subida.';
        } else {
          ultimoError = 'No se pudo completar la subida. Revisá la carpeta de Drive o intentá nuevamente.';
        }
      }
    }

    setProgreso(null);
    if (subidos > 0 && recuperados === 0) await cargarArchivos();

    const total = subidos + recuperados;
    if (total > 0 && !ultimoError) {
      const parts: string[] = [];
      if (subidos > 0) parts.push(`${subidos} subido(s)`);
      if (recuperados > 0) parts.push(`${recuperados} sincronizado(s)`);
      showToast(`${parts.join(', ')} a Drive correctamente`);
    } else if (total > 0 && ultimoError) {
      showToast(`${total} archivo(s) OK, pero hubo errores con otros`, 'error');
    } else {
      showToast(ultimoError || 'No se subió ningún archivo', 'error');
    }

    setSubiendo(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) subirArchivos(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) subirArchivos(e.dataTransfer.files);
  };

  const sincronizarDrive = async () => {
    setSincronizando(true);
    try {
      const res = await fetch(`/api/presupuestos/${presupuestoId}/archivos/sync-drive`, {
        method: 'POST',
      });
      const data = (await res.json()) as { ok?: boolean; creados?: number; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Error al sincronizar');
      }
      await cargarArchivos();
      if (data.creados && data.creados > 0) {
        showToast(`${data.creados} archivo(s) recuperado(s) de Drive`);
      } else {
        showToast('Todo sincronizado, no hay archivos nuevos en Drive');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al sincronizar con Drive';
      showToast(msg, 'error');
    } finally {
      setSincronizando(false);
    }
  };

  const eliminarArchivo = async (id: string) => {
    setEliminando(id);
    try {
      const res = await fetch(`/api/presupuestos/${presupuestoId}/archivos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      setArchivos((prev) => prev.filter((a) => a.id !== id));
      showToast('Archivo eliminado correctamente');
    } catch {
      showToast('Error al eliminar el archivo', 'error');
    }
    setEliminando(null);
    setConfirmarEliminar(null);
  };

  const [seccionAbierta, setSeccionAbierta] = useState(false);

  return (
    <>
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setSeccionAbierta(!seccionAbierta)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Documentación del presupuesto</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{archivos.length} archivo{archivos.length !== 1 ? 's' : ''}</span>
            {seccionAbierta ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>
        </div>
      </CardHeader>
      {seccionAbierta && (
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Archivos adjuntos</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={sincronizarDrive}
                disabled={sincronizando}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-60"
                title="Sincronizar archivos desde la carpeta de Drive"
              >
                {sincronizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {sincronizando ? 'Sincronizando...' : 'Sincronizar'}
              </button>
              <button
                type="button"
                onClick={abrirCarpeta}
                disabled={abriendo}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-60"
              >
                {abriendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
                {abriendo ? 'Buscando...' : 'Carpeta'}
              </button>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">
                  {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                  {subiendo ? (progreso !== null ? `Subiendo ${progreso}%` : 'Subiendo...') : 'Adjuntar'}
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.dwg,.dxf,.zip,.rar,.skp,.step,.stp"
                  multiple
                  className="sr-only"
                  onChange={handleFileInput}
                  disabled={subiendo}
                />
              </label>
            </div>
          </div>

          {/* Zona drag & drop */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`rounded-lg border-2 border-dashed transition-colors ${
              dragging ? 'border-[#00ADEF] bg-blue-50' : 'border-slate-200 bg-transparent'
            } ${archivos.length === 0 ? 'py-6' : 'py-2 px-1'}`}
          >
            {archivos.length === 0 ? (
              <p className="text-sm text-slate-400 text-center">
                {dragging ? 'Soltá los archivos aquí' : 'Sin archivos adjuntos · arrastrá aquí o usá "Adjuntar"'}
              </p>
            ) : (
              <div className="space-y-1.5">
                {archivos.map((a) => {
                  const esDrive = a.storageProvider === 'DRIVE' && a.driveUrl;
                  return (
                    <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-slate-50">
                      <IconArchivo tipo={a.tipo} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-slate-700 block truncate">{a.nombre}</span>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(a.createdAt).toLocaleDateString('es-AR')} · {formatBytes(a.tamanio)}
                        </p>
                      </div>
                      <BadgeStorage provider={a.storageProvider} />
                      {esDrive ? (
                        <a
                          href={a.driveUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-[#00ADEF] shrink-0"
                          title="Abrir en Drive"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <a
                          href={a.url}
                          download={a.nombre}
                          className="text-slate-400 hover:text-[#00ADEF] shrink-0"
                          title="Descargar"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-600 h-6 w-6 p-0 shrink-0"
                        onClick={() => setConfirmarEliminar(a)}
                        disabled={eliminando === a.id}
                      >
                        {eliminando === a.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400">
            Permitidos: PDF, Word, Excel, imágenes (JPG/PNG/WEBP), DWG, DXF, ZIP/RAR, SKP, STEP · máx. {MAX_UPLOAD_MB} MB · se guardan en Google Drive
          </p>
        </div>
      </CardContent>
      )}
    </Card>

    <Dialog
      open={!!confirmarEliminar}
      onOpenChange={(open) => { if (!open && !eliminando) setConfirmarEliminar(null); }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar archivo</DialogTitle>
          <DialogDescription>
            ¿Estás seguro que querés eliminar este archivo?
          </DialogDescription>
        </DialogHeader>
        {confirmarEliminar && (
          <div className="text-sm text-slate-600">
            <span className="font-medium">Archivo:</span> {confirmarEliminar.nombre}
          </div>
        )}
        <p className="text-xs text-slate-400">
          Se quitará de la documentación del presupuesto.
        </p>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setConfirmarEliminar(null)}
            disabled={!!eliminando}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => confirmarEliminar && eliminarArchivo(confirmarEliminar.id)}
            disabled={!!eliminando}
          >
            {eliminando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Eliminando…
              </>
            ) : (
              'Eliminar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {toast && (
      <div className={`fixed bottom-6 right-6 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2 ${toast.tipo === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
        {toast.msg}
      </div>
    )}
    </>
  );
}
