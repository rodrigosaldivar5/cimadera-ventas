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
  hasta: Date | null;
  minutos: number;
  enCurso: boolean;
};

const BSAS_OFFSET = 3 * 60 * 60 * 1000;
const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function formatFechaBsAs(d: Date): string {
  const local = new Date(d.getTime() - BSAS_OFFSET);
  const dia = DIAS_ES[local.getUTCDay()];
  const dd  = String(local.getUTCDate()).padStart(2, '0');
  const mm  = String(local.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = local.getUTCFullYear();
  const hh  = String(local.getUTCHours()).padStart(2, '0');
  const min = String(local.getUTCMinutes()).padStart(2, '0');
  return `${dia} ${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE:   'bg-red-100 text-red-700 border-red-200',
  EN_PROCESO:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  FRENADO:     'bg-purple-100 text-purple-700 border-purple-200',
  FINALIZADO:  'bg-amber-100 text-amber-700 border-amber-200',
  PARA_ENVIAR: 'bg-blue-100 text-blue-700 border-blue-200',
  ENVIADO:     'bg-sky-100 text-sky-700 border-sky-200',
  APROBADO:    'bg-green-100 text-green-700 border-green-200',
  RECHAZADO:   'bg-red-100 text-red-700 border-red-200',
};

export async function TiemposPresupuesto({ presupuestoId, fechaCreacion }: Props) {
  const transiciones = await prisma.presupuestoEstadoTransicion.findMany({
    where: { presupuestoId },
    orderBy: { changedAt: 'asc' },
  });

  const now = new Date();
  const tramos: Tramo[] = [];

  if (transiciones.length > 0) {
    let currentEstado = transiciones[0].estadoAnterior ?? 'PENDIENTE';
    let entryTime: Date = fechaCreacion;

    for (const t of transiciones) {
      tramos.push({
        estado: currentEstado,
        desde: entryTime,
        hasta: t.changedAt,
        minutos: calcularMinutosHabiles(entryTime, t.changedAt),
        enCurso: false,
      });
      currentEstado = t.estadoNuevo;
      entryTime = t.changedAt;
    }

    tramos.push({
      estado: currentEstado,
      desde: entryTime,
      hasta: null,
      minutos: calcularMinutosHabiles(entryTime, now),
      enCurso: true,
    });
  }

  // Group tramos by estado preserving order of first appearance
  const grupos = new Map<string, Tramo[]>();
  for (const t of tramos) {
    if (!grupos.has(t.estado)) grupos.set(t.estado, []);
    grupos.get(t.estado)!.push(t);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          Tiempos del presupuesto
        </CardTitle>
      </CardHeader>
      <CardContent>
        {grupos.size === 0 ? (
          <p className="text-sm text-slate-400">Sin datos de tiempo registrados para este presupuesto.</p>
        ) : (
          <div className="space-y-5">
            {Array.from(grupos.entries()).map(([estado, estadoTramos]) => {
              const totalMinutos = estadoTramos.reduce((s, t) => s + t.minutos, 0);
              const hayEnCurso  = estadoTramos.some(t => t.enCurso);
              const multi       = estadoTramos.length > 1;
              const colorClass  = ESTADO_COLORS[estado] ?? 'bg-slate-100 text-slate-600 border-slate-200';
              const label       = estadoLabel[estado] ?? estado;

              return (
                <div key={estado} className="space-y-1.5">
                  {/* Estado badge */}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${colorClass}`}>
                    {label}
                  </span>

                  {/* Tramos */}
                  <div className="space-y-2 pl-1">
                    {estadoTramos.map((t, i) => (
                      <div key={i} className="text-sm text-slate-600 leading-relaxed">
                        {multi && (
                          <span className="text-xs text-slate-400 mr-1">{i + 1})</span>
                        )}
                        {t.enCurso ? (
                          <>
                            <span className="text-slate-500">desde</span>{' '}
                            <span className="font-medium text-slate-700">{formatFechaBsAs(t.desde)}</span>
                            {' '}—{' '}
                            <span className="text-[#00ADEF] font-semibold">en curso</span>
                            <br />
                            <span className="text-xs text-slate-400">
                              Tiempo hábil acumulado:{' '}
                              <span className="font-medium text-slate-600">{formatMinutosHabiles(t.minutos)}</span>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-500">de</span>{' '}
                            <span className="font-medium text-slate-700">{formatFechaBsAs(t.desde)}</span>{' '}
                            <span className="text-slate-500">a</span>{' '}
                            <span className="font-medium text-slate-700">{formatFechaBsAs(t.hasta!)}</span>{' '}
                            <span className="text-slate-400">=</span>{' '}
                            <span className="font-semibold text-slate-700">{formatMinutosHabiles(t.minutos)} hábiles</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Total (solo cuando hay múltiples tramos) */}
                  {multi && (
                    <div className="text-xs text-slate-500 pl-1">
                      Total {label.toLowerCase()}:{' '}
                      <span className="font-semibold text-slate-700">
                        {formatMinutosHabiles(totalMinutos)}{hayEnCurso ? ' (en curso)' : ''}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-slate-400 mt-4">Horas hábiles (lun–vie 08:00–17:00 hora Buenos Aires)</p>
      </CardContent>
    </Card>
  );
}
