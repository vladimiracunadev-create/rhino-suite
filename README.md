# Rhino Suite

Suite ofimática creada desde cero con React/TypeScript, motores Rust/WebAssembly y servicios Go. El repositorio es evolutivo: cada fase conserva las anteriores y migra automáticamente sus formatos.

> Estado: **Fase 2.4 — revisión, impresión e intercambio DOCX/ODT**. El formato interno es schema v5.

## Funcionalidad vigente

- Modelo documental estructurado, Unicode, comandos y undo/redo.
- Selección multipárrafo, estilos, listas, tablas, imágenes y portapapeles propio.
- Secciones, columnas, encabezados, pies, campos dinámicos y numeración independiente.
- Comentarios con respuestas, resolución y anclaje a rangos documentales.
- Marcadores e hipervínculos almacenados en el modelo, no como HTML libre.
- Control de cambios con autor, estado, resumen e instantáneas reversibles.
- Búsqueda en cuerpo, tablas, encabezados, pies y comentarios.
- Vista de impresión paginada con CSS dedicado.
- Importación y exportación inicial DOCX/ODT mediante ZIP y XML propios.
- IndexedDB, API Go, Docker, CI y binarios API para Linux/Windows.

## Tecnologías

| Capa | Tecnología |
|---|---|
| Interfaz | React 19, TypeScript, Vite |
| Motor principal | Rust |
| Navegador | WebAssembly, wasm-bindgen |
| Motor compatible | TypeScript |
| Servicios | Go `net/http` |
| Persistencia local | IndexedDB |
| Intercambio | OOXML/ODF y ZIP implementados en el repositorio |
| Monorepositorio | pnpm, Cargo y Go workspace |

## Ejecución

```bash
pnpm install
pnpm dev
```

API opcional:

```bash
pnpm dev:api
```

Validación completa:

```bash
pnpm check:full
```

Validación local de la Fase 2.4 sin dependencias externas:

```bash
# Compilar packages/engine-client y scripts/validate-phase24.ts con TypeScript
# y ejecutar el resultado con Node.js.
```

## Límites de compatibilidad actuales

DOCX y ODT son todavía formatos de **intercambio inicial**. El round-trip conserva texto, títulos, formato básico, listas simples, tablas y saltos principales. Objetos flotantes, estilos complejos, notas, campos avanzados, comentarios nativos de Office, macros y fidelidad tipográfica completa corresponden a la Fase 8.

El detalle está en [`docs/FORMAT_COMPATIBILITY.md`](docs/FORMAT_COMPATIBILITY.md).

## Roadmap

El plan maestro, criterios de salida y subfases están en [`docs/ROADMAP.md`](docs/ROADMAP.md). La siguiente entrega principal es la **Fase 3.1: libro, hoja y cuadrícula virtualizada**.
