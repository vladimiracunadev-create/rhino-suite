# Formato interno — schema v5

El formato vivo es JSON versionado y no depende de HTML, DOCX ni ODT. Los formatos de Office se utilizan únicamente como intercambio.

```json
{
  "metadata": {
    "id": "doc-1",
    "title": "Informe",
    "schemaVersion": 5,
    "createdAt": 0,
    "updatedAt": 0,
    "revision": 0
  },
  "pageSettings": {
    "widthMm": 210,
    "heightMm": 297,
    "marginTopMm": 25.4,
    "marginRightMm": 25.4,
    "marginBottomMm": 25.4,
    "marginLeftMm": 25.4
  },
  "sections": [],
  "resources": { "images": {} },
  "review": {
    "author": "Autor local",
    "trackChanges": false,
    "comments": [],
    "bookmarks": [],
    "changes": []
  },
  "blocks": []
}
```

## Secciones

Cada sección define papel, orientación, márgenes, columnas, encabezados, pies y numeración:

```json
{
  "id": "section-1",
  "name": "Cuerpo",
  "pageSettings": {
    "widthMm": 210,
    "heightMm": 297,
    "marginTopMm": 25.4,
    "marginRightMm": 25.4,
    "marginBottomMm": 25.4,
    "marginLeftMm": 25.4
  },
  "columns": { "count": 2, "gapMm": 8, "lineBetween": true, "balance": false },
  "headers": { "default": {}, "first": {}, "even": {} },
  "footers": { "default": {}, "first": {}, "even": {} },
  "differentFirstPage": true,
  "differentOddEven": false,
  "pageNumbering": { "restart": true, "start": 1, "format": "roman-lower" }
}
```

Los encabezados y pies almacenan elementos `text` o `field`. Campos permitidos: `page-number`, `page-count`, `date`, `time`, `title` y `section-name`.

## Bloques

Todos los bloques incluyen `id`, `blockType` y `sectionId`.

- `text`: clase de párrafo, estilo, lista y runs.
- `table`: filas, celdas, anchos y estilo.
- `image`: recurso, geometría, alineación, texto alternativo y pie.
- `break`: salto `page`, `column` o `section`.

`TextRun` contiene texto, estilo y un hipervínculo opcional independiente de la presentación visual.

## Revisión

- Los comentarios y marcadores se anclan con `DocumentRange`.
- Los comentarios contienen mensajes y pueden resolverse sin ser eliminados.
- Los cambios registran autor, tipo, estado, revisión e instantánea anterior sanitizada.
- El rechazo individual solo restaura de forma automática el último cambio pendiente; los anteriores se marcan como conflicto si existen cambios posteriores.

## Invariantes

- Todo bloque referencia una sección existente.
- Un salto de sección referencia la sección siguiente.
- `pageSettings` refleja la primera sección por compatibilidad.
- Los offsets cuentan puntos de código Unicode.
- El documento conserva al menos un bloque textual.
- Los fragmentos pegados regeneran identificadores y heredan la sección de destino.
- Los recursos de imagen sin referencias se eliminan durante la normalización.
- Los nombres de marcadores son únicos sin distinguir mayúsculas y minúsculas.
- Toda mutación incrementa `revision`.
- La normalización migra schema v1, v2, v3 y v4 a v5.
