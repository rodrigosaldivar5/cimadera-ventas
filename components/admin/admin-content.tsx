'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import type { User, Rol, Division, Area } from '@prisma/client';

type UsuarioConRol = User & { rol: Rol | null };
type RolCompleto = Rol & { area: Area & { division: Division } };
type DivisionCompleta = Division & { areas: (Area & { roles: Rol[] })[] };

interface Props {
  usuarios: UsuarioConRol[];
  roles: RolCompleto[];
  divisiones: DivisionCompleta[];
}


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


  return (
    <Tabs defaultValue="usuarios">
      <TabsList className="mb-6">
        <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
        <TabsTrigger value="roles">Roles y Permisos</TabsTrigger>
        <TabsTrigger value="divisiones">Divisiones y Áreas</TabsTrigger>
      </TabsList>

      {/* Tab Usuarios */}
      <TabsContent value="usuarios">
        <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
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
        <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] p-6 text-center space-y-3">
          <p className="text-slate-600 text-sm">La gestión de roles y permisos granulares se administra desde la página dedicada.</p>
          <a
            href="/admin/roles"
            className="inline-flex items-center px-4 py-2 rounded-md bg-[#00ADEF] hover:bg-[#0089C7] text-white text-sm font-medium transition-colors"
          >
            Ir a Roles y Permisos
          </a>
          <div className="mt-4 space-y-2">
            {roles.map((rol) => (
              <div key={rol.id} className="flex items-center gap-3 bg-slate-50 rounded-md px-3 py-2 text-sm">
                <span className="font-medium text-slate-800">{rol.nombre}</span>
                <Badge variant="secondary" className="text-xs">{rol.area.division.nombre} · {rol.area.nombre}</Badge>
              </div>
            ))}
          </div>
        </div>
      </TabsContent>

      {/* Tab Divisiones */}
      <TabsContent value="divisiones">
        <div className="space-y-4">
          {divisiones.map((div) => (
            <div key={div.id} className="rounded-xl border border-slate-100 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.05)] p-4">
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


