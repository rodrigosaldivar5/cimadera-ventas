'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Bell, Plus, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Sidebar } from '@/components/layout/sidebar';
import { Badge } from '@/components/ui/badge';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clientes': 'Clientes',
  '/presupuestos': 'Presupuestos',
  '/materiales': 'Materiales',
  '/admin': 'Administración',
};

interface HeaderProps {
  userName: string;
  userEmail: string;
  rolNombre?: string | null;
}

export function Header({ userName, userEmail, rolNombre }: HeaderProps) {
  const pathname = usePathname();
  const title = Object.entries(pageTitles).find(([key]) => pathname.startsWith(key))?.[1] ?? 'CIMAdera';

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
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <Badge className="absolute -right-1 -top-1 h-4 w-4 rounded-full p-0 flex items-center justify-center text-[10px]">
            3
          </Badge>
        </Button>
        <Button asChild size="sm" className="bg-sky-500 hover:bg-sky-600">
          <Link href="/presupuestos/nuevo">
            <Plus className="mr-1.5 h-4 w-4" />
            Nuevo Presupuesto
          </Link>
        </Button>
      </div>
    </header>
  );
}
