# ADR 0005 — El DOM no será el modelo documental

## Estado

Aceptada en Fase 2.1.

## Decisión

La aplicación capturará `beforeinput`, composición IME, selección y portapapeles, los convertirá en comandos sobre offsets Unicode y volverá a renderizar desde el modelo. `contenteditable` funciona como superficie de interacción, no como almacenamiento HTML.

## Consecuencias

- El historial es determinista y compartible con Rust/WASM.
- Se evita persistir HTML dependiente del navegador.
- La compatibilidad entre navegadores exige una capa explícita de selección y composición.
- Las operaciones multibloque deberán modelarse de manera formal en una subfase posterior.
