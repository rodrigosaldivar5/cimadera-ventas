'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import type { Rol, Area, Division, PermisoRol } from '@prisma/client';

type RolCompleto = Rol & { area: Area & { division: Division }; permisos: PermisoRol[] };
type DivisionConAreas = Division & { areas: Area[] };

interface Props {
  roles: RolCompleto[];
  divisiones: DivisionConAreas[];
}

const MODULOS = ['clientes', 'presupuestos', 'productos', 'admin'];
const MODULO_LABEL: Record<string, string> = {
  clientes: 'Clientes',
  presupuestos: 'Presupuestos',
  productos: 'Productos',
  admin: 'Administración',
};

export function RolesContent({ roles, divisiones }: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoAreaId, setNuevoAreaId] = useState('');
  const [saving, setSaving] = useState(false);

  const allAreas = divisiones.flatMap((d) =>
    d.areas.map((a) => ({ ...a, divisionNombre: d.nombre }))
  );

  const togglePermiso = async (rolId: string, modulo: string, campo: string, valor: boolean) => {
    await fetch('/api/admin/permisos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rolId, modulo, campo, valor }),
    });
    router.refresh();
  };

  const crearRol = async () => {
    if (!nuevoNombre.trim() || !nuevoAreaId) return;
    setSaving(true);
    await fetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nuevoNombre.trim(), areaId: nuevoAreaId }),
    });
    setSaving(false);
    setDialogOpen(false);
    setNuevoNombre('');
    setNuevoAreaId('');
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Roles y Permisos</h1>
        <Button className="bg-sky-500 hover:bg-sky-600" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Rol
        </Button>
      </div>

      {roles.map((rol) => (
        <div key={rol.id} className="rounded-lg border bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-3">
            <span className="font-semibold text-slate-800">{rol.nombre}</span>
            <Badge variant="secondary">
              {rol.area.division.nombre} · {rol.area.nombre}
            </Badge>
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
                    <TableCell className="font-medium">{MODULO_LABEL[modulo]}</TableCell>
                    {(['puede_ver', 'puede_crear', 'puede_editar', 'puede_eliminar'] as const).map((campo) => (
                      <TableCell key={campo} className="text-center">
                        <Switch
                          checked={permiso ? (permiso[campo] as boolean) : false}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo Rol</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Nombre del rol</label>
              <Input
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Ej: Vendedor Senior"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Área</label>
              <Select value={nuevoAreaId} onValueChange={setNuevoAreaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un área" />
                </SelectTrigger>
                <SelectContent>
                  {allAreas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.divisionNombre} · {a.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button
                className="bg-sky-500 hover:bg-sky-600"
                disabled={!nuevoNombre.trim() || !nuevoAreaId || saving}
                onClick={crearRol}
              >
                {saving ? 'Guardando...' : 'Crear Rol'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
