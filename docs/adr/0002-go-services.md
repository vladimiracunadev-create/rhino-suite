# ADR 0002 — Servicios en Go

**Estado:** aceptada

## Decisión

La API, la sincronización, los trabajos y los servicios de red se desarrollan en Go.

## Consecuencias

- Binarios pequeños y fáciles de desplegar.
- Concurrencia clara para sincronización y colaboración.
- El modelo documental no se duplica en Go; se trata como contenido versionado.
- La frontera Rust/Go se mantiene mediante contratos y formatos estables.
