'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Check, X, Loader2, User2 } from 'lucide-react';

type Usuario = { id: string; nombre: string };

interface Props {
  presupuestoId: string;
  responsableInicial: Usuario | null;
  usuarios: Usuario[];
}

export function EditarResponsable({ presupuestoId, responsableInicial, usuarios }: Props) {
  const [responsable, setResponsable] = useState<Usuario | null>(responsableInicial);
  const [editando, setEditando] = useState(false);
  const [seleccionado, setSeleccionado] = useState(responsableInicial?.id ?? '__none__');
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    const id = seleccionado === '__none__' ? null : seleccionado;
    const res = await fetch(`/api/presupuestos/${presupuestoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responsableId: id }),
    });
    if (res.ok) {
      setResponsable(id ? (usuarios.find((u) => u.id === id) ?? null) : null);
      setEditando(false);
      setToast(true);
      setTimeout(() => setToast(false), 3000);
    }
    setGuardando(false);
  };

  return (
    <div className="space-y-1 relative">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wide">
        <User2 className="h-4 w-4" /> Responsable
      </div>
      {editando ? (
        <div className="flex items-center gap-2">
          <Select value={seleccionado} onValueChange={setSeleccionado}>
            <SelectTrigger className="w-52 h-8 text-sm">
              <SelectValue placeholder="Sin responsable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin responsable</SelectItem>
              {usuarios.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 px-2" onClick={guardar} disabled={guardando}>
            {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setEditando(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <p className="font-semibold text-slate-800">
            {responsable?.nombre ?? <span className="text-slate-400 font-normal text-sm">Sin responsable</span>}
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
            onClick={() => {
              setSeleccionado(responsable?.id ?? '__none__');
              setEditando(true);
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      )}
      {toast && (
        <div className="absolute -top-8 left-0 bg-green-600 text-white text-xs px-3 py-1 rounded shadow-md animate-in fade-in">
          Responsable actualizado
        </div>
      )}
    </div>
  );
}
