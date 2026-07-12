# Contribución

1. Cree una rama corta por cambio.
2. Mantenga las reglas del documento fuera de React.
3. Toda modificación del modelo interno debe incluir migración y prueba.
4. Agregue la prueba equivalente en Rust y TypeScript cuando afecte ambos motores.
5. Ejecute `pnpm check`, `pnpm test:go` y `cargo test --workspace`.
6. No incorpore dependencias de edición que sustituyan el objetivo de construir el motor.

Los commits recomendados siguen Conventional Commits: `feat:`, `fix:`, `test:`, `docs:` y `refactor:`.
