# ADR 0006 — Fragmentos estructurados y recursos separados

- Estado: aceptada
- Fecha: 2026-07-12
- Fase: 2.2

## Contexto

Copiar HTML desde el DOM perdería la independencia del modelo y permitiría introducir estructuras no validadas. Guardar los bytes de una imagen directamente en cada bloque duplicaría datos e impediría evolucionar hacia carga diferida y almacenamiento de objetos.

## Decisión

El editor utiliza `DocumentFragment` como unidad de copiar, cortar y pegar. El fragmento incluye bloques normalizados y solamente los recursos referenciados. Se publica mediante el MIME privado `application/x-web-office-fragment+json` y siempre se acompaña de `text/plain`.

Las imágenes se almacenan en `document.resources.images`; `ImageBlock` conserva únicamente `resourceId`, geometría y metadatos semánticos.

Antes de insertar un fragmento se regeneran todos los identificadores de bloques, runs, filas, celdas, listas y recursos.

## Consecuencias

### Positivas

- El portapapeles conserva semántica y formato sin depender de HTML.
- El pegado entre instancias evita colisiones de identificadores.
- Aplicaciones externas continúan recibiendo texto plano.
- Los recursos pueden migrarse posteriormente a blobs, caché o S3.

### Costos

- El MIME privado solo es reconocido por esta suite.
- El motor debe mantener migraciones y validación del fragmento.
- El portapapeles de imágenes grandes necesita límites y almacenamiento externo en fases posteriores.
