export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TESORERIA_EMAILS } from '@/lib/tesoreria';
import { TesoreriaModule } from '@/components/tesoreria/tesoreria-module';

export default async function TesoreriaPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  if (!TESORERIA_EMAILS.includes(session.user.email ?? '')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
        <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-2xl">🔒</div>
        <h1 className="text-2xl font-bold text-slate-800">Acceso restringido</h1>
        <p className="text-slate-500 max-w-sm">Este módulo es solo para administradores.</p>
        <Link href="/dashboard" className="mt-2 text-[#00ADEF] hover:underline text-sm">← Volver al dashboard</Link>
      </div>
    );
  }

  return <TesoreriaModule />;
}
