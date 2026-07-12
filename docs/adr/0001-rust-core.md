# ADR 0001 — Núcleo en Rust

**Estado:** aceptada

## Decisión

Las reglas documentales, estructuras de datos, comandos, validaciones y cálculos intensivos se implementan en Rust.

## Consecuencias

- El mismo núcleo puede compilarse a WebAssembly y ejecutarse de forma nativa.
- La interfaz no queda acoplada a React.
- La curva de aprendizaje y los tiempos iniciales son mayores.
- Las fronteras con TypeScript deben permanecer explícitas y versionadas.
