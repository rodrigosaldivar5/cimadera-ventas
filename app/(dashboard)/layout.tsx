import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PushProvider } from '@/components/push-provider';
import { PushPermissionBanner } from '@/components/push-permission-banner';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) redirect('/login');
  if (!session.user.aprobado) redirect('/pendiente');

  return (
    <>
      <PushProvider>
        <div className="flex h-screen overflow-hidden bg-[#F2F2F2]">
          {/* Sidebar desktop */}
          <div className="hidden lg:flex lg:flex-shrink-0">
            <Sidebar
              userName={session.user.nombre}
              userEmail={session.user.email ?? ''}
              rolNombre={session.user.rolNombre}
            />
          </div>

          {/* Contenido principal */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header
              userName={session.user.nombre}
              userEmail={session.user.email ?? ''}
              rolNombre={session.user.rolNombre}
            />
            <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
          </div>
        </div>
      </PushProvider>
      <PushPermissionBanner />
    </>
  );
}
