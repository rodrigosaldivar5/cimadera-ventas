'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PRIORIDAD, type Prioridad } from '@/lib/enums';
import { Check } from 'lucide-react';

const PRIORIDAD_BADGE_CLASS: Record<string, string> = {
  ALTA:  'bg-red-100 text-red-700 border-red-300',
  MEDIA: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  BAJA:  'bg-green-100 text-green-700 border-green-300',
};

const PRIORIDAD_LABEL: Record<string, string> = {
  ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja',
};

export function CambiarPrioridadBtn({
  presupuestoId,
  prioridadInicial,
}: {
  presupuestoId: string;
  prioridadInicial: Prioridad;
}) {
  const router = useRouter();
  const [prioridad, setPrioridad] = useState<Prioridad>(prioridadInicial);
  const [saving, setSaving] = useState(false);

  const handleChange = async (nueva: Prioridad) => {
    if (nueva === prioridad || saving) return;
    setSaving(true);
    try {
      await fetch(`/api/presupuestos/${presupuestoId}/prioridad`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prioridad: nueva }),
      });
      setPrioridad(nueva);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="focus:outline-none" disabled={saving}>
          <Badge
            variant="outline"
            className={`text-sm px-3 py-1 cursor-pointer hover:opacity-80 transition-opacity ${PRIORIDAD_BADGE_CLASS[prioridad]}`}
          >
            {PRIORIDAD_LABEL[prioridad]}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-28">
        {Object.values(PRIORIDAD).map((p) => (
          <DropdownMenuItem
            key={p}
            onSelect={() => handleChange(p)}
            className="gap-2 cursor-pointer"
          >
            <Badge variant="outline" className={`${PRIORIDAD_BADGE_CLASS[p]} pointer-events-none`}>
              {PRIORIDAD_LABEL[p]}
            </Badge>
            {p === prioridad && <Check className="h-3 w-3 ml-auto shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
