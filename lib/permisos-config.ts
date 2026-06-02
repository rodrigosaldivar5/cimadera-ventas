export const PERMISOS_CONFIG = {
  dashboard: {
    label: 'Dashboard',
    acciones: [
      { key: 'ver', label: 'Ver dashboard' },
    ],
    columnas: [] as { key: string; label: string }[],
  },
  presupuestos: {
    label: 'Presupuestos',
    acciones: [
      { key: 'ver_lista', label: 'Ver lista de presupuestos' },
      { key: 'ver_detalle', label: 'Ver detalle de presupuesto' },
      { key: 'crear', label: 'Crear presupuesto' },
      { key: 'editar', label: 'Editar presupuesto' },
      { key: 'cambiar_estado', label: 'Cambiar estado' },
      { key: 'cambiar_prioridad', label: 'Cambiar prioridad' },
      { key: 'eliminar', label: 'Eliminar presupuesto' },
      { key: 'exportar_pdf', label: 'Exportar PDF' },
      { key: 'adjuntar_archivos', label: 'Adjuntar archivos' },
    ],
    columnas: [
      { key: 'numero', label: 'Nro' },
      { key: 'nombre', label: 'Nombre' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'obra', label: 'Obra' },
      { key: 'responsable', label: 'Responsable' },
      { key: 'prioridad', label: 'Prioridad' },
      { key: 'estado', label: 'Estado' },
      { key: 'recepcion', label: 'Recepción' },
      { key: 'total', label: 'Total' },
      { key: 'precio_final', label: 'P. Final' },
    ],
  },
  clientes: {
    label: 'Clientes',
    acciones: [
      { key: 'ver_lista', label: 'Ver lista' },
      { key: 'ver_detalle', label: 'Ver detalle' },
      { key: 'crear', label: 'Crear cliente' },
      { key: 'editar', label: 'Editar cliente' },
    ],
    columnas: [] as { key: string; label: string }[],
  },
  cuentas_corrientes: {
    label: 'Cuentas Corrientes',
    acciones: [
      { key: 'ver', label: 'Ver cuentas corrientes' },
      { key: 'registrar_pago', label: 'Registrar pago' },
      { key: 'exportar_pdf', label: 'Exportar PDF' },
    ],
    columnas: [] as { key: string; label: string }[],
  },
  productos: {
    label: 'Productos',
    acciones: [
      { key: 'ver', label: 'Ver productos' },
      { key: 'crear', label: 'Crear producto' },
      { key: 'editar', label: 'Editar producto' },
      { key: 'eliminar', label: 'Eliminar producto' },
    ],
    columnas: [] as { key: string; label: string }[],
  },
  materiales: {
    label: 'Materiales',
    acciones: [
      { key: 'ver', label: 'Ver materiales' },
      { key: 'crear', label: 'Crear material' },
      { key: 'editar', label: 'Editar material' },
      { key: 'eliminar', label: 'Eliminar material' },
    ],
    columnas: [] as { key: string; label: string }[],
  },
  catalogo: {
    label: 'Catálogo',
    acciones: [
      { key: 'ver', label: 'Ver catálogo' },
      { key: 'crear', label: 'Crear ítem' },
      { key: 'editar', label: 'Editar ítem' },
      { key: 'eliminar', label: 'Eliminar ítem' },
    ],
    columnas: [] as { key: string; label: string }[],
  },
  tesoreria: {
    label: 'Tesorería',
    acciones: [
      { key: 'ver', label: 'Ver tesorería' },
      { key: 'ver_costos', label: 'Ver costos fijos' },
      { key: 'editar_costos', label: 'Editar costos fijos' },
      { key: 'ver_saldo', label: 'Ver registro de saldo' },
      { key: 'editar_saldo', label: 'Editar registro de saldo' },
      { key: 'ver_cashflow', label: 'Ver cashflow' },
    ],
    columnas: [] as { key: string; label: string }[],
  },
  admin: {
    label: 'Administración',
    acciones: [
      { key: 'ver_usuarios', label: 'Ver usuarios' },
      { key: 'crear_usuario', label: 'Crear usuario' },
      { key: 'editar_usuario', label: 'Editar usuario' },
      { key: 'ver_roles', label: 'Ver roles y permisos' },
      { key: 'editar_roles', label: 'Editar roles y permisos' },
    ],
    columnas: [] as { key: string; label: string }[],
  },
} as const;

export type ModuloPermiso = keyof typeof PERMISOS_CONFIG;
