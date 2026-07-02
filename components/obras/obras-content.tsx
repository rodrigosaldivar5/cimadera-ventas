'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, Pencil, Archive, RotateCcw, Building2, Loader2 } from 'lucide-react';

type ClienteMin = { id: string; razonSocial: string };

export type ObraRow = {
  id: string;
  nombre: string;
  codigoObra: string | null;
  direccion: string | null;
  descripcion: string | null;
  activo: boolean;
  createdAt: string;
  clienteId: string;
  cliente: ClienteMin;
  _count: { presupuestos: number; cuentasCorrientes: number };
};

type Props = {
  obras: ObraRow[];
  clientes: ClienteMin[];
  total: number;
  page: number;
  perPage: number;
  q: string;
  clienteId: string;
  mostrarInactivas: boolean;
};

type FormData = {
  nombre: string;
  clienteId: string;
  codigoObra: string;
  direccion: string;
  descripcion: string;
};

const emptyForm: FormData = {
  nombre: '',
  clienteId: '',
  codigoObra: '',
  direccion: '',
  descripcion: '',
};

export function ObrasContent({
  obras,
  clientes,
  total,
  page,
  perPage,
  q,
  clienteId,
  mostrarInactivas,
}: Props) {
  const router   = useRouter();
  const pathname = usePathname();

  const [createOpen, setCreateOpen]   = useState(false);
  const [editOpen, setEditOpen]       = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [selected, setSelected]       = useState<ObraRow | null>(null);
  const [form, setForm]               = useState<FormData>(emptyForm);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const totalPages = Math.ceil(total / perPage);

  const pushParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const sp = new URLSearchParams();
      if (q)                sp.set('q', q);
      if (clienteId)        sp.set('clienteId', clienteId);
      if (mostrarInactivas) sp.set('inactivas', 'true');
      if (!updates.page)    sp.set('page', '1');
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined) sp.set(k, v);
        else sp.delete(k);
      }
      router.push(`${pathname}?${sp.toString()}`);
    },
    [q, clienteId, mostrarInactivas, pathname, router]
  );

  const setField = (key: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const openCreate = () => {
    setForm(emptyForm);
    setError('');
    setCreateOpen(true);
  };

  const openEdit = (obra: ObraRow) => {
    setSelected(obra);
    setForm({
      nombre:      obra.nombre,
      clienteId:   obra.clienteId,
      codigoObra:  obra.codigoObra  ?? '',
      direccion:   obra.direccion   ?? '',
      descripcion: obra.descripcion ?? '',
    });
    setError('');
    setEditOpen(true);
  };

  const openArchive = (obra: ObraRow) => {
    setSelected(obra);
    setArchiveOpen(true);
  };

  const handleCreate = async () => {
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return; }
    if (!form.clienteId)     { setError('El cliente es requerido'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/obras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre:      form.nombre.trim(),
          clienteId:   form.clienteId,
          codigoObra:  form.codigoObra.trim()   || null,
          direccion:   form.direccion.trim()    || null,
          descripcion: form.descripcion.trim()  || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Error al crear obra');
        return;
      }
      setCreateOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return; }
    if (!selected) return;
    setLoading(true); setError('');
    try {
      const payload: Record<string, unknown> = {
        nombre:      form.nombre.trim(),
        codigoObra:  form.codigoObra.trim()  || null,
        direccion:   form.direccion.trim()   || null,
        descripcion: form.descripcion.trim() || null,
      };
      if (form.clienteId !== selected.clienteId)
        payload.clienteId = form.clienteId;

      const res = await fetch(`/api/obras/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Error al guardar');
        return;
      }
      setEditOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await fetch(`/api/obras/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !selected.activo }),
      });
      setArchiveOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Obras</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {total} obra{total !== 1 ? 's' : ''} {mostrarInactivas ? 'archivada' : 'activa'}{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nueva obra
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Nombre, cliente o dirección…"
            defaultValue={q}
            className="pl-8"
            onKeyDown={(e) => {
              if (e.key === 'Enter')
                pushParams({ q: (e.target as HTMLInputElement).value || undefined });
            }}
            onBlur={(e) => pushParams({ q: e.target.value || undefined })}
          />
        </div>
        <Select
          value={clienteId || '__all__'}
          onValueChange={(v) =>
            pushParams({ clienteId: v === '__all__' ? undefined : v })
          }
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Todos los clientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos los clientes</SelectItem>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.razonSocial}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={mostrarInactivas ? 'default' : 'outline'}
          size="sm"
          className="self-center"
          onClick={() =>
            pushParams({ inactivas: mostrarInactivas ? undefined : 'true' })
          }
        >
          {mostrarInactivas ? 'Ver activas' : 'Ver archivadas'}
        </Button>
      </div>

      {/* Table */}
      <div className="border border-stone-200 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-stone-50">
              <TableHead className="font-semibold text-slate-700">Obra</TableHead>
              <TableHead className="font-semibold text-slate-700">Cliente</TableHead>
              <TableHead className="font-semibold text-slate-700">Dirección</TableHead>
              <TableHead className="font-semibold text-slate-700 text-center">
                Presupuestos
              </TableHead>
              <TableHead className="font-semibold text-slate-700">Estado</TableHead>
              <TableHead className="font-semibold text-slate-700">Alta</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {obras.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-slate-400 py-12"
                >
                  <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  {mostrarInactivas
                    ? 'Sin obras archivadas'
                    : 'Sin obras registradas'}
                </TableCell>
              </TableRow>
            )}
            {obras.map((obra) => (
              <TableRow key={obra.id} className="hover:bg-slate-50/60">
                <TableCell className="font-medium text-slate-800">
                  <div>{obra.nombre}</div>
                  {obra.codigoObra && (
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      {obra.codigoObra}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {obra.cliente.razonSocial}
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {obra.direccion ?? '—'}
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm font-semibold text-slate-700">
                    {obra._count.presupuestos}
                  </span>
                </TableCell>
                <TableCell>
                  {obra.activo ? (
                    <Badge className="bg-green-100 text-green-700 border-0 hover:bg-green-100">
                      Activa
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-500 border-0 hover:bg-slate-100">
                      Archivada
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-slate-400">
                  {new Date(obra.createdAt).toLocaleDateString('es-AR')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-7 h-7 text-slate-400 hover:text-blue-600"
                      title="Editar"
                      onClick={() => openEdit(obra)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`w-7 h-7 ${
                        obra.activo
                          ? 'text-slate-400 hover:text-amber-600'
                          : 'text-slate-400 hover:text-green-600'
                      }`}
                      title={obra.activo ? 'Archivar' : 'Restaurar'}
                      onClick={() => openArchive(obra)}
                    >
                      {obra.activo ? (
                        <Archive className="w-3.5 h-3.5" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => pushParams({ page: String(page - 1) })}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => pushParams({ page: String(page + 1) })}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* ── Create Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva obra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                {error}
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input
                placeholder="Ej: Edificio Palmeras"
                value={form.nombre}
                onChange={setField('nombre')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <Select
                value={form.clienteId}
                onValueChange={(v) => setForm((f) => ({ ...f, clienteId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente…" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.razonSocial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Código de obra{' '}
                <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Input
                placeholder="Ej: OB-2026-042"
                value={form.codigoObra}
                onChange={setField('codigoObra')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Dirección{' '}
                <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Input
                placeholder="Ej: Av. San Martín 1200, Mendoza"
                value={form.direccion}
                onChange={setField('direccion')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Observaciones{' '}
                <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Textarea
                rows={2}
                placeholder="Notas internas…"
                value={form.descripcion}
                onChange={setField('descripcion')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Crear obra'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar obra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                {error}
              </p>
            )}
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={setField('nombre')} />
            </div>
            <div className="space-y-1.5">
              <Label>
                Cliente
                {selected && selected._count.presupuestos > 0 && (
                  <span className="ml-2 text-xs text-amber-600 font-normal">
                    (no editable — tiene {selected._count.presupuestos}{' '}
                    presupuesto{selected._count.presupuestos !== 1 ? 's' : ''})
                  </span>
                )}
              </Label>
              {selected && selected._count.presupuestos > 0 ? (
                <Input
                  value={selected.cliente.razonSocial}
                  disabled
                  className="bg-slate-50"
                />
              ) : (
                <Select
                  value={form.clienteId}
                  onValueChange={(v) => setForm((f) => ({ ...f, clienteId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.razonSocial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>
                Código de obra{' '}
                <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Input value={form.codigoObra} onChange={setField('codigoObra')} />
            </div>
            <div className="space-y-1.5">
              <Label>
                Dirección{' '}
                <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Input value={form.direccion} onChange={setField('direccion')} />
            </div>
            <div className="space-y-1.5">
              <Label>
                Observaciones{' '}
                <span className="text-slate-400 font-normal">(opcional)</span>
              </Label>
              <Textarea
                rows={2}
                value={form.descripcion}
                onChange={setField('descripcion')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEdit}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Archive / Restore Dialog ─────────────────────────────────────────── */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selected?.activo ? 'Archivar obra' : 'Restaurar obra'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            {selected?.activo ? (
              <>
                La obra <strong>{selected.nombre}</strong> será archivada y no
                aparecerá en los selectores de nuevos presupuestos.
                {selected._count.presupuestos > 0 && (
                  <>
                    {' '}
                    Tiene{' '}
                    <strong>
                      {selected._count.presupuestos} presupuesto
                      {selected._count.presupuestos !== 1 ? 's' : ''}
                    </strong>{' '}
                    vinculado{selected._count.presupuestos !== 1 ? 's' : ''}{' '}
                    que seguirán accesibles.
                  </>
                )}
              </>
            ) : (
              <>
                La obra <strong>{selected?.nombre}</strong> volverá a estar
                activa y disponible para nuevos presupuestos.
              </>
            )}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchiveOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleArchive}
              disabled={loading}
              className={
                selected?.activo
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : selected?.activo ? (
                'Archivar'
              ) : (
                'Restaurar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
