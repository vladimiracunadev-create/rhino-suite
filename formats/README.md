# Formatos de intercambio

El modelo interno schema v5 continúa siendo la fuente de verdad. Los formatos externos se implementan mediante adaptadores y nunca se utilizan como estado vivo del editor.

## Implementado en la Fase 2.4

- `packages/engine-client/src/zip.ts`: lectura ZIP Store/Deflate y escritura Store con CRC32.
- `packages/engine-client/src/formats.ts`: importación/exportación inicial DOCX y ODT.
- Round-trip básico probado para texto, títulos, formato esencial, listas simples, tablas y saltos principales.
- Partes auxiliares privadas para preservar metadatos de revisión generados por la propia suite.

## Evolución prevista

- `formats/ooxml`: fidelidad avanzada DOCX, XLSX y PPTX.
- `formats/pdf`: parser, renderizado y escritura PDF.
- `formats/odf`: fidelidad avanzada ODT, ODS y ODP.
- `formats/internal`: migraciones y herramientas del formato propio.

Cada convertidor debe declarar qué características conserva, aproxima o descarta. El detalle vigente está en `docs/FORMAT_COMPATIBILITY.md`.
