'use client';

import { useState } from 'react';
import { Bell, Send, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Usuario = {
  id: string;
  nombre: string;
  email: string;
  pushSubscriptions: { id: string; createdAt: Date }[];
};

type NotifReciente = {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: string;
  leida: boolean;
  createdAt: Date;
  user: { nombre: string };
};

interface Props {
  usuarios: Usuario[];
  recentNotifs: NotifReciente[];
}

export function PushAdmin({ usuarios, recentNotifs }: Props) {
  const [sending, setSending] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, 'ok' | 'error'>>({});

  const enviarTest = async (userId: string) => {
    setSending(userId);
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      setResults((prev) => ({ ...prev, [userId]: res.ok ? 'ok' : 'error' }));
    } catch {
      setResults((prev) => ({ ...prev, [userId]: 'error' }));
    } finally {
      setSending(null);
      setTimeout(() => setResults((prev) => { const n = { ...prev }; delete n[userId]; return n; }), 3000);
    }
  };

  const conSuscripcion = usuarios.filter((u) => u.pushSubscriptions.length > 0);
  const sinSuscripcion = usuarios.filter((u) => u.pushSubscriptions.length === 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Push & Suscripciones</h2>
        <p className="text-sm text-slate-500 mt-1">Dispositivos registrados y envío de notificaciones de prueba</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="text-2xl font-bold text-[#00ADEF]">{conSuscripcion.length}</div>
            <div className="text-sm text-slate-500">Usuarios con push activo</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-2xl font-bold text-slate-400">{sinSuscripcion.length}</div>
            <div className="text-sm text-slate-500">Sin suscripción</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-2xl font-bold text-slate-700">{recentNotifs.length}</div>
            <div className="text-sm text-slate-500">Notificaciones recientes</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Suscripciones activas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {conSuscripcion.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-400">
              Ningún usuario tiene push activo. Deben ingresar al sistema y aceptar los permisos.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-2 text-slate-500 font-medium">Usuario</th>
                  <th className="text-left px-4 py-2 text-slate-500 font-medium">Email</th>
                  <th className="text-center px-4 py-2 text-slate-500 font-medium">Dispositivos</th>
                  <th className="text-right px-4 py-2 text-slate-500 font-medium">Test</th>
                </tr>
              </thead>
              <tbody>
                {conSuscripcion.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{u.nombre}</td>
                    <td className="px-4 py-3 text-slate-500">{u.email}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className="text-xs text-[#00ADEF] border-[#00ADEF]">
                        {u.pushSubscriptions.length}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {results[u.id] === 'ok' ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                          <CheckCircle className="h-4 w-4" /> Enviado
                        </span>
                      ) : results[u.id] === 'error' ? (
                        <span className="inline-flex items-center gap-1 text-red-500 text-xs">
                          <XCircle className="h-4 w-4" /> Error
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={sending === u.id}
                          onClick={() => enviarTest(u.id)}
                        >
                          {sending === u.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Send className="h-3 w-3 mr-1" />
                          )}
                          Enviar test
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {sinSuscripcion.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-slate-400">Sin suscripción</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sinSuscripcion.map((u) => (
                <span key={u.id} className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded px-2 py-1">
                  {u.nombre}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {recentNotifs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas notificaciones</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-2 text-slate-500 font-medium">Usuario</th>
                  <th className="text-left px-4 py-2 text-slate-500 font-medium">Título</th>
                  <th className="text-left px-4 py-2 text-slate-500 font-medium">Tipo</th>
                  <th className="text-center px-4 py-2 text-slate-500 font-medium">Leída</th>
                </tr>
              </thead>
              <tbody>
                {recentNotifs.map((n) => (
                  <tr key={n.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-600">{n.user.nombre}</td>
                    <td className="px-4 py-2.5 text-slate-700">{n.titulo}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="text-xs">{n.tipo}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {n.leida
                        ? <CheckCircle className="h-4 w-4 text-green-500 inline" />
                        : <span className="inline-block w-2 h-2 rounded-full bg-[#00ADEF]" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
