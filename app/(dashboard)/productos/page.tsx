export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { ProductosContent } from '@/components/productos/productos-content';

export default async function ProductosPage() {
  const [productos, categorias, categoriasItem] = await Promise.all([
    prisma.producto.findMany({
      include: {
        categoria: true,
        atributos: { include: { opciones: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.categoriaProducto.findMany({ orderBy: { nombre: 'asc' } }),
    prisma.categoriaItem.findMany({
      include: { items: { where: { activo: true }, orderBy: { nombre: 'asc' } } },
      orderBy: { nombre: 'asc' },
    }),
  ]);

  return <ProductosContent productos={productos} categorias={categorias} categoriasItem={categoriasItem} />;
}
