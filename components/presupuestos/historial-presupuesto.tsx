'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, User2 } from 'lucide-react';

type EntradaAuditoria = {
  id: string;
  accion: string;
  camposModificados: Record<string, unknown> | null;
  createdAt: string;
  usuario: { nombre: string } | null;
};

const ACCION_LABEL: Record<string, string> = {
  CREACION: 'Creación del presupuesto',
  MODIFICACION: 'Modificación',
  CAMBIO_ESTADO: 'Cambio de estado',
  ACTUALIZACION_PRECIOS: 'Actualización de precios',
  ADJUNTO_SUBIDO: 'Adjunto subido',
  ADJUNTO_ELIMINADO: 'Adjunto eliminado',
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function CamposDiff({ campos }: { campos: Record<string, unknown> }) {
  const entradas = Object.entries(campos);
  if (entradas.length === 0) return null;
  return (
    <div className="mt-1.5 space-y-0.5">
      {entradas.map(([campo, vals]) => {
        if (vals && typeof vals === 'object' && 'antes' in (vals as object)) {
          const v = vals as { antes: unknown; despues: unknown };
          return (
            <p key={campo} className="text-xs text-slate-500">
              <span className="font-medium capitalize">{campo}:</span>{' '}
              <span className="line-through text-slate-400">{String(v.antes ?? '—')}</span>
              {' → '}
              <span className="text-slate-700">{String(v.despues ?? '—')}</span>
            </p>
          );
        }
        return (
          <p key={campo} className="text-xs text-slate-500">
            <span className="font-medium capitalize">{campo}:</span> {String(vals)}
          </p>
        );
      })}
    </div>
  );
}

export function HistorialPresupuesto({ presupuestoId }: { presupuestoId: string }) {
  const [entradas, setEntradas] = useState<EntradaAuditoria[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/presupuestos/${presupuestoId}/auditoria`)
      .then((r) => r.json())
      .then((data: EntradaAuditoria[]) => setEntradas(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [presupuestoId]);

  return (
    <Card className="shadow-lg">
      <CardContent className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-700">Historial de cambios</h2>
        {loading ? (
          <p className="text-sm text-slate-400">Cargando...</p>
        ) : entradas.length === 0 ? (
          <p className="text-sm text-slate-400">Sin registros de auditoría</p>
        ) : (
          <div className="relative">
            {entradas.map((e, i) => (
              <div key={e.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-2.5 w-2.5 rounded-full bg-sky-400 mt-0.5 shrink-0" />
                  {i < entradas.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1 min-h-[16px]" />}
                </div>
                <div className="pb-4 min-w-0">
                  <p className="text-sm font-medium text-slate-700">
                    {ACCION_LABEL[e.accion] ?? e.accion}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <User2 className="h-3 w-3" />
                      {e.usuario?.nombre ?? 'Sistema'}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(e.createdAt)}
                    </span>
                  </div>
                  {e.camposModificados && (
                    <CamposDiff campos={e.camposModificados as Record<string, unknown>} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
