'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Check, Pencil, Paperclip, X, Loader2,
  FileText, FileSpreadsheet, FileCode, File, Download,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type Archivo = {
  id: string;
  nombre: string;
  url: string;
  tipo: string;
  tamanio: number;
};

interface Props {
  presupuestoId: string;
  precioFinalInicial: number | null;
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

export function DocumentacionPresupuesto({ presupuestoId, precioFinalInicial, archivosIniciales }: Props) {
  const [precioFinal, setPrecioFinal] = useState<number | null>(precioFinalInicial);
  const [editandoPrecio, setEditandoPrecio] = useState(false);
  const [inputPrecio, setInputPrecio] = useState(precioFinalInicial != null ? String(precioFinalInicial) : '');
  const [guardandoPrecio, setGuardandoPrecio] = useState(false);

  const [archivos, setArchivos] = useState<Archivo[]>(archivosIniciales);
  const [subiendo, setSubiendo] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const guardarPrecio = async () => {
    setGuardandoPrecio(true);
    const valor = inputPrecio.trim() === '' ? null : Number(inputPrecio);
    await fetch(`/api/presupuestos/${presupuestoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ precioFinal: valor }),
    });
    setPrecioFinal(valor);
    setEditandoPrecio(false);
    setGuardandoPrecio(false);
  };

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
      if (data.archivos?.length) {
        await cargarArchivos();
      }
    } catch (error) {
      console.error('Error subiendo archivo:', error);
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Documentación del presupuesto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Precio final */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Precio final ($)</p>
          {editandoPrecio ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={inputPrecio}
                onChange={(e) => setInputPrecio(e.target.value)}
                className="w-48"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') guardarPrecio();
                  if (e.key === 'Escape') setEditandoPrecio(false);
                }}
              />
              <Button size="sm" onClick={guardarPrecio} disabled={guardandoPrecio}>
                {guardandoPrecio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditandoPrecio(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-slate-800">
                {precioFinal != null ? (
                  formatCurrency(precioFinal)
                ) : (
                  <span className="text-slate-400 text-sm font-normal">No definido</span>
                )}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-slate-500 hover:text-slate-700"
                onClick={() => {
                  setInputPrecio(precioFinal != null ? String(precioFinal) : '');
                  setEditandoPrecio(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {precioFinal != null && (
            <p className="text-xs text-slate-400">
              Este precio puede diferir del calculado si se usó software externo.
            </p>
          )}
        </div>

        <Separator />

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
                  <span className="text-sm text-slate-700 flex-1 truncate">{a.nombre}</span>
                  <span className="text-xs text-slate-400 shrink-0">{formatBytes(a.tamanio)}</span>
                  <a
                    href={a.url}
                    download={a.nombre}
                    className="text-slate-400 hover:text-sky-600 shrink-0"
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
  );
}
