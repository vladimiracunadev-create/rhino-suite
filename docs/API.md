# API Go — referencia REST (Fase 2.5)

Servicio de **cuentas, catálogo, persistencia y versionado** de documentos. Es una capa de almacenamiento con control de acceso, **no** un protocolo de colaboración en tiempo real (eso llega en la Fase 6).

- **Base local:** `http://localhost:8080` (o vía Nginx en `http://localhost:8088/api/...`)
- **Contrato formal:** [`apps/api/openapi.yaml`](../apps/api/openapi.yaml) (OpenAPI 3.1)
- **Implementación:** `apps/api/internal/httpapi` · Go `net/http`. Única dependencia externa: `golang.org/x/crypto` (Argon2id).

## Convenciones

- Todo el cuerpo es **JSON**. El documento se transporta como el schema v5 completo (ver [INTERNAL_FORMAT.md](INTERNAL_FORMAT.md)); la API valida metadatos, tipo, versión y revisión, y trata el `content` como opaco.
- **Tamaño máximo de cuerpo:** 10 MiB por solicitud.
- **CORS:** el origen permitido se configura con `WEB_ORIGIN`. Como la sesión viaja en cookie, se envía `Access-Control-Allow-Credentials: true` con un origen concreto, nunca `*`: ambos a la vez no son válidos.
- **Errores:** se devuelven como un objeto `Problem` (ver más abajo).

## Autenticación

Todo salvo `/health` y las tres rutas de `auth` **exige sesión**; sin ella se responde `401`. La sesión viaja en una cookie `rhino_session` **HttpOnly** que emite el servidor: el token no es legible desde JavaScript, y del lado del servidor solo se guarda su hash.

| Método | Ruta | Uso | Éxito | Errores |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Crear cuenta e iniciar sesión | `201` | `400`, `409` |
| `POST` | `/api/v1/auth/login` | Iniciar sesión | `200` | `400`, `401` |
| `POST` | `/api/v1/auth/logout` | Cerrar sesión | `204` | — |
| `GET` | `/api/v1/auth/me` | Cuenta de la sesión actual | `200` | `401` |

La contraseña debe tener **10 caracteres o más** y se deriva con Argon2id con sal por contraseña. `login` no distingue "el correo no existe" de "la contraseña es incorrecta": decirlo permitiría averiguar quién tiene cuenta.

> **La primera cuenta que se registra adopta los documentos y carpetas sin dueño** (los creados antes de que existieran las cuentas). Después, nadie más puede reclamarlos.

## Permisos

Cada documento tiene `ownerId` y una lista de `shares`. Pedir un documento al que no se tiene acceso responde **`404`, no `403`**: un `403` confirmaría que existe.

| Quién | Leer | Escribir | Compartir | Eliminar |
|---|---|---|---|---|
| Dueño | sí | sí | sí | sí |
| Compartido como `editor` | sí | sí | no | no |
| Compartido como `viewer` | sí | no | no | no |

## Endpoints

### Documentos

| Método | Ruta | Uso | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/health` | Estado del servicio (público) | `200` | — |
| `GET` | `/api/v1/documents` | Listar el catálogo **sin contenido** | `200` | `401` |
| `POST` | `/api/v1/documents` | Crear documento | `201` | `400`, `401`, `403`, `422` |
| `GET` | `/api/v1/documents/{id}` | Leer documento completo | `200` | `401`, `404` |
| `PUT` | `/api/v1/documents/{id}` | Guardar una revisión superior | `200` | `400`, `401`, `403`, `404`, `409`, `422` |
| `DELETE` | `/api/v1/documents/{id}` | Eliminar definitivamente (solo dueño) | `204` | `401`, `403`, `404` |

### Organización

Cambian solo metadatos, así que **no exigen elevar la revisión**. Guardar el documento no los toca: la organización solo se cambia por aquí, de modo que el autoguardado del editor no puede borrarla.

| Método | Ruta | Uso | Cuerpo |
|---|---|---|---|
| `POST` | `/api/v1/documents/{id}/move` | Mover a una carpeta | `{"folderId":"…"}` (vacío = raíz) |
| `POST` | `/api/v1/documents/{id}/star` | Destacar o quitar | `{"starred":true}` |
| `POST` | `/api/v1/documents/{id}/trash` | Enviar a la papelera | — |
| `POST` | `/api/v1/documents/{id}/restore` | Restaurar de la papelera | — |

Destacar o mover **no altera `updatedAt`**: esa fecha es cuándo se modificó el documento, y organizarlo no lo modifica.

### Compartir

| Método | Ruta | Uso | Éxito | Errores |
|---|---|---|---|---|
| `POST` | `/api/v1/documents/{id}/share` | Dar acceso por correo | `200` | `400`, `403`, `404` |
| `DELETE` | `/api/v1/documents/{id}/share/{userId}` | Quitar acceso | `204` | `403`, `404` |

Cuerpo de `share`: `{"email":"…","role":"viewer"}` con `role` en `viewer` o `editor`. Compartir otra vez con la misma persona **cambia su permiso**, no lo duplica. Quien recibió el documento puede quitarse a sí mismo el acceso para dejar de verlo.

### Historial de versiones

Se archiva una instantánea **en cada guardado** y se conservan las **40 más recientes**.

| Método | Ruta | Uso | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/api/v1/documents/{id}/versions` | Listar el historial (sin contenido) | `200` | `401`, `404` |
| `GET` | `/api/v1/documents/{id}/versions/{revision}` | Leer una versión | `200` | `400`, `404` |
| `POST` | `/api/v1/documents/{id}/versions/{revision}/restore` | Restaurar una versión | `200` | `400`, `403`, `404` |

Restaurar **no borra nada**: deja el contenido antiguo como una revisión nueva, así que también queda en el historial y se puede deshacer.

### Carpetas

Cada carpeta pertenece a una cuenta y solo su dueño la ve.

| Método | Ruta | Uso | Éxito | Errores |
|---|---|---|---|---|
| `GET` | `/api/v1/folders` | Listar tus carpetas | `200` | `401` |
| `POST` | `/api/v1/folders` | Crear carpeta | `201` | `400`, `404`, `422` |
| `PUT` | `/api/v1/folders/{id}` | Renombrar o mover | `200` | `400`, `404`, `422` |
| `DELETE` | `/api/v1/folders/{id}` | Eliminar carpeta | `204` | `404` |

Eliminar una carpeta **no pierde contenido**: sus documentos vuelven a la raíz y sus subcarpetas suben a la carpeta padre.

### `GET /health`

```json
{ "status": "ok", "service": "web-office-api", "time": "2026-07-12T00:00:00Z" }
```

### `GET /api/v1/documents`

Devuelve un **resumen sin `content`**: el catálogo se pinta con el extracto y el conteo guardados, y el documento completo se pide al abrirlo. Listar cien documentos no transfiere cien documentos.

```json
{ "items": [ {
  "id": "doc-1", "title": "Informe", "kind": "document", "schemaVersion": 5, "revision": 3,
  "folderId": "folder-1", "starred": true, "trashedAt": null,
  "ownerId": "user-1", "shares": [], "owned": true, "role": "editor",
  "preview": "Primeras palabras del documento…", "wordCount": 342,
  "createdAt": "…", "updatedAt": "…"
} ] }
```

`preview` y `wordCount` los **deriva el servidor** del contenido al guardar: son lo que el catálogo enseña sin abrir el documento, así que deben corresponder con lo guardado sea cual sea el cliente que lo escribió.

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
