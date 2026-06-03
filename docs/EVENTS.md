# CIMAdera Ventas — Sistema de Eventos

## Arquitectura

Los eventos se emiten mediante `lib/events/event-emitter.ts` y se entregan vía HTTP POST a los targets configurados por `lib/events/event-delivery.ts`.

Cada evento se registra en `EventLog` con sus `EventDestination`. Si ningún target tiene URL configurada, el evento queda como `DELIVERED` en DB (sin envío externo).

## Envelope

```json
{
  "eventType": "presupuesto.aprobado",
  "version": "1.0",
  "correlationId": "<entityId o el pasado explícitamente>",
  "causationId": null,
  "emittedAt": "2026-06-03T...",
  "emittedBy": { "userId": "...", "userName": "...", "userEmail": "...", "userRol": "..." },
  "source": "ventas.cimadera.net",
  "hash": "<sha256 del campo data>",
  "entityType": "presupuesto",
  "entityId": "...",
  "data": { ... }
}
```

Headers HTTP enviados al destino:
```
X-Event-Type: presupuesto.aprobado
X-Event-Version: 1.0
X-Correlation-Id: <correlationId>
X-Payload-Hash: <sha256>
X-Source: ventas.cimadera.net
Authorization: Bearer <EXTERNAL_API_KEY>
```

## Evento: `presupuesto.aprobado`

Emitido cuando un presupuesto cambia su estado a `APROBADO`.

### Payload (`data`)

```json
{
  "presupuestoId": "...",
  "numero": 1042,
  "nombrePresupuesto": "Reforma baño principal",
  "cliente": {
    "id": "...",
    "razonSocial": "Constructora XYZ",
    "email": "...",
    "tipoCliente": "CONSTRUCTORA"
  },
  "obra": { "id": "...", "nombre": "Torre A", "direccion": "Av. Principal 123" },
  "responsable": { "id": "...", "nombre": "Juan Pérez", "email": "..." },
  "division": "MADERA",
  "monto": {
    "neto": 150000.00,
    "descuentoPorcentaje": 10,
    "descuentoMonto": 16666.67,
    "tasaIva": 21,
    "montoIva": 31500.00,
    "totalConIva": 181500.00
  },
  "productos": [
    {
      "lineaId": "...",
      "productoNombre": "Puerta placa",
      "productoId": "...",
      "categoriaNombre": "Puertas",
      "division": "MADERA",
      "cantidad": 3,
      "precioUnitario": 50000.00,
      "subtotal": 150000.00,
      "opciones": [{ "atributo": "Color", "opcion": "Blanco", "precio": 0 }]
    }
  ],
  "condicionesComerciales": {
    "observaciones": "...",
    "fechaVencimiento": "2026-07-01T..."
  },
  "fechaCreacion": "2026-06-01T...",
  "fechaAprobacion": "2026-06-03T...",
  "fechaPrometidaCliente": "2026-07-15T...",
  "fechaObjetivoProduccion": "2026-07-15T..."
}
```

> Nota: `fechaPrometidaCliente` y `fechaObjetivoProduccion` inicialmente pueden tener el mismo valor. Se separan para permitir diferenciación futura.

### Validaciones en el emitter

- Sin `presupuestoId` → evento **cancelado**
- Sin `cliente.id` → evento **cancelado**
- Sin `monto.neto` → warning, se envía igual
- Sin `division` → warning + defaultea `MADERA`

## Targets configurables

| Variable de entorno | Target |
|---|---|
| `EVENT_TARGET_CRM_URL` | `crm` |
| `EVENT_TARGET_PRODUCCION_URL` | `produccion` |

Reintentos: 3 intentos con backoff lineal (1s, 2s, 3s).
