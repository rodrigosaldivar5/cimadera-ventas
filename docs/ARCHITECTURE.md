# CIMAdera Ventas — Arquitectura

## Stack

- **Frontend / Backend**: Next.js 14 App Router (React Server Components + Client Components)
- **DB**: PostgreSQL (Neon serverless) vía Prisma v7 con adapter PrismaPg
- **Auth**: NextAuth v5 (JWT strategy)
- **Validación**: Zod v4
- **UI**: shadcn/ui + Tailwind CSS
- **Deploy**: Vercel

## Estructura de módulos

```
app/
  (dashboard)/        # rutas protegidas con layout de sidebar
    dashboard/
    presupuestos/
    clientes/
    cuentas-corrientes/
    tesoreria/
    productos/
    materiales/
    catalogo/
    admin/
  api/                # Route Handlers (Next.js API)
    presupuestos/
    clientes/
    cuentas-corrientes/
    tesoreria/
    admin/
    external/v1/      # API read-only para integraciones externas
lib/
  auth.ts             # NextAuth config
  prisma.ts           # Prisma client singleton
  permisos-config.ts  # Definición de módulos y acciones del sistema
  check-permiso.ts    # Helper server-side para proteger rutas
  events/
    event-emitter.ts  # Emite eventos de dominio a targets externos
    event-delivery.ts # Entrega HTTP con reintentos
components/
  layout/sidebar.tsx  # Sidebar dinámico con control de permisos
```

## Sistema de permisos

Granular por módulo + acción. Almacenado en `PermisoRol {rolId, modulo, accion, permitido}`. Sin rol = superadmin (todos los permisos true).

Control doble:
1. **Sidebar** (`ROUTE_PERMISO`): oculta ítems de navegación
2. **Server-side** (`requirePermiso`): redirige si se accede directo por URL

## Sistema de eventos

Eventos de dominio emitidos asincrónicamente al cambiar estado de entidades críticas. Ver [EVENTS.md](./EVENTS.md).

Modelo de datos:
- `EventLog`: registro del evento con payload completo y hash SHA-256
- `EventDestination`: estado de entrega por target
- `DecisionLog`: registro de decisiones comerciales aprobadas

## Schema — campos FASE 1

### `DivisionProductiva` (enum)
`MADERA | MELAMINA | ALUMINIO | MIXTO`
Presente en `Presupuesto.division` y `LineaPresupuesto.division`.

### `Obra.codigoObra`
Código único opcional de obra.

### Campos de forecast en `Presupuesto`
- `fechaPrometidaCliente` / `fechaObjetivoProduccion`: fechas separadas para diferenciación futura
- `anticipoEsperado` / `saldoEsperado`: forecast de cobro
- `probabilidadCobro`: 0–100%
- `motivoRechazo`: texto libre al rechazar

Ver [SCHEMA_CHANGES.md](./SCHEMA_CHANGES.md) para detalle completo.

## Tesorería

Acceso restringido por whitelist de emails (`TESORERIA_EMAILS`). No usa el sistema de permisos granular (pending migration).

## Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión Neon (pooler) |
| `DATABASE_URL_UNPOOLED` | Conexión directa para migraciones |
| `NEXTAUTH_SECRET` | JWT signing |
| `EXTERNAL_API_KEY` | Auth de API externa y webhooks de eventos |
| `EVENT_TARGET_CRM_URL` | Webhook CRM (opcional) |
| `EVENT_TARGET_PRODUCCION_URL` | Webhook producción (opcional) |
