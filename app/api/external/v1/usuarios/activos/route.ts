import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/external-auth';
import { corsHeaders, jsonWithCors } from '@/lib/external-cors';
import { prisma } from '@/lib/prisma';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const origin = request.headers.get('origin');

  try {
    const usuarios = await prisma.user.findMany({
      where: { aprobado: true },
      orderBy: { nombre: 'asc' },
      include: { rol: { include: { area: { include: { division: true } } } } },
    });

    return jsonWithCors(usuarios.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol ? {
        id: u.rol.id,
        nombre: u.rol.nombre,
        area: u.rol.area.nombre,
        division: u.rol.area.division.nombre,
      } : null,
    })), 200, origin);
  } catch (error) {
    console.error('Error en /external/v1/usuarios/activos:', error);
    return jsonWithCors({ error: 'Internal server error' }, 500, origin);
  }
}
