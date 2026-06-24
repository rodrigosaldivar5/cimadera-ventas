System.Management.Automation.RemoteException
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EstadoPresupuesto" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'FINALIZADO', 'PARA_ENVIAR', 'ENVIADO', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('CONSTRUCTORA', 'DESARROLLADOR', 'PARTICULAR');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('CARGO_INICIAL', 'ANTICIPO', 'PAGO_PARCIAL', 'ACTUALIZACION');

-- CreateEnum
CREATE TYPE "EstadoCuenta" AS ENUM ('PENDIENTE', 'SALDO_PENDIENTE', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoCaja" AS ENUM ('ARS', 'USD');

-- CreateEnum
CREATE TYPE "TipoMovimientoTesoreria" AS ENUM ('INGRESO', 'EGRESO', 'TRASPASO_ENTRADA', 'TRASPASO_SALIDA', 'CANJE_REALIZADO');

-- CreateEnum
CREATE TYPE "EstadoCanje" AS ENUM ('NO_LIQUIDO', 'REALIZADO');

-- CreateEnum
CREATE TYPE "TipoActivo" AS ENUM ('DEPARTAMENTO', 'TERRENO', 'OTRO');

-- CreateEnum
CREATE TYPE "DivisionProductiva" AS ENUM ('MADERA', 'MELAMINA', 'ALUMINIO', 'MIXTO');

-- CreateTable
CREATE TABLE "Division" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rol" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "aprobado" BOOLEAN NOT NULL DEFAULT false,
    "rolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermisoRol" (
    "id" TEXT NOT NULL,
    "rolId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "permitido" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PermisoRol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisibilidadColumna" (
    "id" TEXT NOT NULL,
    "rolId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "columna" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "VisibilidadColumna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "cuit" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "ciudad" TEXT,
    "provincia" TEXT,
    "tipoCliente" "TipoCliente" NOT NULL DEFAULT 'PARTICULAR',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaItem" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "CategoriaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoriaId" TEXT NOT NULL,
    "costoBase" DECIMAL(10,2) NOT NULL,
    "indiceUtilidad" DECIMAL(5,2) NOT NULL DEFAULT 1.30,
    "precioVenta" DECIMAL(10,2) NOT NULL,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presupuesto" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombrePresupuesto" TEXT,
    "clienteId" TEXT NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "responsableId" TEXT,
    "estado" "EstadoPresupuesto" NOT NULL DEFAULT 'PENDIENTE',
    "prioridad" "Prioridad" NOT NULL DEFAULT 'MEDIA',
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaRecepcion" TIMESTAMP(3),
    "fechaEnvio" TIMESTAMP(3),
    "fechaVencimiento" TIMESTAMP(3),
    "observaciones" TEXT,
    "descuento" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalFinal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tasaIva" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "montoIva" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalConIva" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "preciosNetos" BOOLEAN NOT NULL DEFAULT true,
    "precioFinal" DECIMAL(10,2),
    "obraId" TEXT,
    "division" "DivisionProductiva",
    "fechaPrometidaCliente" TIMESTAMP(3),
    "fechaObjetivoProduccion" TIMESTAMP(3),
    "anticipoEsperado" DECIMAL(14,2),
    "saldoEsperado" DECIMAL(14,2),
    "probabilidadCobro" DECIMAL(5,2),
    "motivoRechazo" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',

    CONSTRAINT "Presupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigoObra" TEXT,
    "direccion" TEXT,
    "descripcion" TEXT,
    "clienteId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Obra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivoPresupuesto" (
    "id" TEXT NOT NULL,
    "presupuestoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamanio" INTEGER NOT NULL,
    "contenido" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchivoPresupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineaPresupuesto" (
    "id" TEXT NOT NULL,
    "presupuestoId" TEXT NOT NULL,
    "itemId" TEXT,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "productoId" TEXT,
    "productoNombre" TEXT,
    "division" "DivisionProductiva",

    CONSTRAINT "LineaPresupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoPuerta" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "TipoPuerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuertaPresupuesto" (
    "id" TEXT NOT NULL,
    "presupuestoId" TEXT NOT NULL,
    "tipoPuertaId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "ancho" DECIMAL(6,2) NOT NULL,
    "alto" DECIMAL(6,2) NOT NULL,
    "bisagraId" TEXT,
    "cerraduraId" TEXT,
    "chapaId" TEXT,
    "marcoId" TEXT,
    "hojaId" TEXT,
    "colorMarca" TEXT,
    "observaciones" TEXT,
    "precioUnitario" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "PuertaPresupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaProducto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "CategoriaProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoriaId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtributoProducto" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "requerido" BOOLEAN NOT NULL DEFAULT true,
    "itemId" TEXT,

    CONSTRAINT "AtributoProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpcionAtributo" (
    "id" TEXT NOT NULL,
    "atributoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "costoBase" DECIMAL(10,2) NOT NULL,
    "indiceUtilidad" DECIMAL(5,2) NOT NULL DEFAULT 1.30,
    "precioVenta" DECIMAL(10,2) NOT NULL,
    "unidad" TEXT NOT NULL DEFAULT 'unidad',
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OpcionAtributo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpcionLineaPresupuesto" (
    "id" TEXT NOT NULL,
    "lineaId" TEXT NOT NULL,
    "atributoNombre" TEXT NOT NULL,
    "opcionNombre" TEXT NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "productoId" TEXT,

    CONSTRAINT "OpcionLineaPresupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DescuentoTipoCliente" (
    "id" TEXT NOT NULL,
    "tipoCliente" "TipoCliente" NOT NULL,
    "descuento" DECIMAL(5,2) NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "DescuentoTipoCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogoPuerta" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "imageUrl" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'Interior',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogoPuerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriterioCliente" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CriterioCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuentaCorriente" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "obraId" TEXT,
    "presupuestoId" TEXT,
    "montoOriginal" DECIMAL(12,2) NOT NULL,
    "indiceInicio" DECIMAL(10,4) NOT NULL,
    "indiceActual" DECIMAL(10,4) NOT NULL,
    "nombreIndice" TEXT NOT NULL DEFAULT 'ICC',
    "saldoActualizado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" "EstadoCuenta" NOT NULL DEFAULT 'SALDO_PENDIENTE',
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "proximoCobro" TIMESTAMP(3),
    "probabilidadCobro" TEXT NOT NULL DEFAULT 'MEDIA',
    "fechaEstimadaCobro" TIMESTAMP(3),
    "montoEstimadoCobro" DECIMAL(14,2),
    "notasCobro" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuentaCorriente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostoFijo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "categoriaId" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "monto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observacion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostoFijo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroCostoFijo" (
    "id" TEXT NOT NULL,
    "costoFijoId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "montoEstimado" DECIMAL(14,2),
    "montoReal" DECIMAL(14,2),
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistroCostoFijo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaCostoFijo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "CategoriaCostoFijo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotCostosFijos" (
    "id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "datos" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SnapshotCostosFijos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaldoCaja" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "saldo" DOUBLE PRECISION NOT NULL,
    "nota" TEXT,
    "creadoPor" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaldoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoCuenta" (
    "id" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "saldoResultante" DECIMAL(12,2) NOT NULL,
    "numeroFactura" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indiceValor" DECIMAL(10,4),
    "caja" TEXT,
    "tipoCambio" DECIMAL(12,4),
    "montoEnARS" DECIMAL(14,2),
    "equivalenteUSD" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoCambio" (
    "id" TEXT NOT NULL,
    "valor" DECIMAL(12,4) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT,

    CONSTRAINT "TipoCambio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoTesoreria" (
    "id" TEXT NOT NULL,
    "caja" "TipoCaja" NOT NULL,
    "tipo" "TipoMovimientoTesoreria" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "saldoResultante" DECIMAL(14,2) NOT NULL,
    "tipoCambioId" TEXT,
    "traspasoId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoTesoreria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Traspaso" (
    "id" TEXT NOT NULL,
    "cajaOrigen" "TipoCaja" NOT NULL,
    "cajaDestino" "TipoCaja" NOT NULL,
    "montoOrigen" DECIMAL(14,2) NOT NULL,
    "montoDestino" DECIMAL(14,2) NOT NULL,
    "tipoCambioUsado" DECIMAL(12,4) NOT NULL,
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Traspaso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivoCanje" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoActivo" NOT NULL,
    "descripcion" TEXT,
    "fechaRecepcion" TIMESTAMP(3) NOT NULL,
    "valorEntrada" DECIMAL(14,2) NOT NULL,
    "valorEstimado" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoCanje" NOT NULL DEFAULT 'NO_LIQUIDO',
    "fechaRealizacion" TIMESTAMP(3),
    "valorVenta" DECIMAL(14,2),
    "gananciaUSD" DECIMAL(14,2),
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivoCanje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndiceGlobal" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL DEFAULT 'ICC',
    "valor" DECIMAL(10,4) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPor" TEXT,

    CONSTRAINT "IndiceGlobal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditoriaPresupuesto" (
    "id" TEXT NOT NULL,
    "presupuestoId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "accion" TEXT NOT NULL,
    "camposModificados" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditoriaPresupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "correlationId" TEXT,
    "causationId" TEXT,
    "hash" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventDestination" (
    "id" TEXT NOT NULL,
    "eventLogId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'general',
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "linkUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificacionPreferencia" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificacionPreferencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudRestablecimiento" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "aprobadoPorId" TEXT,
    "nuevaPassword" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SolicitudRestablecimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionLog" (
    "id" TEXT NOT NULL,
    "tipoDecision" TEXT NOT NULL,
    "entidadTipo" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "aprobadoPorId" TEXT NOT NULL,
    "aprobadoPorRol" TEXT NOT NULL,
    "requirioDirector" BOOLEAN NOT NULL DEFAULT false,
    "motivoEscalamiento" TEXT,
    "monto" DECIMAL(14,2),
    "montoAnterior" DECIMAL(14,2),
    "montoNuevo" DECIMAL(14,2),
    "contextoExtra" JSONB,
    "fechaSolicitud" TIMESTAMP(3) NOT NULL,
    "fechaResolucion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tiempoResolucionH" DECIMAL(8,2),
    "eventLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Division_nombre_key" ON "Division"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PermisoRol_rolId_modulo_accion_key" ON "PermisoRol"("rolId", "modulo", "accion");

-- CreateIndex
CREATE UNIQUE INDEX "VisibilidadColumna_rolId_modulo_columna_key" ON "VisibilidadColumna"("rolId", "modulo", "columna");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_cuit_key" ON "Cliente"("cuit");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaItem_nombre_key" ON "CategoriaItem"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Presupuesto_numero_key" ON "Presupuesto"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Obra_codigoObra_key" ON "Obra"("codigoObra");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaProducto_nombre_key" ON "CategoriaProducto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "DescuentoTipoCliente_tipoCliente_key" ON "DescuentoTipoCliente"("tipoCliente");

-- CreateIndex
CREATE UNIQUE INDEX "CuentaCorriente_presupuestoId_key" ON "CuentaCorriente"("presupuestoId");

-- CreateIndex
CREATE INDEX "RegistroCostoFijo_mes_anio_idx" ON "RegistroCostoFijo"("mes", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroCostoFijo_costoFijoId_mes_anio_key" ON "RegistroCostoFijo"("costoFijoId", "mes", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaCostoFijo_nombre_key" ON "CategoriaCostoFijo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "SnapshotCostosFijos_mes_anio_key" ON "SnapshotCostosFijos"("mes", "anio");

-- CreateIndex
CREATE INDEX "AuditoriaPresupuesto_presupuestoId_idx" ON "AuditoriaPresupuesto"("presupuestoId");

-- CreateIndex
CREATE UNIQUE INDEX "EventLog_eventId_key" ON "EventLog"("eventId");

-- CreateIndex
CREATE INDEX "EventLog_entityId_idx" ON "EventLog"("entityId");

-- CreateIndex
CREATE INDEX "EventLog_eventType_idx" ON "EventLog"("eventType");

-- CreateIndex
CREATE INDEX "EventLog_correlationId_idx" ON "EventLog"("correlationId");

-- CreateIndex
CREATE INDEX "EventDestination_eventLogId_idx" ON "EventDestination"("eventLogId");

-- CreateIndex
CREATE INDEX "EventDestination_status_idx" ON "EventDestination"("status");

-- CreateIndex
CREATE INDEX "Notificacion_userId_idx" ON "Notificacion"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "NotificacionPreferencia_userId_idx" ON "NotificacionPreferencia"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificacionPreferencia_userId_tipo_key" ON "NotificacionPreferencia"("userId", "tipo");

-- CreateIndex
CREATE INDEX "SolicitudRestablecimiento_userId_idx" ON "SolicitudRestablecimiento"("userId");

-- CreateIndex
CREATE INDEX "SolicitudRestablecimiento_estado_idx" ON "SolicitudRestablecimiento"("estado");

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rol" ADD CONSTRAINT "Rol_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermisoRol" ADD CONSTRAINT "PermisoRol_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisibilidadColumna" ADD CONSTRAINT "VisibilidadColumna_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presupuesto" ADD CONSTRAINT "Presupuesto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presupuesto" ADD CONSTRAINT "Presupuesto_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presupuesto" ADD CONSTRAINT "Presupuesto_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presupuesto" ADD CONSTRAINT "Presupuesto_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchivoPresupuesto" ADD CONSTRAINT "ArchivoPresupuesto_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "Presupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaPresupuesto" ADD CONSTRAINT "LineaPresupuesto_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "Presupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaPresupuesto" ADD CONSTRAINT "LineaPresupuesto_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuertaPresupuesto" ADD CONSTRAINT "PuertaPresupuesto_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "Presupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuertaPresupuesto" ADD CONSTRAINT "PuertaPresupuesto_tipoPuertaId_fkey" FOREIGN KEY ("tipoPuertaId") REFERENCES "TipoPuerta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Producto" ADD CONSTRAINT "Producto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaProducto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtributoProducto" ADD CONSTRAINT "AtributoProducto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtributoProducto" ADD CONSTRAINT "AtributoProducto_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpcionAtributo" ADD CONSTRAINT "OpcionAtributo_atributoId_fkey" FOREIGN KEY ("atributoId") REFERENCES "AtributoProducto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpcionLineaPresupuesto" ADD CONSTRAINT "OpcionLineaPresupuesto_lineaId_fkey" FOREIGN KEY ("lineaId") REFERENCES "LineaPresupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpcionLineaPresupuesto" ADD CONSTRAINT "OpcionLineaPresupuesto_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterioCliente" ADD CONSTRAINT "CriterioCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaCorriente" ADD CONSTRAINT "CuentaCorriente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaCorriente" ADD CONSTRAINT "CuentaCorriente_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuentaCorriente" ADD CONSTRAINT "CuentaCorriente_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "Presupuesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostoFijo" ADD CONSTRAINT "CostoFijo_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaCostoFijo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroCostoFijo" ADD CONSTRAINT "RegistroCostoFijo_costoFijoId_fkey" FOREIGN KEY ("costoFijoId") REFERENCES "CostoFijo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCuenta" ADD CONSTRAINT "MovimientoCuenta_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "CuentaCorriente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoTesoreria" ADD CONSTRAINT "MovimientoTesoreria_tipoCambioId_fkey" FOREIGN KEY ("tipoCambioId") REFERENCES "TipoCambio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoTesoreria" ADD CONSTRAINT "MovimientoTesoreria_traspasoId_fkey" FOREIGN KEY ("traspasoId") REFERENCES "Traspaso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditoriaPresupuesto" ADD CONSTRAINT "AuditoriaPresupuesto_presupuestoId_fkey" FOREIGN KEY ("presupuestoId") REFERENCES "Presupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditoriaPresupuesto" ADD CONSTRAINT "AuditoriaPresupuesto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDestination" ADD CONSTRAINT "EventDestination_eventLogId_fkey" FOREIGN KEY ("eventLogId") REFERENCES "EventLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacionPreferencia" ADD CONSTRAINT "NotificacionPreferencia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudRestablecimiento" ADD CONSTRAINT "SolicitudRestablecimiento_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudRestablecimiento" ADD CONSTRAINT "SolicitudRestablecimiento_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLog" ADD CONSTRAINT "DecisionLog_aprobadoPorId_fkey" FOREIGN KEY ("aprobadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
