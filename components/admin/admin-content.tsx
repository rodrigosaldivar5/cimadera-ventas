'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import type { User, Rol, Division, Area, PermisoRol } from '@prisma/client';

type UsuarioConRol = User & { rol: Rol | null };
type RolCompleto = Rol & { area: Area & { division: Division }; permisos: PermisoRol[] };
type DivisionCompleta = Division & { areas: (Area & { roles: Rol[] })[] };

interface Props {
  usuarios: UsuarioConRol[];
  roles: RolCompleto[];
  divisiones: DivisionCompleta[];
}

const MODULOS = ['clientes', 'presupuestos', 'materiales', 'admin'];

export function AdminContent({ usuarios, roles, divisiones }: Props) {
  const router = useRouter();

  const toggleAprobado = async (userId: string, aprobado: boolean) => {
    await fetch(`/api/admin/usuarios`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, aprobado }),
    });
    router.refresh();
  };

  const asignarRol = async (userId: string, rolId: string) => {
    await fetch(`/api/admin/usuarios`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, rolId: rolId === '__none__' ? null : rolId }),
    });
    router.refresh();
  };

  const togglePermiso = async (rolId: string, modulo: string, campo: string, valor: boolean) => {
    await fetch('/api/admin/permisos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rolId, modulo, campo, valor }),
    });
    router.refresh();
  };

  return (
    <Tabs defaultValue="usuarios">
      <TabsList className="mb-6">
        <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
        <TabsTrigger value="roles">Roles y Permisos</TabsTrigger>
        <TabsTrigger value="divisiones">Divisiones y Áreas</TabsTrigger>
      </TabsList>

      {/* Tab Usuarios */}
      <TabsContent value="usuarios">
        <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead className="text-center">Aprobado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nombre}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Select value={u.rolId ?? '__none__'} onValueChange={(v) => asignarRol(u.id, v)}>
                      <SelectTrigger className="h-8 w-40">
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
                  <TableCell>{formatDate(u.createdAt)}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={u.aprobado} onCheckedChange={(v) => toggleAprobado(u.id, v)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* Tab Roles y Permisos */}
      <TabsContent value="roles">
        <div className="space-y-6">
          {roles.map((rol) => (
            <div key={rol.id} className="rounded-lg border bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-3">
                <span className="font-semibold text-slate-800">{rol.nombre}</span>
                <Badge variant="secondary">{rol.area.division.nombre} · {rol.area.nombre}</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Módulo</TableHead>
                    <TableHead className="text-center">Ver</TableHead>
                    <TableHead className="text-center">Crear</TableHead>
                    <TableHead className="text-center">Editar</TableHead>
                    <TableHead className="text-center">Eliminar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MODULOS.map((modulo) => {
                    const permiso = rol.permisos.find((p) => p.modulo === modulo);
                    return (
                      <TableRow key={modulo}>
                        <TableCell className="capitalize font-medium">{modulo}</TableCell>
                        {['puede_ver', 'puede_crear', 'puede_editar', 'puede_eliminar'].map((campo) => (
                          <TableCell key={campo} className="text-center">
                            <Switch
                              checked={permiso ? (permiso[campo as keyof PermisoRol] as boolean) : false}
                              onCheckedChange={(v) => togglePermiso(rol.id, modulo, campo, v)}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      </TabsContent>

      {/* Tab Divisiones */}
      <TabsContent value="divisiones">
        <div className="space-y-4">
          {divisiones.map((div) => (
            <div key={div.id} className="rounded-lg border bg-white shadow-sm p-4">
              <h3 className="font-semibold text-slate-800 mb-3">{div.nombre}</h3>
              <div className="space-y-2 pl-4">
                {div.areas.map((area) => (
                  <div key={area.id} className="flex items-center gap-4">
                    <span className="text-sm text-slate-600">{area.nombre}</span>
                    <div className="flex gap-2">
                      {area.roles.map((rol) => (
                        <Badge key={rol.id} variant="secondary">{rol.nombre}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
