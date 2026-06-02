import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PERMISOS_CONFIG = {
  presupuestos: {
    acciones: ['ver_lista','ver_detalle','crear','editar','cambiar_estado','cambiar_prioridad','eliminar','exportar_pdf','adjuntar_archivos'],
    columnas: ['numero','nombre','cliente','obra','responsable','prioridad','estado','recepcion','total','precio_final'],
  },
  clientes: {
    acciones: ['ver_lista','ver_detalle','crear','editar'],
    columnas: [],
  },
  cuentas_corrientes: {
    acciones: ['ver','registrar_pago','exportar_pdf'],
    columnas: [],
  },
};

const ADMIN_ACCIONES = {
  presupuestos: PERMISOS_CONFIG.presupuestos.acciones,
  clientes: PERMISOS_CONFIG.clientes.acciones,
  cuentas_corrientes: PERMISOS_CONFIG.cuentas_corrientes.acciones,
};

const VENDEDOR_ACCIONES = {
  presupuestos: ['ver_lista','ver_detalle','crear','editar','cambiar_estado','exportar_pdf','adjuntar_archivos'],
  clientes: ['ver_lista','ver_detalle','crear','editar'],
  cuentas_corrientes: ['ver','registrar_pago','exportar_pdf'],
};

const VENDEDOR_COLUMNAS = {
  presupuestos: ['numero','nombre','cliente','obra','responsable','estado','recepcion'],
};

const roles = await prisma.rol.findMany({ select: { id: true, nombre: true } });
console.log('Roles encontrados:', roles.map(r => r.nombre));

for (const rol of roles) {
  const isAdmin = rol.nombre.toLowerCase().includes('administrador') || rol.nombre.toLowerCase().includes('admin');
  const isVendedor = rol.nombre.toLowerCase().includes('vendedor');

  if (!isAdmin && !isVendedor) {
    console.log(`Saltando: ${rol.nombre}`);
    continue;
  }

  const accionesPorModulo = isAdmin ? ADMIN_ACCIONES : VENDEDOR_ACCIONES;

  for (const [modulo, config] of Object.entries(PERMISOS_CONFIG)) {
    for (const accion of config.acciones) {
      const permitido = (accionesPorModulo[modulo] ?? []).includes(accion);
      await prisma.permisoRol.upsert({
        where: { rolId_modulo_accion: { rolId: rol.id, modulo, accion } },
        update: { permitido },
        create: { rolId: rol.id, modulo, accion, permitido },
      });
    }
    if (config.columnas.length > 0) {
      const colsVisibles = isAdmin ? config.columnas : (VENDEDOR_COLUMNAS[modulo] ?? config.columnas);
      for (const col of config.columnas) {
        const visible = colsVisibles.includes(col);
        await prisma.visibilidadColumna.upsert({
          where: { rolId_modulo_columna: { rolId: rol.id, modulo, columna: col } },
          update: { visible },
          create: { rolId: rol.id, modulo, columna: col, visible },
        });
      }
    }
  }
  console.log(`✓ ${rol.nombre} (${isAdmin ? 'Administrador' : 'Vendedor'})`);
}

console.log('Seed completado.');
await prisma.$disconnect();
