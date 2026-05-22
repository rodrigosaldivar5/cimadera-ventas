import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Ensure .env.local contains DATABASE_URL.');
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Iniciando seed...');

  // --- Divisiones, Áreas y Roles ---

  const divVentas = await prisma.division.upsert({
    where: { nombre: 'Ventas' },
    update: {},
    create: { nombre: 'Ventas' },
  });

  const areaComercial = await prisma.area.upsert({
    where: { id: 'area-comercial' },
    update: {},
    create: { id: 'area-comercial', nombre: 'Comercial', divisionId: divVentas.id },
  });

  const rolVendedor = await prisma.rol.upsert({
    where: { id: 'rol-vendedor' },
    update: {},
    create: { id: 'rol-vendedor', nombre: 'Vendedor', areaId: areaComercial.id },
  });

  const divGerencia = await prisma.division.upsert({
    where: { nombre: 'Gerencia' },
    update: {},
    create: { nombre: 'Gerencia' },
  });

  const areaDireccion = await prisma.area.upsert({
    where: { id: 'area-direccion' },
    update: {},
    create: { id: 'area-direccion', nombre: 'Dirección', divisionId: divGerencia.id },
  });

  const rolAdmin = await prisma.rol.upsert({
    where: { id: 'rol-admin' },
    update: {},
    create: { id: 'rol-admin', nombre: 'Administrador', areaId: areaDireccion.id },
  });

  // --- Permisos Vendedor ---
  const modulosVendedor = ['clientes', 'presupuestos'];
  for (const modulo of modulosVendedor) {
    await prisma.permisoRol.upsert({
      where: { id: `perm-vendedor-${modulo}` },
      update: {},
      create: {
        id: `perm-vendedor-${modulo}`,
        rolId: rolVendedor.id,
        modulo,
        puede_ver: true,
        puede_crear: true,
        puede_editar: true,
        puede_eliminar: false,
      },
    });
  }

  // --- Permisos Admin (todos los módulos) ---
  const modulosAdmin = ['clientes', 'presupuestos', 'materiales', 'admin'];
  for (const modulo of modulosAdmin) {
    await prisma.permisoRol.upsert({
      where: { id: `perm-admin-${modulo}` },
      update: {},
      create: {
        id: `perm-admin-${modulo}`,
        rolId: rolAdmin.id,
        modulo,
        puede_ver: true,
        puede_crear: true,
        puede_editar: true,
        puede_eliminar: true,
      },
    });
  }

  // --- Usuario Admin ---
  const passwordHash = await hash('Admin1234!', 12);
  await prisma.user.upsert({
    where: { email: 'admin@cimadera.net' },
    update: { aprobado: true, rolId: rolAdmin.id },
    create: {
      nombre: 'Administrador CIMAdera',
      email: 'admin@cimadera.net',
      password: passwordHash,
      aprobado: true,
      rolId: rolAdmin.id,
    },
  });

  // --- Categorías de ítems ---
  const categorias = [
    { id: 'cat-bisagras', nombre: 'Bisagras' },
    { id: 'cat-cerraduras', nombre: 'Cerraduras' },
    { id: 'cat-chapas', nombre: 'Chapas' },
    { id: 'cat-marcos', nombre: 'Marcos' },
    { id: 'cat-hojas', nombre: 'Hojas de Puerta' },
    { id: 'cat-accesorios', nombre: 'Accesorios' },
  ];

  for (const cat of categorias) {
    await prisma.categoriaItem.upsert({
      where: { nombre: cat.nombre },
      update: {},
      create: { id: cat.id, nombre: cat.nombre },
    });
  }

  // --- Ítems de ejemplo (precios en pesos argentinos) ---
  const items = [
    // Bisagras
    { id: 'item-bisagra-1', nombre: 'Bisagra galvanizada 3"', descripcion: 'Bisagra reforzada para puertas de madera', categoriaId: 'cat-bisagras', costoBase: 850, indiceUtilidad: 1.4, unidad: 'unidad' },
    { id: 'item-bisagra-2', nombre: 'Bisagra reforzada 4"', descripcion: 'Para puertas industriales pesadas', categoriaId: 'cat-bisagras', costoBase: 1350, indiceUtilidad: 1.4, unidad: 'unidad' },
    { id: 'item-bisagra-3', nombre: 'Bisagra piano 600mm', descripcion: 'Bisagra continua de aluminio', categoriaId: 'cat-bisagras', costoBase: 3200, indiceUtilidad: 1.35, unidad: 'unidad' },
    // Cerraduras
    { id: 'item-cerradura-1', nombre: 'Cerradura doble paleta Yale', descripcion: 'Cerradura embutir doble paleta', categoriaId: 'cat-cerraduras', costoBase: 4500, indiceUtilidad: 1.45, unidad: 'unidad' },
    { id: 'item-cerradura-2', nombre: 'Cerradura magnética 60kg', descripcion: 'Electromagnética para puertas de vidrio', categoriaId: 'cat-cerraduras', costoBase: 8900, indiceUtilidad: 1.4, unidad: 'unidad' },
    { id: 'item-cerradura-3', nombre: 'Cerradura sobreponer', descripcion: 'Cerradura para puertas de madera', categoriaId: 'cat-cerraduras', costoBase: 2800, indiceUtilidad: 1.4, unidad: 'unidad' },
    // Chapas / Tiradores
    { id: 'item-chapa-1', nombre: 'Tirador en L acero inox 300mm', descripcion: 'Tirador cuadrado acero inoxidable', categoriaId: 'cat-chapas', costoBase: 1200, indiceUtilidad: 1.5, unidad: 'unidad' },
    { id: 'item-chapa-2', nombre: 'Chapa manija residencial', descripcion: 'Manija puerta residencial cromada', categoriaId: 'cat-chapas', costoBase: 1800, indiceUtilidad: 1.45, unidad: 'unidad' },
    { id: 'item-chapa-3', nombre: 'Tirador barra antipánico', descripcion: 'Barra antipánico galvanizada 900mm', categoriaId: 'cat-chapas', costoBase: 12500, indiceUtilidad: 1.35, unidad: 'unidad' },
    // Marcos (precio por ml)
    { id: 'item-marco-1', nombre: 'Marco pino machimbrado 70mm', descripcion: 'Marco de madera de pino cepillado', categoriaId: 'cat-marcos', costoBase: 2200, indiceUtilidad: 1.4, unidad: 'ml' },
    { id: 'item-marco-2', nombre: 'Marco MDF pintado 90mm', descripcion: 'Marco MDF con pintura base', categoriaId: 'cat-marcos', costoBase: 3100, indiceUtilidad: 1.38, unidad: 'ml' },
    { id: 'item-marco-3', nombre: 'Marco chapa doblada 60×40', descripcion: 'Marco metálico galvanizado', categoriaId: 'cat-marcos', costoBase: 1800, indiceUtilidad: 1.45, unidad: 'ml' },
    // Hojas de puerta (precio por m2)
    { id: 'item-hoja-1', nombre: 'Hoja placa MDF 36mm', descripcion: 'Puerta placa lisa MDF', categoriaId: 'cat-hojas', costoBase: 28000, indiceUtilidad: 1.35, unidad: 'm2' },
    { id: 'item-hoja-2', nombre: 'Hoja multilaminado pino', descripcion: 'Puerta multilaminado pino Paraná', categoriaId: 'cat-hojas', costoBase: 35000, indiceUtilidad: 1.35, unidad: 'm2' },
    { id: 'item-hoja-3', nombre: 'Hoja chapa doblada calibre 18', descripcion: 'Puerta metálica reforzada', categoriaId: 'cat-hojas', costoBase: 42000, indiceUtilidad: 1.4, unidad: 'm2' },
    // Accesorios
    { id: 'item-acc-1', nombre: 'Tope de puerta goma', descripcion: 'Tope de pared con roseta', categoriaId: 'cat-accesorios', costoBase: 320, indiceUtilidad: 1.6, unidad: 'unidad' },
    { id: 'item-acc-2', nombre: 'Mirilla ojo de pez 180°', descripcion: 'Mirilla gran angular acero', categoriaId: 'cat-accesorios', costoBase: 650, indiceUtilidad: 1.55, unidad: 'unidad' },
    { id: 'item-acc-3', nombre: 'Bulón zincado M8×80', descripcion: 'Juego de bulones para marco', categoriaId: 'cat-accesorios', costoBase: 280, indiceUtilidad: 1.5, unidad: 'juego' },
  ];

  for (const item of items) {
    await prisma.item.upsert({
      where: { id: item.id },
      update: {},
      create: {
        id: item.id,
        nombre: item.nombre,
        descripcion: item.descripcion,
        categoriaId: item.categoriaId,
        costoBase: item.costoBase,
        indiceUtilidad: item.indiceUtilidad,
        precioVenta: Math.round(item.costoBase * item.indiceUtilidad),
        unidad: item.unidad,
        activo: true,
      },
    });
  }

  // --- Tipos de puerta ---
  const tiposPuerta = [
    { id: 'tp-simple', nombre: 'Simple' },
    { id: 'tp-doble', nombre: 'Doble' },
    { id: 'tp-postigo', nombre: 'Con Postigo' },
  ];

  for (const tp of tiposPuerta) {
    await prisma.tipoPuerta.upsert({
      where: { id: tp.id },
      update: {},
      create: { id: tp.id, nombre: tp.nombre },
    });
  }

  // --- Índices por tipo de cliente ---
  const indicesCliente = [
    { id: 'indice-constructora', tipoCliente: 'CONSTRUCTORA' as const, indiceUtilidad: 1.20, descripcion: 'Constructoras (20% utilidad)' },
    { id: 'indice-desarrollador', tipoCliente: 'DESARROLLADOR' as const, indiceUtilidad: 1.25, descripcion: 'Pequeños desarrolladores (25% utilidad)' },
    { id: 'indice-particular', tipoCliente: 'PARTICULAR' as const, indiceUtilidad: 1.35, descripcion: 'Particulares (35% utilidad)' },
  ];

  for (const ic of indicesCliente) {
    await prisma.indiceCliente.upsert({
      where: { tipoCliente: ic.tipoCliente },
      update: { indiceUtilidad: ic.indiceUtilidad, descripcion: ic.descripcion },
      create: { id: ic.id, tipoCliente: ic.tipoCliente, indiceUtilidad: ic.indiceUtilidad, descripcion: ic.descripcion },
    });
  }

  // --- Cliente de ejemplo ---
  await prisma.cliente.upsert({
    where: { cuit: '30-71234567-0' },
    update: {},
    create: {
      razonSocial: 'Constructora El Ombú S.R.L.',
      cuit: '30-71234567-0',
      email: 'compras@elombu.com.ar',
      telefono: '011 4567-8901',
      direccion: 'Av. Rivadavia 4500',
      ciudad: 'Buenos Aires',
      provincia: 'CABA',
      tipoCliente: 'CONSTRUCTORA',
    },
  });

  console.log('Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
