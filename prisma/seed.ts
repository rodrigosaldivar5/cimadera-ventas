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
      where: { id: cat.id },
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

  // --- Descuentos por tipo de cliente ---
  const descuentosCliente = [
    { id: 'desc-constructora', tipoCliente: 'CONSTRUCTORA' as const, descuento: 15.00, descripcion: 'Constructoras (15% de descuento)' },
    { id: 'desc-desarrollador', tipoCliente: 'DESARROLLADOR' as const, descuento: 10.00, descripcion: 'Pequeños desarrolladores (10% de descuento)' },
    { id: 'desc-particular', tipoCliente: 'PARTICULAR' as const, descuento: 0.00, descripcion: 'Particulares (sin descuento automático)' },
  ];

  for (const dc of descuentosCliente) {
    await prisma.descuentoTipoCliente.upsert({
      where: { tipoCliente: dc.tipoCliente },
      update: { descuento: dc.descuento, descripcion: dc.descripcion },
      create: { id: dc.id, tipoCliente: dc.tipoCliente, descuento: dc.descuento, descripcion: dc.descripcion },
    });
  }

  // --- Categoría de productos y producto de ejemplo ---
  const catPuertas = await prisma.categoriaProducto.upsert({
    where: { nombre: 'Puertas' },
    update: {},
    create: { nombre: 'Puertas' },
  });

  const puertaStandard = await prisma.producto.upsert({
    where: { id: 'prod-puerta-interior-std' },
    update: {},
    create: {
      id: 'prod-puerta-interior-std',
      nombre: 'Puerta interior standard',
      descripcion: 'Puerta de madera para interiores con opciones configurables',
      categoriaId: catPuertas.id,
      activo: true,
    },
  });

  // Atributo: Bisagra
  const atribBisagra = await prisma.atributoProducto.upsert({
    where: { id: 'atrib-bisagra-puerta-std' },
    update: {},
    create: { id: 'atrib-bisagra-puerta-std', productoId: puertaStandard.id, nombre: 'Bisagra', requerido: true },
  });
  const bisagraOpciones = [
    { id: 'op-bisagra-galv-3', nombre: 'Galvanizada 3"', costoBase: 850, indiceUtilidad: 1.4 },
    { id: 'op-bisagra-refz-4', nombre: 'Reforzada 4"', costoBase: 1350, indiceUtilidad: 1.4 },
    { id: 'op-bisagra-piano', nombre: 'Piano 600mm', costoBase: 3200, indiceUtilidad: 1.35 },
    { id: 'op-bisagra-inox', nombre: 'Inoxidable 3"', costoBase: 1100, indiceUtilidad: 1.45 },
  ];
  for (const op of bisagraOpciones) {
    await prisma.opcionAtributo.upsert({
      where: { id: op.id },
      update: {},
      create: { id: op.id, atributoId: atribBisagra.id, nombre: op.nombre, costoBase: op.costoBase, indiceUtilidad: op.indiceUtilidad, precioVenta: Math.round(op.costoBase * op.indiceUtilidad), unidad: 'unidad', activo: true },
    });
  }

  // Atributo: Cerradura
  const atribCerradura = await prisma.atributoProducto.upsert({
    where: { id: 'atrib-cerradura-puerta-std' },
    update: {},
    create: { id: 'atrib-cerradura-puerta-std', productoId: puertaStandard.id, nombre: 'Cerradura', requerido: true },
  });
  const cerraduraOpciones = [
    { id: 'op-cerr-doble-paleta', nombre: 'Doble paleta Yale', costoBase: 4500, indiceUtilidad: 1.45 },
    { id: 'op-cerr-magnetica', nombre: 'Magnética 60kg', costoBase: 8900, indiceUtilidad: 1.4 },
    { id: 'op-cerr-sobreponer', nombre: 'Sobreponer', costoBase: 2800, indiceUtilidad: 1.4 },
    { id: 'op-cerr-embutir', nombre: 'Embutir triple acción', costoBase: 6200, indiceUtilidad: 1.4 },
  ];
  for (const op of cerraduraOpciones) {
    await prisma.opcionAtributo.upsert({
      where: { id: op.id },
      update: {},
      create: { id: op.id, atributoId: atribCerradura.id, nombre: op.nombre, costoBase: op.costoBase, indiceUtilidad: op.indiceUtilidad, precioVenta: Math.round(op.costoBase * op.indiceUtilidad), unidad: 'unidad', activo: true },
    });
  }

  // Atributo: Acabado
  const atribAcabado = await prisma.atributoProducto.upsert({
    where: { id: 'atrib-acabado-puerta-std' },
    update: {},
    create: { id: 'atrib-acabado-puerta-std', productoId: puertaStandard.id, nombre: 'Acabado', requerido: true },
  });
  const acabadoOpciones = [
    { id: 'op-acab-natural', nombre: 'Natural barniz', costoBase: 1500, indiceUtilidad: 1.4 },
    { id: 'op-acab-blanco', nombre: 'Pintado blanco', costoBase: 1800, indiceUtilidad: 1.4 },
    { id: 'op-acab-melanina', nombre: 'Melanina wengué', costoBase: 2400, indiceUtilidad: 1.35 },
    { id: 'op-acab-laqueado', nombre: 'Laqueado brillante', costoBase: 3500, indiceUtilidad: 1.35 },
  ];
  for (const op of acabadoOpciones) {
    await prisma.opcionAtributo.upsert({
      where: { id: op.id },
      update: {},
      create: { id: op.id, atributoId: atribAcabado.id, nombre: op.nombre, costoBase: op.costoBase, indiceUtilidad: op.indiceUtilidad, precioVenta: Math.round(op.costoBase * op.indiceUtilidad), unidad: 'm2', activo: true },
    });
  }

  // Atributo: Marco
  const atribMarco = await prisma.atributoProducto.upsert({
    where: { id: 'atrib-marco-puerta-std' },
    update: {},
    create: { id: 'atrib-marco-puerta-std', productoId: puertaStandard.id, nombre: 'Marco', requerido: true },
  });
  const marcoOpciones = [
    { id: 'op-marco-pino-70', nombre: 'Pino 70mm', costoBase: 2200, indiceUtilidad: 1.4 },
    { id: 'op-marco-mdf-90', nombre: 'MDF 90mm', costoBase: 3100, indiceUtilidad: 1.38 },
    { id: 'op-marco-chapa-60', nombre: 'Chapa 60×40mm', costoBase: 1800, indiceUtilidad: 1.45 },
    { id: 'op-marco-aluminio', nombre: 'Aluminio extruido', costoBase: 4500, indiceUtilidad: 1.35 },
  ];
  for (const op of marcoOpciones) {
    await prisma.opcionAtributo.upsert({
      where: { id: op.id },
      update: {},
      create: { id: op.id, atributoId: atribMarco.id, nombre: op.nombre, costoBase: op.costoBase, indiceUtilidad: op.indiceUtilidad, precioVenta: Math.round(op.costoBase * op.indiceUtilidad), unidad: 'ml', activo: true },
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

  // --- IndiceGlobal inicial ---
  const existeIndice = await prisma.indiceGlobal.findFirst({ orderBy: { fecha: 'desc' } });
  if (!existeIndice) {
    await prisma.indiceGlobal.create({
      data: { nombre: 'CAC MO', valor: 17009.6000 },
    });
  }

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
