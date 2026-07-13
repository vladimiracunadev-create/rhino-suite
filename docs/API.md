# API Go — referencia REST (Fase 2.4)

Servicio de **persistencia y versionado** de documentos. Es una capa de almacenamiento, **no** un protocolo de colaboración en tiempo real (eso llega en la Fase 6).

- **Base local:** `http://localhost:8080`
- **Contrato formal:** [`apps/api/openapi.yaml`](../apps/api/openapi.yaml) (OpenAPI 3.1)
- **Implementación:** `apps/api/internal/httpapi` · Go `net/http`, sin dependencias externas.

## Convenciones

- Todo el cuerpo es **JSON**. El documento se transporta como el schema v5 completo (ver [INTERNAL_FORMAT.md](INTERNAL_FORMAT.md)); la API valida metadatos, tipo, versión y revisión, y trata el `content` como opaco.
- **Tamaño máximo de cuerpo:** 10 MiB por solicitud.
- **CORS:** el origen permitido se configura con `WEB_ORIGIN`. Se aceptan métodos `GET, POST, PUT, DELETE, OPTIONS` y cabeceras `Content-Type, Authorization`.
- **Autenticación:** todavía no implementada (entorno de desarrollo — ver [SECURITY.md](../SECURITY.md)).
- **Errores:** se devuelven como un objeto `Problem` (ver más abajo).

## Endpoints

| Método | Ruta | Uso | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/health` | Estado del servicio | `200` | — |
| `GET` | `/api/v1/documents` | Listar documentos | `200` | — |
| `POST` | `/api/v1/documents` | Crear documento | `201` | `400`, `422` |
| `GET` | `/api/v1/documents/{id}` | Leer documento | `200` | `404` |
| `PUT` | `/api/v1/documents/{id}` | Guardar una revisión superior | `200` | `400`, `404`, `409`, `422` |
| `DELETE` | `/api/v1/documents/{id}` | Eliminar documento | `204` | `404` |

### `GET /health`

```json
{ "status": "ok", "service": "web-office-api", "time": "2026-07-12T00:00:00Z" }
```

### `GET /api/v1/documents`

```json
{ "items": [ { "id": "doc-1", "title": "Informe", "kind": "document", "schemaVersion": 5, "revision": 3, "content": { }, "createdAt": "…", "updatedAt": "…" } ] }
```

### `POST /api/v1/documents`

Cuerpo: `DocumentRecordInput`. Responde `201` con el `DocumentRecord` creado.

```bash
curl -X POST http://localhost:8080/api/v1/documents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Informe",
    "kind": "document",
    "schemaVersion": 5,
    "revision": 0,
    "content": { }
  }'
```

- `400` — JSON malformado o cuerpo que excede 10 MiB.
- `422` — el documento no valida (metadatos, tipo, versión o revisión inconsistentes).

### `GET /api/v1/documents/{id}`

Responde `200` con el `DocumentRecord`, o `404` si no existe.

### `PUT /api/v1/documents/{id}`

Guarda una **revisión estrictamente superior** a la almacenada (control de concurrencia optimista).

- `409` — la `revision` enviada no es mayor que la persistida.
- `404` — el documento no existe · `400` — cuerpo inválido · `422` — no valida.

### `DELETE /api/v1/documents/{id}`

Responde `204` sin cuerpo, o `404` si no existe.

## Esquemas

### `DocumentRecordInput`

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `id` | string | no | Se genera si se omite |
| `title` | string | **sí** | `minLength: 1` |
| `kind` | enum | **sí** | `document` · `spreadsheet` · `presentation` · `pdf` |
| `schemaVersion` | integer | **sí** | `≥ 1` (documentos actuales: 5) |
| `revision` | integer | **sí** | `≥ 0`, monótona creciente |
| `content` | any | **sí** | Documento schema v5 completo (opaco para la API) |

### `DocumentRecord`

`DocumentRecordInput` más los campos gestionados por el servidor:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | Identificador estable |
| `createdAt` | string (date-time) | Alta |
| `updatedAt` | string (date-time) | Última escritura |

### `Problem`

Formato uniforme de error:

```json
{ "type": "about:blank", "status": 409, "detail": "La revisión debe ser mayor que la almacenada." }
```

| Campo | Tipo | Uso |
|---|---|---|
| `type` | string | Categoría del problema |
| `status` | integer | Código HTTP |
| `detail` | string | Mensaje legible |

## Garantías de almacenamiento

- Cada documento se persiste de forma **atómica** (archivo temporal + renombrado).
- Los identificadores se **normalizan** antes de formar rutas de archivo (defensa contra path traversal).
- El contrato `Store` está desacoplado del disco: en fases posteriores podrá reemplazarse por PostgreSQL y almacenamiento de objetos sin cambiar los handlers.

## Evolución

En la **Fase 6** se separarán metadatos, operaciones y blobs, y se añadirá el canal de colaboración en tiempo real. La API actual **no** debe usarse todavía como protocolo colaborativo.
