'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/utils';
import { CheckCircle, Clock, UserCheck, UserX } from 'lucide-react';
import type { User, Rol, Area, Division } from '@prisma/client';

type RolConArea = Rol & { area: Area & { division: Division } };
type UsuarioCompleto = User & { rol: RolConArea | null };

interface Props {
  usuarios: UsuarioCompleto[];
  roles: RolConArea[];
}

type FiltroEstado = 'todos' | 'aprobados' | 'pendientes';

export function UsuariosContent({ usuarios, roles }: Props) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<FiltroEstado>('todos');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const usuariosFiltrados = usuarios.filter((u) => {
    if (filtro === 'aprobados') return u.aprobado;
    if (filtro === 'pendientes') return !u.aprobado;
    return true;
  });

  const toggleAprobado = async (userId: string, aprobado: boolean) => {
    setLoadingId(userId);
    await fetch('/api/admin/usuarios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, aprobado }),
    });
    setLoadingId(null);
    router.refresh();
  };

  const asignarRol = async (userId: string, rolId: string) => {
    await fetch('/api/admin/usuarios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, rolId: rolId === '__none__' ? null : rolId }),
    });
    router.refresh();
  };

  const pendientesCount = usuarios.filter((u) => !u.aprobado).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Usuarios</h1>
          {pendientesCount > 0 && (
            <p className="text-sm text-amber-600 mt-0.5 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {pendientesCount} usuario{pendientesCount > 1 ? 's' : ''} pendiente{pendientesCount > 1 ? 's' : ''} de aprobación
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {(['todos', 'aprobados', 'pendientes'] as FiltroEstado[]).map((f) => (
            <Button
              key={f}
              variant={filtro === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltro(f)}
              className={filtro === f ? 'bg-sky-500 hover:bg-sky-600' : ''}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>División / Área</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuariosFiltrados.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.nombre}</TableCell>
                <TableCell className="text-slate-500">{u.email}</TableCell>
                <TableCell>
                  <Select value={u.rolId ?? '__none__'} onValueChange={(v) => asignarRol(u.id, v)}>
                    <SelectTrigger className="h-8 w-44">
                      <SelectValue placeholder="Sin rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin rol</SelectItem>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {u.rol ? `${u.rol.area.division.nombre} · ${u.rol.area.nombre}` : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={u.aprobado ? 'success' : 'warning'}>
                    {u.aprobado ? 'Aprobado' : 'Pendiente'}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-500">{formatDate(u.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={loadingId === u.id}
                    onClick={() => toggleAprobado(u.id, !u.aprobado)}
                    className={u.aprobado ? 'text-red-500 hover:text-red-600' : 'text-green-600 hover:text-green-700'}
                  >
                    {u.aprobado ? (
                      <><UserX className="mr-1 h-4 w-4" />Rechazar</>
                    ) : (
                      <><UserCheck className="mr-1 h-4 w-4" />Aprobar</>
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {usuariosFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-400 py-10">
                  No hay usuarios en este filtro
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
