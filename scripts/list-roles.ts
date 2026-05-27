import { prisma } from '../lib/prisma';
async function main() {
  const roles = await prisma.rol.findMany({ select: { nombre: true } });
  console.log(JSON.stringify(roles, null, 2));
  await prisma.$disconnect();
}
main();
