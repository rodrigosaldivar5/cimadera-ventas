'use client';

import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

export function PushPermissionBanner() {
  const [mostrar, setMostrar] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      const descartado = localStorage.getItem('push_banner_dismissed');
      if (!descartado) setMostrar(true);
    }
  }, []);

  const registrarSW = async () => {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }
    const json = subscription.toJSON();
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
      }),
    });
  };

  const handleActivar = async () => {
    setPidiendo(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await registrarSW();
        setMostrar(false);
      }
    } catch (e) {
      console.error('[Push] Error pidiendo permiso:', e);
    } finally {
      setPidiendo(false);
    }
  };

  const handleDescartar = () => {
    setMostrar(false);
    localStorage.setItem('push_banner_dismissed', 'true');
  };

  if (!mostrar) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '20px', right: '20px', maxWidth: '380px',
      padding: '16px 20px', background: 'white', borderRadius: '12px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.12)', border: '1px solid #E2E8F0',
      zIndex: 9999, display: 'flex', gap: '12px', alignItems: 'flex-start',
    }}>
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px', background: '#E0F2FE',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Bell className="h-5 w-5 text-[#00ADEF]" />
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A1A', marginBottom: '4px' }}>
          Activar notificaciones
        </p>
        <p style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.4', marginBottom: '12px' }}>
          Recibí alertas cuando te asignen presupuestos, pidan avance o cambien estados.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            size="sm"
            onClick={handleActivar}
            disabled={pidiendo}
            style={{ background: '#00ADEF', color: 'white', fontSize: '12px' }}
          >
            {pidiendo ? 'Activando...' : 'Activar push'}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDescartar} style={{ fontSize: '12px', color: '#94A3B8' }}>
            Ahora no
          </Button>
        </div>
      </div>
      <button onClick={handleDescartar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
        <X className="h-4 w-4 text-gray-400" />
      </button>
    </div>
  );
}
