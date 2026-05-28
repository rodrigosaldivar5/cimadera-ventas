import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSaldoCaja, isTesoreriaAuthorized } from '@/lib/tesoreria';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!isTesoreriaAuthorized(session.user.email))
    return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });

  try {
    const { fechaRealizacion, valorVenta, descripcion } = await req.json();

    const canje = await prisma.activoCanje.findUnique({ where: { id: params.id } });
    if (!canje) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (canje.estado === 'REALIZADO')
      return NextResponse.json({ error: 'El canje ya fue realizado' }, { status: 400 });

    const valorVentaNum = parseFloat(valorVenta);
    const gananciaUSD = valorVentaNum - parseFloat(canje.valorEntrada.toString());
    const saldoUSD = await getSaldoCaja('USD');
    const fechaDate = new Date(fechaRealizacion);

    const result = await prisma.$transaction(async (tx) => {
      const canjeActualizado = await tx.activoCanje.update({
        where: { id: params.id },
        data: { estado: 'REALIZADO', fechaRealizacion: fechaDate, valorVenta: valorVentaNum, gananciaUSD },
      });
      await tx.movimientoTesoreria.create({
        data: {
          caja: 'USD',
          tipo: 'CANJE_REALIZADO',
          descripcion: descripcion || `Realización canje: ${canje.nombre}`,
          monto: valorVentaNum,
          saldoResultante: saldoUSD + valorVentaNum,
          fecha: fechaDate,
        },
      });
      return canjeActualizado;
    });

    return NextResponse.json({
      canje: {
        ...result,
        valorEntrada: parseFloat(result.valorEntrada.toString()),
        valorEstimado: parseFloat(result.valorEstimado.toString()),
        valorVenta: result.valorVenta ? parseFloat(result.valorVenta.toString()) : null,
        gananciaUSD: result.gananciaUSD ? parseFloat(result.gananciaUSD.toString()) : null,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Error al realizar canje' }, { status: 500 });
  }
}
