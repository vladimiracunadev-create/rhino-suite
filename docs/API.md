# API Go — contrato vigente en Fase 2.4

Base local: `http://localhost:8080`

| Método | Ruta | Uso |
|---|---|---|
| GET | `/health` | Estado del servicio |
| GET | `/api/v1/documents` | Listar documentos |
| POST | `/api/v1/documents` | Crear documento |
| GET | `/api/v1/documents/{id}` | Leer documento |
| PUT | `/api/v1/documents/{id}` | Guardar una revisión superior |
| DELETE | `/api/v1/documents/{id}` | Eliminar documento |

La API acepta el documento schema v5 completo como JSON opaco y valida metadatos, tipo, versión y revisión. Los comentarios, marcadores y cambios se almacenan junto al contenido. El cuerpo máximo continúa en 10 MiB.

En la Fase 6 se separarán metadatos, operaciones y blobs. La API actual es una capa de persistencia y no debe utilizarse todavía como protocolo de colaboración en tiempo real.
