# ADR 0003 — Formato interno propio

**Estado:** aceptada

## Decisión

DOCX, XLSX, PPTX y PDF son formatos de intercambio. El estado vivo utiliza un formato interno propio, versionado y migrable.

## Consecuencias

- El diseño no queda limitado por OOXML.
- La colaboración opera sobre identificadores y comandos estables.
- Se requieren importadores y exportadores independientes.
- Toda evolución del esquema necesita una migración explícita.
