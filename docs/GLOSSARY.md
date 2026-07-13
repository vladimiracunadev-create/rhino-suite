# 📖 Glosario

Términos del dominio de Rhino Suite. El objetivo es que cualquiera pueda leer la documentación y el código sin ambigüedad.

## Modelo documental

**Documento vivo (`TextDocument`)**
El estado real que edita el usuario: un JSON versionado independiente del DOM. Nunca se guarda como HTML. Ver [INTERNAL_FORMAT.md](INTERNAL_FORMAT.md).

**Schema (schema vN)**
Versión del formato interno. El actual es **v5**. Toda apertura normaliza y migra hacia adelante desde v1–v4. Es un *marcador de estado actual* (se sincroniza con cada release).

**Bloque (`Block`)**
Unidad de contenido de nivel superior. Tipos: `text` (párrafo/título), `table`, `image`, `break`. Todo bloque tiene `id`, `blockType` y `sectionId`.

**Run (`TextRun`)**
Fragmento contiguo de texto dentro de un bloque que comparte estilo. Un run puede llevar un `hyperlink` propio, independiente del estilo visual.

**Estilo de carácter / de párrafo**
`TextStyle` (fuente, tamaño, color, negrita…) aplica a runs; `ParagraphStyle` (alineación, espaciado, keep…) aplica al párrafo.

**Sección (`DocumentSection`)**
Región del documento con su propio papel, orientación, márgenes, columnas, encabezados, pies y numeración. Un salto de sección apunta a la sección siguiente.

**Recurso (`ImageResource`)**
Contenido binario (imagen) almacenado una sola vez en `resources.images[id]` y referenciado por un `ImageBlock`. Separar binario y bloque habilita deduplicación y carga diferida. Los recursos sin referencias se eliminan al normalizar.

**Campo dinámico (`field`)**
Valor calculado en encabezados/pies: `page-number`, `page-count`, `date`, `time`, `title`, `section-name`.

## Selección, edición e intercambio

**`DocumentPoint` / `DocumentRange`**
Ubicación (bloque + offset en puntos de código Unicode) y rango entre dos puntos. Anclan cursor, selección, comentarios y marcadores.

**Comando (`DocumentCommand`)**
Intención de mutación aplicada por el motor (`apply`). Cada comando produce un nuevo estado, incrementa `revision` y alimenta undo/redo.

**Fragmento (`DocumentFragment`)**
Unidad de copiar/cortar/pegar del portapapeles propio: bloques normalizados más solo los recursos referenciados. Viaja bajo el MIME `application/x-web-office-fragment+json` con un fallback `text/plain`. Al pegar, regenera identificadores y hereda la sección destino.

**Round-trip**
Exportar a DOCX/ODT y volver a importar. Se garantiza para archivos generados por la propia suite; ver alcance en [FORMAT_COMPATIBILITY.md](FORMAT_COMPATIBILITY.md).

## Revisión

**`ReviewState`**
Sub-árbol `TextDocument.review`: `author`, `trackChanges`, `comments[]`, `bookmarks[]`, `changes[]`.

**Control de cambios (track changes)**
Cuando está activo, cada comando rastreable registra autor, tipo, resumen, estado e **instantánea anterior sanitizada** (sin instantáneas anidadas). El rechazo individual es seguro para el último cambio pendiente; los anteriores se marcan como **conflicto** si hay cambios posteriores.

**Comentario / marcador / hipervínculo**
Comentario: hilo con cita, mensajes y estado resuelto, anclado a un rango. Marcador: nombre único (case-insensitive) que apunta a un rango. Hipervínculo: pertenece a `TextRun.hyperlink`.

## Arquitectura y proceso

**`office-core`**
Crate Rust con el modelo documental independiente de plataforma: la implementación principal de las reglas.

**`office-wasm`**
Capa fina de interoperabilidad que expone `office-core` a WebAssembly usando JSON como contrato estable Rust↔TypeScript.

**`engine-client`**
Paquete TypeScript: motor **compatible** de respaldo para desarrollo web más el adaptador de navegador (carga WASM cuando existe, layout, búsqueda, formatos, ZIP y persistencia IndexedDB).

**Motor de respaldo (fallback)**
El motor TypeScript que se usa cuando no hay artefacto WASM presente. Debe conservar equivalencia semántica con Rust.

**Fase / subfase**
El proyecto avanza en 8 fases; cada una conserva las anteriores y tiene una **puerta de salida** verificable. Ver [ROADMAP.md](ROADMAP.md).

**Puerta de salida (exit gate)**
Criterio verificable que debe cumplirse antes de iniciar una fase dependiente.

**Marcador de estado actual vs. referencia histórica**
El primero (p. ej. "Fase 2.4", "schema v5") se actualiza con cada release; la segunda (CHANGELOG, ADR) se conserva tal cual fue escrita. Ver [INDEX.md](INDEX.md#convención-de-estado).
