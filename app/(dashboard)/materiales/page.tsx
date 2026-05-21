export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { MateriaisContent } from '@/components/materiales/materiales-content';

export default async function MateriaisPage() {
  const categorias = await prisma.categoriaItem.findMany({
    include: { items: { where: { activo: true }, orderBy: { nombre: 'asc' } } },
    orderBy: { nombre: 'asc' },
  });

  return <MateriaisContent categorias={categorias} />;
}
