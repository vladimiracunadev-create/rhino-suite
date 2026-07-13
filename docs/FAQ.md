# ❓ Preguntas frecuentes

Decisiones de diseño de Rhino Suite, explicadas. Para el "qué" ver el [README](../README.md); aquí está el "por qué".

## Sobre el proyecto

### ¿Qué es exactamente Rhino Suite?

Una suite ofimática (documentos, y en el futuro hojas de cálculo, presentaciones y PDF) construida desde cero, con un modelo documental propio en el centro. Hoy está en la **Fase 2.4**: el editor de documentos es funcional, con revisión, impresión e intercambio inicial DOCX/ODT.

### ¿Está listo para producción?

No. Es un proyecto **evolutivo por fases** y un entorno de desarrollo. La API no tiene autenticación y no debe exponerse a Internet. Ver [SECURITY.md](../SECURITY.md).

### ¿Por qué "evolutivo por fases"?

Para publicar incrementos funcionales sin fragmentar el repositorio en prototipos sueltos. Cada fase amplía la anterior, mantiene migraciones de formato y define una puerta de salida verificable. Ver [ROADMAP.md](ROADMAP.md).

## Sobre la arquitectura

### ¿Por qué un formato interno propio en vez de DOCX o HTML?

Porque el estado vivo necesita invariantes estrictas (offsets Unicode, referencias de sección, unicidad de marcadores) que HTML no garantiza y que DOCX/ODF vuelven caras de mantener en memoria. DOCX, XLSX, PPTX y PDF son **formatos de intercambio** (entrada/salida), no el estado del editor. Ver [ADR 0003](adr/0003-internal-format.md) e [INTERNAL_FORMAT.md](INTERNAL_FORMAT.md).

### ¿Por qué dos motores, Rust y TypeScript?

Rust (`office-core`) es la **implementación principal** de las reglas: rápida, portable a WebAssembly y reutilizable en escritorio nativo (Fase 7). El motor TypeScript (`engine-client`) es un **respaldo compatible** que permite desarrollar la web sin el toolchain de Rust. La regla: ambos deben conservar equivalencia semántica. Ver [ADR 0001](adr/0001-rust-core.md).

### ¿Necesito instalar Rust para trabajar en la interfaz?

No. `pnpm dev` usa el motor TypeScript de respaldo si no hay artefacto WASM. Instala Rust + wasm-pack solo cuando quieras compilar o modificar el núcleo. Ver [GETTING_STARTED.md](GETTING_STARTED.md).

### ¿Por qué Go para la API y no Node o Rust?

Un servicio pequeño, sin dependencias externas, con almacenamiento atómico y un contrato `Store` que podrá cambiar disco por PostgreSQL/objetos sin tocar los handlers. Ver [ADR 0002](adr/0002-go-services.md).

### ¿Por qué un portapapeles propio en lugar de HTML del sistema?

Para transportar **semántica** (bloques, estilos, recursos referenciados) y no HTML arbitrario que habría que sanear y reinterpretar. Se acompaña siempre de un `text/plain` de respaldo. Ver [ADR 0006](adr/0006-structured-fragments-and-resources.md).

## Sobre formatos e interoperabilidad

### ¿Qué tan fiel es la exportación a DOCX/ODT?

Es **intercambio inicial**. El round-trip conserva texto, títulos, formato básico, listas simples, tablas y saltos principales. Objetos flotantes, estilos complejos, notas, comentarios nativos de Office, macros y fidelidad tipográfica completa corresponden a la Fase 8. Detalle en [FORMAT_COMPATIBILITY.md](FORMAT_COMPATIBILITY.md).

### ¿Se usa alguna librería de Office o ZIP externa?

No. El lector/escritor ZIP (`zip.ts`) y el XML OOXML/ODF (`formats.ts`) están implementados en el propio repositorio, sin ONLYOFFICE, LibreOffice ni SDK comerciales.

### ¿Cómo se preserva el control de cambios al exportar?

Los metadatos de revisión se guardan en partes auxiliares propias del paquete (no como comentarios/cambios nativos de Office, que llegan en la Fase 8).

## Sobre desarrollo y colaboración

### ¿Cómo verifico que todo está bien antes de commitear?

`pnpm check` (typecheck + tests + build web) y, si tienes los toolchains, `pnpm check:full` (añade Rust/WASM). El smoke test de la fase es `npx tsx scripts/validate-phase24.ts`. Ver [VALIDATION.md](VALIDATION.md).

### ¿Ya hay colaboración en tiempo real?

No. El historial usa instantáneas; la representación operacional granular y CRDT llegan en la **Fase 6**. La API actual es solo persistencia.

### ¿Cuál es el siguiente hito?

**Fase 3.1 — libro, hoja y cuadrícula virtualizada** (inicio de las hojas de cálculo). Ver [ROADMAP.md](ROADMAP.md).

### Encontré un número de versión o fase desactualizado en la doc. ¿Lo corrijo?

Sí, si es un *marcador de estado actual*. Si es una *referencia histórica* (CHANGELOG, ADR), consérvala. Ver la [convención de estado](INDEX.md#convención-de-estado).
