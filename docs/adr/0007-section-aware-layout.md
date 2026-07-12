# ADR 0007 — Layout consciente de secciones

## Decisión

El documento mantiene una colección explícita de secciones. Cada bloque referencia `sectionId`; los cambios de sección se representan mediante bloques de salto. El layout resuelve papel, márgenes, columnas, encabezados, pies y numeración desde la sección activa.

## Motivos

- Evitar que propiedades de página queden mezcladas con HTML o estado de React.
- Permitir que web, WASM, escritorio e importadores compartan el mismo contrato.
- Conservar migración determinista y undo/redo.

## Consecuencias

El schema aumenta a v4. Los fragmentos pegados heredan la sección de destino y los saltos de sección se degradan a saltos de página para evitar copiar referencias huérfanas.
