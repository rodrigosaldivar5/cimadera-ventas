'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { Rol, Area, Division, PermisoRol, VisibilidadColumna } from '@prisma/client';
import { PERMISOS_CONFIG } from '@/lib/permisos-config';

type RolCompleto = Rol & {
  area: Area & { division: Division };
  permisos: PermisoRol[];
  columnas: VisibilidadColumna[];
};
type DivisionConAreas = Division & { areas: Area[] };

interface Props {
  roles: RolCompleto[];
  divisiones: DivisionConAreas[];
}

export function RolesContent({ roles: initialRoles, divisiones }: Props) {
  const router = useRouter();
  const [roles, setRoles] = useState(initialRoles);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoAreaId, setNuevoAreaId] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const allAreas = divisiones.flatMap((d) =>
    d.areas.map((a) => ({ ...a, divisionNombre: d.nombre }))
  );

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const updatePermiso = async (rolId: string, modulo: string, accion: string, permitido: boolean) => {
    await fetch('/api/admin/permisos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rolId, modulo, accion, permitido }),
    });
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== rolId) return r;
        const existing = r.permisos.find((p) => p.modulo === modulo && p.accion === accion);
        if (existing) {
          return { ...r, permisos: r.permisos.map((p) => p.modulo === modulo && p.accion === accion ? { ...p, permitido } : p) };
        }
        return { ...r, permisos: [...r.permisos, { id: `${rolId}-${modulo}-${accion}`, rolId, modulo, accion, permitido } as PermisoRol] };
      })
    );
  };

  const updateColumna = async (rolId: string, modulo: string, columna: string, visible: boolean) => {
    await fetch('/api/admin/permisos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rolId, modulo, columna, visible }),
    });
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== rolId) return r;
        const existing = r.columnas.find((c) => c.modulo === modulo && c.columna === columna);
        if (existing) {
          return { ...r, columnas: r.columnas.map((c) => c.modulo === modulo && c.columna === columna ? { ...c, visible } : c) };
        }
        return { ...r, columnas: [...r.columnas, { id: `${rolId}-${modulo}-${columna}`, rolId, modulo, columna, visible } as VisibilidadColumna] };
      })
    );
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">Roles y Permisos</h1>
        <Button className="bg-[#00ADEF] hover:bg-[#0089C7]" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Rol
        </Button>
      </div>

      {roles.map((rol) => {
        const isOpen = expanded.has(rol.id);
        return (
          <div key={rol.id} className="rounded-2xl border border-[#D4B896]/40 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b hover:bg-slate-100 transition-colors text-left"
              onClick={() => toggle(rol.id)}
            >
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                <span className="font-semibold text-slate-800">{rol.nombre}</span>
                <Badge variant="secondary" className="text-xs">
                  {rol.area.division.nombre} · {rol.area.nombre}
                </Badge>
              </div>
              <span className="text-xs text-slate-400">{rol.permisos.filter((p) => p.permitido).length} permisos activos</span>
            </button>

            {isOpen && (
              <div className="divide-y divide-slate-100">
                {(Object.entries(PERMISOS_CONFIG) as [string, typeof PERMISOS_CONFIG[keyof typeof PERMISOS_CONFIG]][]).map(([moduloKey, moduloConfig]) => (
                  <div key={moduloKey} className="p-4 space-y-3">
                    <p className="text-sm font-semibold text-slate-600">{moduloConfig.label}</p>

                    {/* Acciones */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {moduloConfig.acciones.map((accion) => {
                        const permiso = rol.permisos.find((p) => p.modulo === moduloKey && p.accion === accion.key);
                        return (
                          <div key={accion.key} className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
                            <span className="text-xs text-slate-600">{accion.label}</span>
                            <Switch
                              checked={permiso?.permitido ?? false}
                              onCheckedChange={(v) => updatePermiso(rol.id, moduloKey, accion.key, v)}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Columnas visibles (only for modules that have columns) */}
                    {'columnas' in moduloConfig && moduloConfig.columnas.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 mb-2">Columnas visibles</p>
                        <div className="flex flex-wrap gap-2">
                          {(moduloConfig.columnas as { key: string; label: string }[]).map((col) => {
                            const visReg = rol.columnas.find((c) => c.modulo === moduloKey && c.columna === col.key);
                            // Default visible if no record exists
                            const visible = visReg?.visible ?? true;
                            return (
                              <button
                                key={col.key}
                                onClick={() => updateColumna(rol.id, moduloKey, col.key, !visible)}
                                className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                                  visible
                                    ? 'bg-[#E6F7FD] text-[#0C447C] border-[#93C5FD]'
                                    : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                                }`}
                              >
                                {col.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

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
                className="bg-[#00ADEF] hover:bg-[#0089C7]"
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


