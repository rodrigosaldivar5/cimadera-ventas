# CIMAdera Ventas — External API v1

API read-only para integración con CRM y servicios externos.

## Autenticación

Todos los endpoints requieren el header:

```
Authorization: Bearer <EXTERNAL_API_KEY>
```

La key se configura en `.env.local` (desarrollo) y en Vercel → Environment Variables (producción) como `EXTERNAL_API_KEY`.

## Base URL

| Entorno | URL |
|---|---|
| Desarrollo | `http://localhost:3002/api/external/v1` |
| Producción | `https://ventas.cimadera.net/api/external/v1` |

## CORS

Orígenes permitidos: `http://localhost:3000`, `http://localhost:3001`, `https://crm.cimadera.net`.  
Todos los endpoints responden a `OPTIONS` para preflight.

---

## Endpoints

### Tesorería

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/tesoreria/resumen` | Saldos actuales, tipo de cambio, canjes, últimos 20 movimientos |
| GET | `/tesoreria/movimientos` | Paginado. Params: `caja` (ARS\|USD\|all), `desde`, `hasta`, `tipo`, `limit`, `offset` |
| GET | `/tesoreria/canjes` | Todos los activos en canje |
| GET | `/tesoreria/traspasos` | Todos los traspasos ordenados por fecha DESC |
| GET | `/tesoreria/tipo-cambio/historico` | Historial de tipo de cambio |

### Costos Fijos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/costos-fijos?anio=2026` | Costos activos con registros estimado/real. Param opcional: `mes` |
| GET | `/costos-fijos/historico?anio=2026` | Registros del año agrupados por mes. Params opcionales: `categoriaId`, `costoId` |

### Cuentas Corrientes

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/cuentas-corrientes` | Todas las cuentas con cliente, obra, presupuesto, último movimiento |
| GET | `/cuentas-corrientes/:id` | Cuenta completa con todos sus movimientos |
| GET | `/cuentas-corrientes/resumen` | Totales facturado/cobrado/pendiente + antigüedad de saldos |
| GET | `/indices/actual` | Índice ICC actual e histórico |

### Presupuestos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/presupuestos` | Paginado. Params: `desde`, `hasta`, `estado`, `clienteId`, `responsableId`, `limit`, `offset` |
| GET | `/presupuestos/:id` | Presupuesto completo con líneas, opciones y metadata de archivos |
| GET | `/presupuestos/resumen-fiscal?anio=2026` | Neto e IVA agrupado por tasa. Param opcional: `mes` |

### Clientes

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/clientes` | Todos los clientes activos con conteo de presupuestos y obras |
| GET | `/clientes/:id` | Cliente completo con obras, presupuestos y cuentas corrientes |
| GET | `/clientes/ranking` | Params: `metrica` (facturado\|cobrado\|obras\|presupuestos), `periodo` (mes_actual\|anio_actual\|ultimos_12m), `limit` |
| GET | `/clientes/inactivos` | Clientes sin actividad. Param: `diasMinimos` (default: 90) |

### Usuarios / Vendedores

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/usuarios/activos` | Usuarios aprobados con rol, área y división |
| GET | `/usuarios/performance` | Métricas de conversión por vendedor. Params: `desde`, `hasta`, `usuarioId` |

### Pipeline

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/pipeline` | Conteo y monto por estado para presupuestos activos |

---

## Ejemplos

```bash
# Resumen de tesorería
curl -H "Authorization: Bearer <KEY>" \
  https://ventas.cimadera.net/api/external/v1/tesoreria/resumen

# Pipeline actual
curl -H "Authorization: Bearer <KEY>" \
  https://ventas.cimadera.net/api/external/v1/pipeline

# Presupuestos aprobados en mayo 2026
curl -H "Authorization: Bearer <KEY>" \
  "https://ventas.cimadera.net/api/external/v1/presupuestos?estado=APROBADO&desde=2026-05-01&hasta=2026-05-31"

# Ranking de clientes por facturación del año
curl -H "Authorization: Bearer <KEY>" \
  "https://ventas.cimadera.net/api/external/v1/clientes/ranking?metrica=facturado&periodo=anio_actual&limit=5"

# Clientes sin actividad en 60+ días
curl -H "Authorization: Bearer <KEY>" \
  "https://ventas.cimadera.net/api/external/v1/clientes/inactivos?diasMinimos=60"
```

---

## Versionado

La versión actual es **v1** (`/api/external/v1/`).  
Cambios breaking introducen una nueva versión (`/api/external/v2/`). La v1 se mantiene hasta migración completa.

## Rate limiting

Sin rate limit implementado en v1. Si el CRM genera carga excesiva, implementar middleware de throttling por IP o por key.

## Seguridad

- Todos los endpoints son **read-only** (GET + OPTIONS únicamente).
- La API key debe tener al menos 32 caracteres aleatorios.
- Rotar la key si se sospecha compromiso: actualizar `EXTERNAL_API_KEY` en Vercel y en el CRM.
- No incluir la key en logs, URLs, ni en código fuente.
