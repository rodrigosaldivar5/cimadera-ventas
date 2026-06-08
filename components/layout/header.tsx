'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, Plus, Menu, MessageCircle, FileText, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Sidebar } from '@/components/layout/sidebar';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useEffect, useState, useCallback } from 'react';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clientes': 'Clientes',
  '/presupuestos': 'Presupuestos',
  '/materiales': 'Materiales',
  '/admin': 'Administración',
};

type Notificacion = {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: string;
  leida: boolean;
  linkUrl: string | null;
  createdAt: string;
};

function getNotifIconBg(tipo: string): string {
  switch (tipo) {
    case 'avance_requerido': return '#FEF3C7';
    case 'presupuesto_asignado': return '#DBEAFE';
    case 'alta_prioridad': return '#FEE2E2';
    case 'estado_cambio': return '#DCFCE7';
    default: return '#F1F5F9';
  }
}

function getNotifIcon(tipo: string) {
  const style = { width: 16, height: 16 };
  switch (tipo) {
    case 'avance_requerido': return <MessageCircle style={{ ...style, color: '#D97706' }} />;
    case 'presupuesto_asignado': return <FileText style={{ ...style, color: '#2563EB' }} />;
    case 'alta_prioridad': return <AlertTriangle style={{ ...style, color: '#DC2626' }} />;
    case 'estado_cambio': return <RefreshCw style={{ ...style, color: '#16A34A' }} />;
    default: return <Bell style={{ ...style, color: '#64748B' }} />;
  }
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

interface HeaderProps {
  userName: string;
  userEmail: string;
  rolNombre?: string | null;
}

export function Header({ userName, userEmail, rolNombre }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const title = Object.entries(pageTitles).find(([key]) => pathname.startsWith(key))?.[1] ?? 'CIMAdera';

  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotificaciones = useCallback(async () => {
    try {
      const res = await fetch('/api/notificaciones');
      if (!res.ok) return;
      const data = await res.json();
      setNotificaciones(data.notificaciones ?? []);
      setNoLeidas(data.noLeidas ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotificaciones();
    const interval = setInterval(fetchNotificaciones, 60000);
    return () => clearInterval(interval);
  }, [fetchNotificaciones]);

  const marcarTodasLeidas = async () => {
    await fetch('/api/notificaciones', { method: 'PATCH' });
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
    setNoLeidas(0);
  };

  const handleClickNotif = async (n: Notificacion) => {
    if (!n.leida) {
      await fetch(`/api/notificaciones/${n.id}`, { method: 'PATCH' });
      setNotificaciones((prev) => prev.map((x) => x.id === n.id ? { ...x, leida: true } : x));
      setNoLeidas((prev) => Math.max(0, prev - 1));
    }
    if (n.linkUrl) {
      setOpen(false);
      router.push(n.linkUrl);
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
      {/* Mobile menu */}
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar userName={userName} userEmail={userEmail} rolNombre={rolNombre} />
          </SheetContent>
        </Sheet>
        <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-3">
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {noLeidas > 0 && (
                <Badge className="absolute -right-1 -top-1 h-4 w-4 rounded-full p-0 flex items-center justify-center text-[10px]">
                  {noLeidas > 9 ? '9+' : noLeidas}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="p-0" style={{ width: 380 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: '#1A1A1A' }}>Notificaciones</span>
              {noLeidas > 0 && (
                <button
                  onClick={marcarTodasLeidas}
                  style={{ fontSize: 12, color: '#00ADEF', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>

            {/* Lista */}
            <div style={{ maxHeight: 440, overflowY: 'auto' }}>
              {notificaciones.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                  Sin notificaciones
                </div>
              ) : (
                notificaciones.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleClickNotif(n)}
                    style={{
                      display: 'flex', gap: 12, padding: '12px 16px', cursor: n.linkUrl ? 'pointer' : 'default',
                      background: n.leida ? 'transparent' : '#F8FBFF',
                      borderBottom: '1px solid #F1F5F9',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#F1F5F9'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = n.leida ? 'transparent' : '#F8FBFF'; }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: getNotifIconBg(n.tipo), flexShrink: 0,
                    }}>
                      {getNotifIcon(n.tipo)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: n.leida ? 400 : 600, color: '#1A1A1A', marginBottom: 2 }}>
                        {n.titulo}
                      </p>
                      <p style={{ fontSize: 12, color: '#64748B', lineHeight: '1.4' }}>
                        {n.mensaje}
                      </p>
                      <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>
                    {!n.leida && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ADEF', flexShrink: 0, marginTop: 6 }} />
                    )}
                  </div>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button asChild size="sm" className="bg-[#00ADEF] hover:bg-[#0089C7]">
          <Link href="/presupuestos/nuevo">
            <Plus className="mr-1.5 h-4 w-4" />
            Nuevo Presupuesto
          </Link>
        </Button>
      </div>
    </header>
  );
}
