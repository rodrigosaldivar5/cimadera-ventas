'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';

interface Props {
  presupuestoId: string;
  ftpDriveUrl?: string | null;
}

export function FtpBtn({ presupuestoId, ftpDriveUrl }: Props) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error: boolean } | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setToast(null);
    try {
      const res = await fetch(`/api/presupuestos/${presupuestoId}/ftp`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Error al generar la FTP');
      }
      setToast({ msg: data.created ? 'FTP creada' : 'Abriendo FTP existente', error: false });
      setTimeout(() => setToast(null), 3000);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al generar la FTP';
      setToast({ msg, error: true });
      setTimeout(() => setToast(null), 6000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={loading}
        title={ftpDriveUrl ? 'Ver FTP existente' : 'Generar Ficha Técnica para Presupuestos'}
        className="gap-1.5"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        FTP
        {ftpDriveUrl && !loading && (
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" title="FTP existente" />
        )}
      </Button>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2 ${
            toast.error ? 'bg-red-600' : 'bg-green-600'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </>
  );
}
