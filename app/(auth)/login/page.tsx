'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [mostrarRestablecimiento, setMostrarRestablecimiento] = useState(false);
  const [emailReset, setEmailReset] = useState('');
  const [enviandoReset, setEnviandoReset] = useState(false);
  const [mensajeReset, setMensajeReset] = useState('');
  const [errorReset, setErrorReset] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      if (result.error === 'NO_APROBADO') {
        setError('Tu cuenta está pendiente de aprobación por un administrador.');
      } else {
        setError('Email o contraseña incorrectos.');
      }
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  const handleSolicitarReset = async () => {
    if (!emailReset) { setMensajeReset('Ingresá tu email'); setErrorReset(true); return; }
    setEnviandoReset(true);
    setMensajeReset('');
    try {
      const res = await fetch('/api/auth/solicitar-restablecimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailReset }),
      });
      const data = await res.json();
      if (res.ok) {
        setMensajeReset('Solicitud enviada. Un administrador la revisará y recibirás acceso pronto.');
        setErrorReset(false);
        setEmailReset('');
      } else {
        setMensajeReset(data.error ?? 'Error al enviar solicitud');
        setErrorReset(true);
      }
    } catch {
      setMensajeReset('Error de conexión');
      setErrorReset(true);
    } finally {
      setEnviandoReset(false);
    }
  };

  return (
    <>
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center">
            <Logo variant="dark" />
          </div>
          <CardTitle className="text-2xl font-display font-bold tracking-wide">Iniciar sesión</CardTitle>
          <CardDescription>Ingresá tu email y contraseña para continuar</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                {...register('email')}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
                className={errors.password ? 'border-red-500' : ''}
              />
              {errors.password && (
                <p className="text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full bg-[#00ADEF] hover:bg-[#0089C7]" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ingresar
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex-col gap-2 text-center">
          <p className="text-sm text-slate-500">
            ¿No tenés cuenta?{' '}
            <Link href="/register" className="font-medium text-[#00ADEF] hover:text-[#0089C7]">
              Registrate
            </Link>
          </p>
          <button
            type="button"
            onClick={() => setMostrarRestablecimiento(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#00ADEF',
              fontSize: '13px',
              cursor: 'pointer',
              marginTop: '4px',
              textDecoration: 'underline',
            }}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </CardFooter>
      </Card>

      {mostrarRestablecimiento && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }}>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '24px',
            maxWidth: '400px', width: '90%', boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1A1A1A', marginBottom: '8px' }}>
              Restablecer contraseña
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px' }}>
              Ingresá tu email. Se enviará una solicitud al administrador para autorizar el restablecimiento.
            </p>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>Email</label>
            <input
              type="email"
              value={emailReset}
              onChange={e => setEmailReset(e.target.value)}
              placeholder="tu@email.com"
              style={{
                width: '100%', padding: '8px 12px', borderRadius: '8px',
                border: '1px solid #E2E8F0', fontSize: '14px',
                marginTop: '4px', marginBottom: '16px', boxSizing: 'border-box',
              }}
            />
            {mensajeReset && (
              <p style={{
                fontSize: '13px', marginBottom: '12px', padding: '8px 12px', borderRadius: '6px',
                background: errorReset ? '#FEE2E2' : '#DCFCE7',
                color: errorReset ? '#991B1B' : '#166534',
              }}>
                {mensajeReset}
              </p>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setMostrarRestablecimiento(false); setMensajeReset(''); setErrorReset(false); setEmailReset(''); }}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: '1px solid #E2E8F0',
                  background: 'white', fontSize: '13px', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSolicitarReset}
                disabled={enviandoReset}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: 'none',
                  background: '#00ADEF', color: 'white', fontSize: '13px', cursor: 'pointer',
                  opacity: enviandoReset ? 0.6 : 1,
                }}
              >
                {enviandoReset ? 'Enviando...' : 'Solicitar restablecimiento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
