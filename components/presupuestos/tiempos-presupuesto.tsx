import { prisma } from '@/lib/prisma';
import { calcularMinutosHabiles, formatMinutosHabiles } from '@/lib/business-time';
import { estadoLabel } from '@/lib/enums';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

interface Props {
  presupuestoId: string;
  estadoActual: string;
  fechaCreacion: Date;
}

type Tramo = {
  estado: string;
  desde: Date;
  hasta: Date | null; // null = en curso
  minutos: number;
  enCurso: boolean;
};

export async function TiemposPresupuesto({ presupuestoId, estadoActual, fechaCreacion }: Props) {
  const transiciones = await prisma.presupuestoEstadoTransicion.findMany({
    where: { presupuestoId },
    orderBy: { changedAt: 'asc' },
  });

  if (transiciones.length === 0) return null;

  const now = new Date();
  const tramos: Tramo[] = [];

  // Reconstruct stays from transition log
  let currentEstado = transiciones[0].estadoAnterior ?? 'PENDIENTE';
  let entryTime: Date = fechaCreacion;

  for (const t of transiciones) {
    const minutos = calcularMinutosHabiles(entryTime, t.changedAt);
    tramos.push({
      estado: currentEstado,
      desde: entryTime,
      hasta: t.changedAt,
      minutos,
      enCurso: false,
    });
    currentEstado = t.estadoNuevo;
    entryTime = t.changedAt;
  }

  // Current open state
  const minutosCurso = calcularMinutosHabiles(entryTime, now);
  tramos.push({
    estado: currentEstado,
    desde: entryTime,
    hasta: null,
    minutos: minutosCurso,
    enCurso: true,
  });

  const estadoColors: Record<string, string> = {
    PENDIENTE:   'bg-red-100 text-red-700 border-red-200',
    EN_PROCESO:  'bg-yellow-100 text-yellow-700 border-yellow-200',
    FRENADO:     'bg-purple-100 text-purple-700 border-purple-200',
    FINALIZADO:  'bg-amber-100 text-amber-700 border-amber-200',
    PARA_ENVIAR: 'bg-blue-100 text-blue-700 border-blue-200',
    ENVIADO:     'bg-sky-100 text-sky-700 border-sky-200',
    APROBADO:    'bg-green-100 text-green-700 border-green-200',
    RECHAZADO:   'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          Tiempos del presupuesto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tramos.map((t, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border shrink-0 ${estadoColors[t.estado] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {estadoLabel[t.estado] ?? t.estado}
              </span>
              <span className="text-slate-500 text-xs shrink-0">
                {t.desde.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                {t.hasta ? ` → ${t.hasta.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}` : ''}
              </span>
              <span className="ml-auto font-medium text-slate-700">
                {t.enCurso
                  ? <span className="text-[#00ADEF]">en curso · {formatMinutosHabiles(t.minutos)}</span>
                  : formatMinutosHabiles(t.minutos)
                }
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">Horas hábiles (lun–vie 08:00–17:00 hora Buenos Aires)</p>
      </CardContent>
    </Card>
  );
}
