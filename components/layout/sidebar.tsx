'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  Users,
  FileText,
  Package,
  Settings,
  LogOut,
  ChevronRight,
  ShoppingBag,
  UserCog,
  Shield,
  Percent,
  BookOpen,
  DoorOpen,
  Sofa,
  Layers,
  Wallet,
  TrendingUp,
  DollarSign,
  CalendarDays,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  children?: { href: string; label: string; icon: React.ElementType }[];
};

const TESORERIA_EMAILS = ['coordinacion.general@cimadera.net', 'admin@cimadera.net'];

const ROUTE_PERMISO: Record<string, { modulo: string; accion: string }> = {
  '/clientes': { modulo: 'clientes', accion: 'ver_lista' },
  '/presupuestos': { modulo: 'presupuestos', accion: 'ver_lista' },
  '/cuentas-corrientes': { modulo: 'cuentas_corrientes', accion: 'ver' },
};

const navItemsBase: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    href: '/clientes',
    label: 'Clientes',
    icon: Users,
    children: [
      { href: '/clientes/descuentos', label: 'Descuentos por tipo', icon: Percent },
    ],
  },
  { href: '/presupuestos', label: 'Presupuestos', icon: FileText },
  { href: '/cuentas-corrientes', label: 'Cuentas corrientes', icon: Wallet },
  {
    href: '/tesoreria',
    label: 'Tesorería',
    icon: TrendingUp,
    children: [
      { href: '/tesoreria/costos', label: 'Costos fijos', icon: DollarSign },
      { href: '/tesoreria/saldo', label: 'Registro de saldo', icon: CalendarDays },
    ],
  },
  { href: '/productos', label: 'Productos', icon: ShoppingBag },
  { href: '/materiales', label: 'Materiales', icon: Package },
  {
    href: '/catalogo',
    label: 'Catálogo',
    icon: BookOpen,
    children: [
      { href: '/catalogo/puertas', label: 'Puertas', icon: DoorOpen },
      { href: '/catalogo/amoblamientos', label: 'Amoblamientos', icon: Sofa },
      { href: '/catalogo/aluminio', label: 'Aluminio', icon: Layers },
    ],
  },
  {
    href: '/admin',
    label: 'Admin',
    icon: Settings,
    children: [
      { href: '/admin/usuarios', label: 'Usuarios', icon: UserCog },
      { href: '/admin/roles', label: 'Roles y Permisos', icon: Shield },
    ],
  },
];

interface SidebarProps {
  userName: string;
  userEmail: string;
  rolNombre?: string | null;
}

export function Sidebar({ userName, userEmail, rolNombre: rolNombreProp }: SidebarProps) {
  const pathname = usePathname();
  const [permisos, setPermisos] = useState<Record<string, Record<string, boolean>> | null>(null);
  const [rolNombre, setRolNombre] = useState<string | null>(rolNombreProp ?? null);

  useEffect(() => {
    fetch('/api/admin/mis-permisos')
      .then((r) => r.json())
      .then((d) => {
        setPermisos(d.permisos ?? null);
        if (d.rolNombre) setRolNombre(d.rolNombre);
      })
      .catch(() => {});
  }, []);

  const puedeVerRuta = (href: string): boolean => {
    if (href === '/tesoreria') return TESORERIA_EMAILS.includes(userEmail);
    const req = ROUTE_PERMISO[href];
    if (!req) return true;
    if (!permisos) return true;
    return permisos[req.modulo]?.[req.accion] === true;
  };

  const navItems = navItemsBase.filter((item) => puedeVerRuta(item.href));
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    '/admin': pathname.startsWith('/admin'),
    '/clientes': pathname.startsWith('/clientes/descuentos'),
    '/catalogo': pathname.startsWith('/catalogo'),
    '/tesoreria': pathname.startsWith('/tesoreria'),
  });

  const toggleItem = (href: string) =>
    setOpenItems((prev) => ({ ...prev, [href]: !prev[href] }));

  return (
    <aside className="flex h-full w-64 flex-col bg-[#1A1A1A]">
      {/* Logo */}
      <div className="flex h-20 items-center justify-center px-4 border-b border-white/10">
        <Logo variant="light" />
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.children
              ? pathname.startsWith(item.href)
              : pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

            if (item.children) {
              const isOpen = openItems[item.href] ?? false;
              return (
                <li key={item.href}>
                  <div className={cn(
                    'flex items-center rounded-lg transition-colors',
                    isActive ? 'bg-[#00ADEF]/10' : 'hover:bg-[#00ADEF]/10',
                  )}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 flex-1 px-3 py-2.5 text-sm font-medium',
                        isActive ? 'text-[#00ADEF]' : 'text-[#8A8A8A] hover:text-white'
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {item.label}
                    </Link>
                    <button
                      onClick={() => toggleItem(item.href)}
                      className={cn(
                        'px-2 py-2.5 text-[#8A8A8A] hover:text-white',
                      )}
                    >
                      <ChevronRight className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-90')} />
                    </button>
                  </div>
                  {isOpen && (
                    <ul className="mt-1 ml-4 space-y-1 border-l border-white/10 pl-3">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        const childActive = pathname.startsWith(child.href);
                        return (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              className={cn(
                                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                                childActive
                                  ? 'bg-[#00ADEF]/10 text-[#00ADEF] font-medium'
                                  : 'text-[#8A8A8A] hover:bg-[#00ADEF]/10 hover:text-white'
                              )}
                            >
                              <ChildIcon className="h-4 w-4 shrink-0" />
                              {child.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[#00ADEF]/10 text-[#00ADEF]'
                      : 'text-[#8A8A8A] hover:bg-[#00ADEF]/10 hover:text-white'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                  {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Usuario */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00ADEF] text-white text-sm font-semibold">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-100">{userName}</p>
            <p className="truncate text-xs text-slate-400">{rolNombre ?? userEmail}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-[#8A8A8A] hover:text-white hover:bg-[#00ADEF]/10"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
