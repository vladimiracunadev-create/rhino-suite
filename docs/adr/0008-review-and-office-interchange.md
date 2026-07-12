# ADR 0008 — Revisión estructurada e intercambio Office propio

## Decisión

Implementar comentarios, marcadores, vínculos y cambios dentro del modelo schema v5. Implementar ZIP, OOXML y ODF iniciales dentro del repositorio, sin delegar el editor a una suite externa.

## Motivos

- El producto debe construirse desde cero.
- La semántica debe sobrevivir fuera del DOM.
- El mismo núcleo debe funcionar en WebAssembly y escritorio.
- La compatibilidad debe crecer mediante adaptadores, sin convertir formatos externos en el estado vivo.

## Consecuencias

- El subconjunto DOCX/ODT inicial es limitado y explícito.
- La fidelidad completa requiere fases posteriores.
- El motor conserva independencia de proveedores.
- El control de cambios actual usa instantáneas y será sustituido o complementado por operaciones granulares en colaboración.
