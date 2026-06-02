'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Paperclip, X, Loader2,
  FileText, FileSpreadsheet, FileCode, File, Download,
} from 'lucide-react';

type Archivo = {
  id: string;
  nombre: string;
  url: string;
  tipo: string;
  tamanio: number;
  createdAt: string;
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

export function DocumentacionPresupuesto({ presupuestoId, archivosIniciales }: Props) {
  const [archivos, setArchivos] = useState<Archivo[]>(archivosIniciales);
  const [subiendo, setSubiendo] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, tipo: 'ok' | 'error' = 'ok') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  };

  const cargarArchivos = async () => {
    try {
      const res = await fetch(`/api/presupuestos/${presupuestoId}/archivos`);
      if (res.ok) {
        const data: Archivo[] = await res.json();
        setArchivos(data);
      }
    } catch {}
  };

  useEffect(() => {
    cargarArchivos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presupuestoId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setSubiendo(true);
    const formData = new FormData();
    // NO se setea Content-Type — el browser lo agrega automáticamente con boundary
    Array.from(files).forEach((file) => formData.append('files', file));
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
      showToast(`${data.archivos?.length ?? 0} archivo(s) subido(s) correctamente`);
    } catch (error) {
      console.error('Error subiendo archivo:', error);
      showToast('Error al subir el archivo', 'error');
    } finally {
      setSubiendo(false);
      e.target.value = '';
    }
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
        {/* Archivos adjuntos */}
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
                onChange={handleFileUpload}
                disabled={subiendo}
              />
            </label>
          </div>

          {archivos.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Sin archivos adjuntos</p>
          ) : (
            <div className="space-y-2">
              {archivos.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-slate-50">
                  <IconArchivo tipo={a.tipo} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-slate-700 block truncate">{a.nombre}</span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Subido el {new Date(a.createdAt).toLocaleDateString('es-AR')} a las {new Date(a.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{formatBytes(a.tamanio)}</span>
                  <a
                    href={a.url}
                    download={a.nombre}
                    className="text-slate-400 hover:text-[#00ADEF] shrink-0"
                    title="Descargar"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
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
              ))}
            </div>
          )}
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
