'use client';

import { useState, useTransition } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const EVENTOS = [
  { tipo: 'avance_requerido',     label: 'Avance requerido',    color: '#D97706' },
  { tipo: 'presupuesto_asignado', label: 'Presupuesto asignado', color: '#2563EB' },
  { tipo: 'estado_cambio',        label: 'Cambio de estado',    color: '#16A34A' },
  { tipo: 'alta_prioridad',       label: 'Alta prioridad',      color: '#DC2626' },
  { tipo: 'general',              label: 'General',             color: '#64748B' },
] as const;

type Evento = typeof EVENTOS[number]['tipo'];

type Usuario = {
  id: string;
  nombre: string;
  email: string;
  pushSubscriptions: { id: string }[];
};

type Preferencia = {
  userId: string;
  tipo: string;
  activo: boolean;
};

interface Props {
  usuarios: Usuario[];
  preferencias: Preferencia[];
}

function buildMap(preferencias: Preferencia[]): Record<string, Record<string, boolean>> {
  const map: Record<string, Record<string, boolean>> = {};
  for (const p of preferencias) {
    if (!map[p.userId]) map[p.userId] = {};
    map[p.userId][p.tipo] = p.activo;
  }
  return map;
}

function isActivo(map: Record<string, Record<string, boolean>>, userId: string, tipo: string): boolean {
  return map[userId]?.[tipo] ?? true;
}

export function NotificacionesContent({ usuarios, preferencias }: Props) {
  const [prefMap, setPrefMap] = useState(() => buildMap(preferencias));
  const [saving, setSaving] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const toggle = async (userId: string, tipo: Evento) => {
    const key = `${userId}:${tipo}`;
    const current = isActivo(prefMap, userId, tipo);
    setSaving(key);

    startTransition(() => {
      setPrefMap((prev) => ({
        ...prev,
        [userId]: { ...(prev[userId] ?? {}), [tipo]: !current },
      }));
    });

    try {
      await fetch('/api/admin/notificacion-preferencias', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tipo, activo: !current }),
      });
    } catch {
      startTransition(() => {
        setPrefMap((prev) => ({
          ...prev,
          [userId]: { ...(prev[userId] ?? {}), [tipo]: current },
        }));
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Notificaciones</h2>
        <p className="text-sm text-slate-500 mt-1">
          Configurá qué eventos recibe cada usuario por push. 🔔 = activo, 🔕 = silenciado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Parametrización por usuario y evento
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-slate-500 font-medium w-48">Usuario</th>
                <th className="text-center px-3 py-3 text-slate-500 font-medium w-6">Push</th>
                {EVENTOS.map((e) => (
                  <th key={e.tipo} className="text-center px-3 py-3 font-medium" style={{ color: e.color, minWidth: 110 }}>
                    <span className="text-xs">{e.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const tienePush = u.pushSubscriptions.length > 0;
                return (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-700">{u.nombre}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {tienePush
                        ? <Badge variant="outline" className="text-[10px] text-[#00ADEF] border-[#00ADEF] px-1.5">{u.pushSubscriptions.length}</Badge>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    {EVENTOS.map((e) => {
                      const key = `${u.id}:${e.tipo}`;
                      const activo = isActivo(prefMap, u.id, e.tipo);
                      const isSaving = saving === key;
                      return (
                        <td key={e.tipo} className="px-3 py-3 text-center">
                          <button
                            onClick={() => toggle(u.id, e.tipo)}
                            disabled={isSaving}
                            className={cn(
                              'inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                              activo
                                ? 'bg-[#00ADEF]/10 text-[#00ADEF] hover:bg-[#00ADEF]/20'
                                : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                            )}
                            title={activo ? 'Activo — clic para silenciar' : 'Silenciado — clic para activar'}
                          >
                            {isSaving
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : activo
                                ? <Bell className="h-3.5 w-3.5" />
                                : <BellOff className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400">
        Los cambios se guardan automáticamente. Silenciar un evento no elimina la suscripción push del dispositivo, solo evita que reciba ese tipo de notificación.
      </p>
    </div>
  );
}
