# 📖 Índice de documentación

Punto de entrada a la documentación de **Rhino Suite**, organizado **por perfil de lectura** y **por etapa**. Si no sabes por dónde empezar, elige tu perfil.

## Elige tu camino

| Soy… | Empieza por |
|---|---|
| 💻 **Desarrollador** | [Guía de arranque](GETTING_STARTED.md) → [Arquitectura](ARCHITECTURE.md) → [Formato interno](INTERNAL_FORMAT.md) |
| 🧭 **Evaluando el proyecto** | [README](../README.md) → [Roadmap](ROADMAP.md) → [Estado de la entrega](DELIVERY_STATUS.md) |
| 🧩 **Integrando la API** | [API Go](API.md) → [Formato interno](INTERNAL_FORMAT.md) → [Compatibilidad DOCX/ODT](FORMAT_COMPATIBILITY.md) |
| 🤝 **Contribuidor** | [CONTRIBUTING](../CONTRIBUTING.md) → [Validación](VALIDATION.md) → [ADR](adr/0001-rust-core.md) |
| 🆕 **Nuevo en el dominio** | [Glosario](GLOSSARY.md) → [FAQ](FAQ.md) → [Arquitectura](ARCHITECTURE.md) |

## Por etapa

### 1. Entender el proyecto

- [README](../README.md) — qué es, funcionalidad vigente y quickstart.
- [Arquitectura](ARCHITECTURE.md) — capas, límites y decisiones deliberadas.
- [Roadmap maestro](ROADMAP.md) — las ocho fases, objetivos y puertas de salida.
- [Plan por fases](PHASES.md) — resumen de una línea por fase.
- [Estado de la entrega](DELIVERY_STATUS.md) — qué está implementado hoy.
- [Glosario](GLOSSARY.md) · [Preguntas frecuentes](FAQ.md)

### 2. Usar y desarrollar

- [Guía de arranque](GETTING_STARTED.md) — prerequisitos, instalación, ejecución y build.
- [Validación](VALIDATION.md) — cómo verificar TypeScript, Rust/WASM y Go.
- [Resultado de validación local](LOCAL_VALIDATION_RESULT.md) — última corrida registrada.
- [API Go](API.md) — referencia REST de persistencia de documentos.

### 3. Entender el modelo

- [Formato interno (schema v5)](INTERNAL_FORMAT.md) — estructura del documento vivo.
- [Modelo de revisión](REVIEW_MODEL.md) — comentarios, marcadores, hipervínculos y control de cambios.
- [Compatibilidad DOCX/ODT](FORMAT_COMPATIBILITY.md) — qué conserva el round-trip y qué no.
- [Fase 2 — Editor de documentos](PHASE_2.md) — alcance acumulado del editor.

### 4. Decisiones de arquitectura (ADR)

Registro cronológico de decisiones técnicas irreversibles o de alto impacto:

- [0001 — Núcleo en Rust](adr/0001-rust-core.md)
- [0002 — Servicios en Go](adr/0002-go-services.md)
- [0003 — Formato interno propio](adr/0003-internal-format.md)
- [0004 — Entrega por fases](adr/0004-phase-delivery.md)
- [0005 — Entrada estructurada del editor](adr/0005-structured-editor-input.md)
- [0006 — Fragmentos y recursos estructurados](adr/0006-structured-fragments-and-resources.md)
- [0007 — Layout consciente de secciones](adr/0007-section-aware-layout.md)
- [0008 — Revisión e intercambio Office](adr/0008-review-and-office-interchange.md)

## Convención de estado

En toda la documentación distinguimos dos tipos de referencia a la versión/fase:

- **Marcador de estado actual** (se sincroniza con cada release): *"Fase 2.4"*, *"schema v5"*, `0.6.0-phase.2.4`.
- **Referencia histórica** (se conserva): entradas del [CHANGELOG](../CHANGELOG.md) y de los ADR, que documentan lo que era cierto en su momento.

Si editas un documento y encuentras un número de estado desactualizado, corrígelo; si es una referencia histórica, consérvala.
