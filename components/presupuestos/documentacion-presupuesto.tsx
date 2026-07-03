'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Paperclip, X, Loader2,
  FileText, FileSpreadsheet, FileCode, File, Download, ExternalLink,
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

function IconArchivo({ tipo }: { tipo: string }) {
  if (tipo === 'pdf') return <FileText className="h-4 w-4 text-red-500 shrink-0" />;
  if (tipo === 'xlsx' || tipo === 'xls') return <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />;
  if (tipo === 'doc' || tipo === 'docx') return <File className="h-4 w-4 text-blue-500 shrink-0" />;
  if (tipo === 'xml') return <FileCode className="h-4 w-4 text-orange-500 shrink-0" />;
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
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const [dragging, setDragging] = useState(false);
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

  const subirArchivos = async (files: FileList | File[]) => {
    const lista = Array.from(files);
    if (lista.length === 0) return;
    setSubiendo(true);
    const formData = new FormData();
    lista.forEach((file) => formData.append('files', file));
    try {
      const res = await fetch(`/api/presupuestos/${presupuestoId}/archivos`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al subir');
      }
      const data = await res.json();
      await cargarArchivos();
      showToast(`${data.archivos?.length ?? 0} archivo(s) subido(s) a Drive correctamente`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al subir el archivo';
      console.error('[ADJUNTOS]', msg);
      showToast(msg, 'error');
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) subirArchivos(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) subirArchivos(e.dataTransfer.files);
  };

  const eliminarArchivo = async (id: string) => {
    setEliminando(id);
    try {
      await fetch(`/api/presupuestos/${presupuestoId}/archivos/${id}`, { method: 'DELETE' });
      setArchivos((prev) => prev.filter((a) => a.id !== id));
    } catch {}
    setEliminando(null);
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Documentación del presupuesto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Archivos adjuntos</p>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors">
                {subiendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                {subiendo ? 'Subiendo...' : 'Adjuntar'}
              </span>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.xml"
                multiple
                className="sr-only"
                onChange={handleFileInput}
                disabled={subiendo}
              />
            </label>
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
                        onClick={() => eliminarArchivo(a.id)}
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
            Los archivos nuevos se guardan en Google Drive. Los adjuntos históricos siguen disponibles para descarga.
          </p>
        </div>
      </CardContent>
    </Card>

    {toast && (
      <div className={`fixed bottom-6 right-6 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2 ${toast.tipo === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
        {toast.msg}
      </div>
    )}
    </>
  );
}
