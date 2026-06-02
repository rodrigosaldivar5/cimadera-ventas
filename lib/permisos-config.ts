export const PERMISOS_CONFIG = {
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
} as const;

export type ModuloPermiso = keyof typeof PERMISOS_CONFIG;
