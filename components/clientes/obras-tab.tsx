'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Building2, MapPin, Plus, FileText } from 'lucide-react';

interface Obra {
  id: string;
  nombre: string;
  direccion: string | null;
  descripcion: string | null;
  _count: { presupuestos: number };
}

interface Props {
  clienteId: string;
  obras: Obra[];
}

export function ObrasTab({ clienteId, obras: initialObras }: Props) {
  const [obras, setObras] = useState(initialObras);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const crearObra = async () => {
    if (!nombre.trim()) return;
    setIsLoading(true);
    const res = await fetch(`/api/clientes/${clienteId}/obras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre.trim(), direccion: direccion || null, descripcion: descripcion || null }),
    });
    if (res.ok) {
      const obra = await res.json();
      setObras((prev) => [...prev, { ...obra, _count: { presupuestos: 0 } }]);
      setDialogOpen(false);
      setNombre(''); setDireccion(''); setDescripcion('');
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-[#00ADEF] hover:bg-[#0089C7]">
          <Plus className="mr-1.5 h-4 w-4" /> Nueva Obra
        </Button>
      </div>

      {obras.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-200 py-12 text-center text-slate-400">
          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Este cliente no tiene obras registradas.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {obras.map((obra) => (
            <div key={obra.id} className="rounded-2xl border border-[#D4B896]/50 bg-white p-5 flex items-start justify-between gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.10)] transition-shadow">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800">{obra.nombre}</p>
                {obra.direccion && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-0.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span>{obra.direccion}</span>
                  </div>
                )}
                {obra.descripcion && <p className="text-xs text-slate-400 mt-1">{obra.descripcion}</p>}
              </div>
              <div className="shrink-0 flex items-center gap-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-700">{obra._count.presupuestos}</p>
                  <p className="text-xs text-slate-400">presup.</p>
                </div>
                {obra._count.presupuestos > 0 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/presupuestos?obraId=${obra.id}`}>
                      <FileText className="mr-1.5 h-3.5 w-3.5" /> Ver
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nueva obra</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus placeholder="Ej: Torre Madero Piso 3" />
            </div>
            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Ej: Av. Madero 1234" />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} placeholder="Notas adicionales..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={crearObra} disabled={!nombre.trim() || isLoading} className="bg-[#00ADEF] hover:bg-[#0089C7]">
              Crear obra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


