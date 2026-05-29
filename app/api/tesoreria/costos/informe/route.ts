import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const anio = parseInt(searchParams.get('anio') ?? String(new Date().getFullYear()));
  const mesDesde = parseInt(searchParams.get('mesDesde') ?? '1');
  const mesHasta = parseInt(searchParams.get('mesHasta') ?? String(new Date().getMonth() + 1));
  const tipoCambio = parseFloat(searchParams.get('tipoCambio') ?? '1145');

  const costos = await prisma.costoFijo.findMany({
    where: { activo: true },
    orderBy: { categoria: 'asc' },
    include: {
      registros: {
        where: { anio, mes: { gte: mesDesde, lte: mesHasta } },
        orderBy: { mes: 'asc' },
      },
    },
  });

  const meses = Array.from({ length: mesHasta - mesDesde + 1 }, (_, i) => mesDesde + i);

  const resumenMensual = meses.map((mes) => {
    let estimadoARS = 0, realARS = 0, estimadoUSD = 0, realUSD = 0;
    for (const c of costos) {
      const r = c.registros.find((r) => r.mes === mes);
      if (!r) continue;
      const est = r.montoEstimado ? Number(r.montoEstimado) : 0;
      const rea = r.montoReal ? Number(r.montoReal) : 0;
      if (c.moneda === 'USD') { estimadoUSD += est; realUSD += rea; }
      else { estimadoARS += est; realARS += rea; }
    }
    return { mes, estimadoARS, realARS, estimadoUSD, realUSD };
  });

  const categorias = Array.from(new Set(costos.map((c) => c.categoria))).sort();
  const porCategoria = categorias.map((cat) => {
    const items = costos.filter((c) => c.categoria === cat);
    return {
      categoria: cat,
      costos: items.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        moneda: c.moneda,
        registros: c.registros.map((r) => ({
          mes: r.mes,
          montoEstimado: r.montoEstimado ? Number(r.montoEstimado) : null,
          montoReal: r.montoReal ? Number(r.montoReal) : null,
        })),
      })),
      mesTotales: meses.map((mes) => {
        let estARS = 0, realARS = 0, estUSD = 0, realUSD = 0;
        for (const c of items) {
          const r = c.registros.find((r) => r.mes === mes);
          if (!r) continue;
          const est = r.montoEstimado ? Number(r.montoEstimado) : 0;
          const rea = r.montoReal ? Number(r.montoReal) : 0;
          if (c.moneda === 'USD') { estUSD += est; realUSD += rea; }
          else { estARS += est; realARS += rea; }
        }
        return { mes, estARS, realARS, estUSD, realUSD };
      }),
    };
  });

  return NextResponse.json({ anio, mesDesde, mesHasta, tipoCambio, resumenMensual, porCategoria, totalCostos: costos.length });
}
