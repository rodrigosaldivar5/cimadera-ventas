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
    // Solo mostrar si el browser soporta notificaciones y no se pidió aún
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (!('serviceWorker' in navigator)) return;
    if (Notification.permission === 'granted') {
      // Verificar que el SW está registrado
      registrarSW();
      return;
    }
    // Si es 'default' (no pidió aún), mostrar el banner
    if (Notification.permission === 'default') {
      // Verificar si el usuario ya lo descartó antes
      const descartado = localStorage.getItem('push_banner_dismissed');
      if (descartado) return;
      setMostrar(true);
    }
  }, []);

  const registrarSW = async () => {
    console.log('[PUSH BANNER] Registrando Service Worker...');
    // Verificar VAPID key
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    console.log('[PUSH BANNER] VAPID key presente:', !!vapidKey);
    console.log('[PUSH BANNER] VAPID key valor:', vapidKey ? vapidKey.slice(0, 20) + '...' : 'undefined');

    if (!vapidKey) {
      console.error('[PUSH BANNER] NEXT_PUBLIC_VAPID_PUBLIC_KEY no está configurada');
      alert('Error: VAPID key no configurada. Contactar al administrador.');
      return;
    }

    console.log('[PUSH BANNER] navigator.serviceWorker.register(/push-sw.js)...');
    const registration = await navigator.serviceWorker.register('/push-sw.js');
    console.log('[PUSH BANNER] SW registrado, scope:', registration.scope);

    // Esperar a que el SW esté activo usando la registration directa, con timeout
    console.log('[PUSH BANNER] Esperando SW activo...');
    await new Promise<void>((resolve) => {
      if (registration.active) { resolve(); return; }
      const sw = registration.installing ?? registration.waiting;
      if (!sw) { resolve(); return; }
      sw.addEventListener('statechange', function handler() {
        if (sw.state === 'activated') { sw.removeEventListener('statechange', handler); resolve(); }
      });
      setTimeout(resolve, 3000);
    });
    console.log('[PUSH BANNER] SW activo OK');

    let subscription = await registration.pushManager.getSubscription();
    console.log('[PUSH BANNER] Suscripción existente:', !!subscription);

    if (!subscription) {
      console.log('[PUSH BANNER] Creando nueva suscripción...');
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
        console.log('[PUSH BANNER] Suscripción creada OK');
      } catch (subErr) {
        console.error('[PUSH BANNER] Error creando suscripción:', subErr);
        alert('Error al suscribirse a push: ' + (subErr as Error).message);
        return;
      }
    }

    const subJSON = subscription.toJSON();
    console.log('[PUSH BANNER] Endpoint:', subJSON.endpoint ? subJSON.endpoint.slice(0, 50) + '...' : 'none');
    console.log('[PUSH BANNER] Keys presentes:', !!subJSON.keys?.p256dh, !!subJSON.keys?.auth);

    console.log('[PUSH BANNER] Enviando suscripción al servidor...');
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subJSON.endpoint,
        keys: { p256dh: subJSON.keys?.p256dh ?? '', auth: subJSON.keys?.auth ?? '' },
      }),
    });
    console.log('[PUSH BANNER] Response status:', res.status);
    const resData = await res.json();
    console.log('[PUSH BANNER] Response data:', resData);

    if (res.ok) {
      console.log('[PUSH BANNER] === SUSCRIPCIÓN COMPLETA ===');
      // Test: enviar notificación de prueba para confirmar que llega
      console.log('[PUSH BANNER] Enviando push de prueba...');
      fetch('/api/push/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
        .then((r) => console.log('[PUSH BANNER] Test push enviado, status:', r.status))
        .catch((e) => console.error('[PUSH BANNER] Test push error:', e));
    }
  };

  const handleActivar = async () => {
    setPidiendo(true);
    console.log('[PUSH BANNER] === INICIO ACTIVACIÓN ===');

    try {
      // Verificar soporte
      if (!('Notification' in window)) {
        console.error('[PUSH BANNER] Notification API no soportada');
        alert('Tu navegador no soporta notificaciones push.');
        return;
      }
      if (!('serviceWorker' in navigator)) {
        console.error('[PUSH BANNER] Service Workers no soportados');
        alert('Tu navegador no soporta Service Workers.');
        return;
      }

      // Pedir permiso
      console.log('[PUSH BANNER] Permiso actual:', Notification.permission);
      console.log('[PUSH BANNER] Pidiendo permiso...');
      const permission = await Notification.requestPermission();
      console.log('[PUSH BANNER] Resultado permiso:', permission);

      if (permission !== 'granted') {
        console.log('[PUSH BANNER] Permiso denegado o dismissed');
        alert('Necesitás permitir las notificaciones en tu navegador para activar push.');
        return;
      }

      await registrarSW();
      setMostrar(false);
    } catch (e) {
      console.error('[PUSH BANNER] Error en handleActivar:', e);
      alert('Error activando push: ' + (e as Error).message);
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
