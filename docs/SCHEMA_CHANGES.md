# Cambios de Schema — FASE 1

## Nuevos campos

### Enum `DivisionProductiva`
```prisma
enum DivisionProductiva { MADERA | MELAMINA | ALUMINIO | MIXTO }
```
Usado en `Presupuesto.division` y `LineaPresupuesto.division`.

### Modelo `Obra`
| Campo | Tipo | Descripción |
|---|---|---|
| `codigoObra` | `String? @unique` | Código interno de obra |

### Modelo `Presupuesto`
| Campo | Tipo | Descripción |
|---|---|---|
| `division` | `DivisionProductiva?` | División productiva del presupuesto |
| `fechaPrometidaCliente` | `DateTime?` | Fecha comprometida con el cliente |
| `fechaObjetivoProduccion` | `DateTime?` | Fecha objetivo para producción |
| `anticipoEsperado` | `Decimal?(14,2)` | Monto de anticipo previsto |
| `saldoEsperado` | `Decimal?(14,2)` | Saldo remanente previsto |
| `probabilidadCobro` | `Decimal?(5,2)` | Probabilidad de cobro 0–100% |
| `motivoRechazo` | `String?` | Motivo al cambiar estado a RECHAZADO |

> Nota: `fechaPrometidaCliente` y `fechaObjetivoProduccion` inicialmente pueden tener el mismo valor. Se separan para permitir diferenciación futura entre la fecha acordada con el cliente y la fecha interna de producción.

### Modelo `LineaPresupuesto`
| Campo | Tipo | Descripción |
|---|---|---|
| `division` | `DivisionProductiva?` | División de la línea específica |

### Modelos nuevos

#### `EventLog`
Registro de eventos de dominio emitidos. Campos: `eventId`, `eventType`, `version`, `entityType`, `entityId`, `correlationId`, `causationId`, `hash`, `payload`, `status`, `processedAt`, `creadoPorId`.

#### `EventDestination`
Destino de entrega de un evento. Campos: `target`, `targetUrl`, `status`, `attempts`, `lastError`, `deliveredAt`.

#### `DecisionLog`
Registro de decisiones comerciales que requirieron aprobación. Campos: `tipoDecision`, `entidadTipo`, `entidadId`, `aprobadoPorId`, `aprobadoPorRol`, `requirioDirector`, `monto`, `montoAnterior`, `montoNuevo`, `contextoExtra`, `fechaSolicitud`, `fechaResolucion`, `tiempoResolucionH`.

## Variables de entorno nuevas (opcionales)
```
EVENT_TARGET_CRM_URL=         # URL webhook del CRM
EVENT_TARGET_PRODUCCION_URL=  # URL webhook de producción
```
Si no están configuradas, los eventos se registran en DB pero no se envían (status: DELIVERED automático).
