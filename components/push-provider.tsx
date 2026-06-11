'use client';

import { useEffect } from 'react';
import React from 'react';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

export function PushProvider({ children }: { children?: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    const register = async () => {
      try {
        // 1. Registrar el service worker de push
        await navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        }
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON()),
        });
      } catch (err) {
        console.error('[Push] Registration failed:', err);
      }
    };

    // Delay para no bloquear el render inicial
    const t = setTimeout(register, 3000);
    return () => clearTimeout(t);
  }, []);

  // En el return, envolver los children:
  return <>{children}</>;
}
