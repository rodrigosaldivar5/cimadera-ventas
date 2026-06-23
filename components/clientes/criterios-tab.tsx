'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';

type Criterio = {
  id: string;
  titulo: string;
  descripcion: string | null;
  activo: boolean;
  createdAt: Date | string;
};

interface Props {
  clienteId: string;
  criterios: Criterio[];
}

export function CriteriosTab({ clienteId, criterios: iniciales }: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Criterio | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditing(null);
    setTitulo('');
    setDescripcion('');
    setDialogOpen(true);
  };

  const openEdit = (c: Criterio) => {
    setEditing(c);
    setTitulo(c.titulo);
    setDescripcion(c.descripcion ?? '');
    setDialogOpen(true);
  };

  const save = async () => {
    if (!titulo.trim()) return;
    setSaving(true);
    if (editing) {
      await fetch(`/api/clientes/${clienteId}/criterios/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: titulo.trim(), descripcion: descripcion.trim() || null }),
      });
    } else {
      await fetch(`/api/clientes/${clienteId}/criterios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: titulo.trim(), descripcion: descripcion.trim() || null }),
      });
    }
    setSaving(false);
    setDialogOpen(false);
    router.refresh();
  };

  const toggleActivo = async (c: Criterio) => {
    await fetch(`/api/clientes/${clienteId}/criterios/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !c.activo }),
    });
    router.refresh();
  };

  const deleteCriterio = async (c: Criterio) => {
    if (!confirm(`¿Eliminar el criterio "${c.titulo}"?`)) return;
    await fetch(`/api/clientes/${clienteId}/criterios/${c.id}`, { method: 'DELETE' });
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew} className="bg-[#00ADEF] hover:bg-[#0089C7]">
          <Plus className="mr-1.5 h-4 w-4" /> Nuevo Criterio
        </Button>
      </div>

      {iniciales.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-10 border rounded-lg bg-white">
          Este cliente no tiene criterios definidos.
        </p>
      )}

      <div className="space-y-3">
        {iniciales.map((c) => (
          <div key={c.id} className={`rounded-xl border border-[#D4B896]/40 bg-white p-4 space-y-2 shadow-[0_1px_4px_rgba(0,0,0,0.05)] ${!c.activo ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <Badge variant={c.activo ? 'success' : 'secondary'} className="shrink-0">
                  {c.activo ? 'Activo' : 'Inactivo'}
                </Badge>
                <span className="font-medium text-slate-800">{c.titulo}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={c.activo} onCheckedChange={() => toggleActivo(c)} />
                <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-red-500" onClick={() => deleteCriterio(c)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {c.descripcion && (
              <p className="text-sm text-slate-500 ml-0.5">{c.descripcion}</p>
            )}
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Criterio' : 'Nuevo Criterio'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Título *</label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Requiere planos previos" autoFocus />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Descripción</label>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
                placeholder="Detalle del criterio..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-[#00ADEF] hover:bg-[#0089C7]" disabled={!titulo.trim() || saving} onClick={save}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


