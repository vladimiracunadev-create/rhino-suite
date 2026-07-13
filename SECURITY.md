# Política de seguridad

Rhino Suite es todavía un **entorno de desarrollo por fases** y no debe exponerse directamente a Internet. Este documento describe el modelo de amenaza, los controles vigentes y cómo reportar vulnerabilidades.

## Alcance y estado

- La API Go **aún no implementa autenticación**. Está pensada para uso local.
- El CORS se restringe mediante la variable `WEB_ORIGIN`.
- Los documentos se limitan a **10 MiB** por solicitud.
- El endurecimiento completo (OOXML/ODF robusto, fuzzing, auditoría exhaustiva) corresponde a la **Fase 8**.

## Modelo de amenaza

| Superficie | Riesgo | Control vigente |
|---|---|---|
| Entrada de la API | JSON malformado, cuerpos gigantes | Límite de 10 MiB; validación de metadatos/tipo/versión/revisión |
| Rutas de archivo | Path traversal en el `id` | Los identificadores se **normalizan** antes de formar rutas |
| Escritura de documentos | Corrupción por escritura parcial | Archivo temporal + **renombrado atómico** |
| Parsers de intercambio | DOCX/ODT/ZIP hostiles | Se tratan como **entrada no confiable**; el alcance es intercambio inicial, no fidelidad total |
| Concurrencia | Sobrescritura de revisiones | Control optimista: `PUT` exige `revision` estrictamente superior (`409` si no) |
| CORS | Orígenes no autorizados | Origen único configurable por `WEB_ORIGIN` |
| Cadena de suministro (CI) | Acciones repunteadas, secretos, código ofuscado | Ver "Controles en CI" |

Los parsers de DOCX, XLSX, PPTX y PDF —presentes y futuros— deben tratar **todo documento como entrada hostil**.

## Controles en CI

El repositorio trata el CI como frontera de confianza. En cada push y PR se ejecutan:

- **`security.yml`** — CodeQL sobre JS/TS, detección de Trojan Source (caracteres bidireccionales / zero-width, CVE-2021-42574) y escaneo *advisory* de dependencias con `govulncheck` (Go) y `cargo-audit` (Rust).
- **`workflow-security.yml`** — `actionlint` + `zizmor` (persona auditor) + un verificador propio que **rechaza cualquier acción no pinned a SHA**.
- **Endurecimiento transversal** en todos los workflows: `permissions` mínimos por job (default `contents: read`), `persist-credentials: false` en los checkout, `concurrency` para cancelar runs superados, y acciones de terceros **pinned a SHA de commit** (no a tags movibles).

## Buenas prácticas al contribuir

- No introduzcas secretos en el repositorio ni en los workflows.
- Al añadir o editar un workflow, pinnea toda acción a un SHA de 40 hex con la versión en comentario.
- No añadas dependencias sin justificación; el grafo se mantiene deliberadamente pequeño.

## Reportar una vulnerabilidad

Informa las vulnerabilidades **de forma privada** antes de divulgar detalles públicamente:

1. Usa **[GitHub Security Advisories](https://github.com/vladimiracunadev-create/rhino-suite/security/advisories/new)** (pestaña *Security → Report a vulnerability*), o
2. Contacta al mantenedor de forma privada.

Incluye, en lo posible: descripción, pasos de reproducción, impacto y versión/commit afectado. No abras un issue público para vulnerabilidades no divulgadas.
