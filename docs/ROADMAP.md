# Roadmap maestro

Este documento define la secuencia técnica de **Rhino Suite**. El producto se construye desde cero y conserva una regla central: el modelo y los motores no dependen del DOM, de React ni del sistema operativo.

El roadmap se divide en ocho fases. Cada fase tiene un objetivo, entregables mínimos y una puerta de salida verificable. Las subfases permiten publicar incrementos funcionales sin convertir el repositorio en una colección de prototipos separados.

## Principios de ejecución

1. **Un solo repositorio evolutivo.** Cada entrega amplía la anterior y mantiene migraciones de formato.
2. **Núcleo reutilizable.** Rust es la implementación principal de los motores; TypeScript mantiene un motor compatible para desarrollo web.
3. **Formato interno propio.** DOCX, XLSX, PPTX, ODF y PDF son formatos de intercambio, no el estado vivo del editor.
4. **Funciones observables y probables.** Cada incremento incluye pruebas, documentación y criterios de aceptación.
5. **Compatibilidad progresiva.** Primero se estabiliza el comportamiento interno y después se aumenta la fidelidad con formatos externos.

## Estado general

| Fase | Producto | Estado |
|---|---|---|
| 1 | Plataforma y núcleo común | Completada |
| 2 | Editor de documentos | Completada — 2.5 entregada |
| 3 | Hojas de cálculo | Siguiente |
| 4 | Presentaciones | Planificada |
| 5 | PDF | Planificada |
| 6 | Colaboración en tiempo real | Planificada (reducida: ver 2.5) |
| 7 | Aplicación de escritorio | Planificada |
| 8 | Compatibilidad y endurecimiento | Planificada |

### Subfases entregadas de la Fase 2

| Subfase | Entrega |
|---|---|
| 2.1–2.3 | Modelo estructurado, edición rica, secciones y composición |
| 2.4 | Revisión, búsqueda, impresión e intercambio DOCX/ODT |
| **2.5** | **Unidad de archivos, cuentas y compartición** |

> **Nota de orden.** La 2.5 nació de usar el producto, no del plan: sin un sitio donde encontrar los documentos ni cuentas que los separen, el editor no era utilizable de verdad. Al hacerla se adelantó la compartición con permisos, que estaba en la Fase 6; esa fase queda ahora acotada a la colaboración en tiempo real.

---

## Fase 1 — Plataforma y núcleo común

### Objetivo

Crear la base políglota compartida para todos los productos de la suite.

### Entregables

- Monorepositorio pnpm, Cargo y Go Workspace.
- Modelo documental versionado.
- Bus de comandos y revisiones.
- Undo/redo.
- Rust nativo y bindings WebAssembly.
- Motor TypeScript compatible.
- Persistencia IndexedDB.
- API Go y almacenamiento atómico inicial.
- Docker, Nginx, CI, seguridad y documentación.

### Puerta de salida

Un documento puede crearse, mutarse, serializarse, restaurarse, guardarse localmente y enviarse a la API sin depender del DOM.

**Estado:** completada.

---

## Fase 2 — Editor de documentos

### Objetivo

Construir un procesador de texto paginado con modelo estructurado, entrada robusta y layout independiente de la interfaz.

### 2.1 — Edición estructurada y paginación

- Selección y cursor dentro de un bloque.
- Entrada Unicode, `beforeinput` e IME.
- Runs, estilos de carácter y estilos de párrafo.
- División y unión de párrafos.
- Layout de líneas y páginas A4.
- Interfaz tipo Word, zoom, autosave e inspector.

**Estado:** completada.

### 2.2 — Estructuras enriquecidas

- Selección entre varios párrafos.
- Reemplazo, borrado y formato multibloque.
- Listas con viñetas y numeración.
- Tablas editables, filas y columnas.
- Imágenes como recursos separados del documento.
- Tamaño, alineación, texto alternativo y pie de imagen.
- Portapapeles estructurado con MIME propio y fallback de texto plano.
- Schema v3 y migración automática desde v1/v2.

**Estado:** completada.

### 2.3 — Secciones y composición avanzada

- Configuración de papel, orientación y márgenes por sección.
- Encabezados y pies predeterminados, de primera página y pares.
- Saltos de página, sección y columna.
- Una a cuatro columnas y regla divisoria.
- Campos dinámicos de página, total, título, sección, fecha y hora.
- Numeración decimal o romana reiniciable por sección.
- Viudas/huérfanas, `keep-with-next`, mantener líneas y salto previo.
- Schema v4 y migración desde v1-v3.

**Estado:** completada.

### 2.4 — Revisión, referencias, impresión y exportación

- Hipervínculos y marcadores estructurados.
- Comentarios, respuestas y resolución.
- Control de cambios con aceptación, rechazo y detección de conflicto.
- Búsqueda en cuerpo, tablas, encabezados, pies y comentarios.
- Vista de impresión paginada.
- Importación/exportación DOCX y ODT inicial mediante ZIP/XML propios.
- Schema v5 y migración desde v1-v4.

**Estado:** completada.

Elementos diferidos a compatibilidad avanzada: tabulaciones complejas, notas al pie, diccionario, comentarios nativos OOXML/ODF, PDF vectorial y accesibilidad exhaustiva.

### Puerta de salida de la Fase 2

Un documento extenso debe poder editarse, paginarse, imprimirse, revisarse, guardarse y reabrirse sin pérdida semántica; además, debe importar y exportar un subconjunto documentado de DOCX/ODT.

---

## Fase 2.5 — Unidad de archivos, cuentas y compartición

### Objetivo

Convertir el editor en un producto usable: un sitio donde encontrar los
documentos, cuentas que los separen y una forma de compartirlos.

### Entregables

- **Unidad de archivos**: carpetas con navegación por ruta, recientes,
  destacados, papelera con restauración, búsqueda, orden, selección múltiple con
  acciones en lote, arrastrar a carpetas y subida de DOCX/ODT.
- **Cuentas**: alta y entrada con correo y contraseña (Argon2id, sal por
  contraseña, comparación en tiempo constante), sesión en cookie HttpOnly de la
  que solo se guarda el hash del token.
- **Aislamiento**: cada documento y carpeta tiene dueño; pedir uno ajeno
  responde 404, no 403, porque un 403 confirmaría que existe.
- **Compartición** por correo con permiso de lectura o edición. Solo el dueño
  reparte acceso y solo él puede eliminar.
- **Historial de versiones**: instantánea por guardado (tope de 40) y
  restauración que no destruye lo anterior.
- **Una URL por documento**: recargar, compartir por enlace y botón atrás.
- **Rendimiento**: el catálogo se lista con metadatos; el contenido solo se pide
  al abrir un documento.
- Tema claro/oscuro e idioma español/inglés.

### Puerta de salida

Dos cuentas distintas no ven los documentos de la otra; compartir concede el
acceso exactamente del permiso concedido; y recargar sobre la URL de un
documento devuelve a ese documento.

**Estado:** completada. Verificado con pruebas de aislamiento y de permisos en
`apps/api/internal/httpapi`.

---

## Fase 3 — Hojas de cálculo

### Objetivo

Crear un motor de libro de cálculo eficiente, incremental y apto para grandes hojas.

### 3.1 — Libro, hoja y cuadrícula virtualizada

- Workbook/worksheet.
- Almacenamiento disperso de celdas.
- Filas y columnas virtualizadas.
- Selección, rangos, edición y portapapeles.
- Tipos de valor, formato numérico y congelación de paneles.

### 3.2 — Fórmulas y recálculo

- Lexer y parser de fórmulas.
- AST tipado.
- Referencias relativas, absolutas y entre hojas.
- Grafo de dependencias.
- Detección de ciclos.
- Recálculo incremental y funciones base.
- Cálculo paralelo donde sea seguro.

### 3.3 — Datos y visualización

- Ordenamiento y filtros.
- Validación de datos.
- Formato condicional.
- Tablas, nombres definidos y protección.
- Gráficos iniciales.
- Importación/exportación XLSX, CSV y ODS.

### Puerta de salida

Un libro de prueba de gran tamaño debe desplazarse fluidamente, recalcular solo dependencias afectadas y conservar valores, fórmulas y formatos en un round-trip documentado.

---

## Fase 4 — Presentaciones

### Objetivo

Construir un editor de diapositivas basado en un grafo de escena 2D.

### Subfases

- **4.1:** diapositivas, lienzo, zoom, selección y transformaciones.
- **4.2:** texto, formas, imágenes, grupos, capas, guías y alineación.
- **4.3:** tablas, gráficos, temas, patrones y notas del presentador.
- **4.4:** transiciones, animaciones, modo presentación y PPTX/ODP inicial.

### Puerta de salida

La presentación debe conservar geometría, orden de capas, temas y recursos entre edición, modo presentación y exportación.

---

## Fase 5 — Motor PDF

### Objetivo

Implementar lectura, representación y modificación incremental de PDF sin tratarlo como un documento de texto semántico.

### Subfases

- **5.1:** parser de objetos, xref, trailers, streams y filtros.
- **5.2:** árbol de páginas, fuentes, imágenes y renderizado.
- **5.3:** selección, anotaciones, formularios y operaciones de página.
- **5.4:** firma, cifrado, redacción, optimización y escritura incremental.

### Puerta de salida

Los archivos de prueba deben abrirse, renderizarse y guardarse con validación estructural, preservando objetos no modificados mediante escritura incremental cuando corresponda.

---

## Fase 6 — Colaboración en tiempo real

### Objetivo

Agregar edición concurrente y presencia sobre los modelos estabilizados.

> **Alcance reducido.** Las cuentas, los permisos y el historial de versiones ya
> se entregaron en la Fase 2.5, junto con la unidad de archivos que los
> necesitaba. Aquí queda lo que de verdad es difícil: que dos personas escriban
> a la vez sin pisarse.

### Subfases

- Identificadores persistentes y operaciones compactas.
- CRDT por tipo de documento.
- WebSocket y recuperación de sesión.
- Presencia, cursores y selección remota.
- Menciones en comentarios.
- Cola offline, reconciliación y snapshots.

### Ya entregado en la Fase 2.5

- Permisos de lectura y edición por documento.
- Historial de versiones con restauración.
- Cola local offline (IndexedDB) con sincronización manual a la nube.

### Puerta de salida

Dos o más clientes deben editar concurrentemente, desconectarse y reconciliarse sin pérdida de operaciones ni divergencia del estado final.

---

## Fase 7 — Aplicación de escritorio

### Objetivo

Distribuir la misma suite como aplicación nativa ligera para Windows, Linux y macOS.

### Subfases

- Tauri 2 y comandos Rust nativos.
- Selector y vigilancia de archivos.
- Asociaciones de extensiones.
- Portapapeles, impresión y arrastrar/soltar nativos.
- Recuperación ante fallos y bloqueo de archivos.
- Actualizaciones firmadas e instaladores.
- Política de permisos y sandbox.

### Puerta de salida

La aplicación debe abrir archivos por asociación, guardar de forma atómica, recuperarse de un cierre inesperado y actualizarse mediante paquetes firmados.

---

## Fase 8 — Compatibilidad, rendimiento y producto

### Objetivo

Convertir los motores funcionales en una suite interoperable, medible y preparada para uso prolongado.

### Subfases

- OOXML y ODF ampliados.
- Matrices de compatibilidad por característica.
- Round-trip y comparación visual automatizada.
- Recuperación de archivos dañados.
- Fuentes, internacionalización, bidi y escrituras complejas.
- Perfilado de CPU, memoria y documentos grandes.
- Telemetría respetuosa de privacidad.
- Extensiones, plantillas y API pública.
- Seguridad, fuzzing y auditoría de dependencias.

### Puerta de salida

La suite debe cumplir objetivos cuantificados de compatibilidad, rendimiento, estabilidad, seguridad y accesibilidad sobre corpus públicos y propios.

---

## Hitos transversales

Cada fase debe mantener:

- Migraciones de schema hacia adelante.
- Pruebas unitarias, de integración y corpus de regresión.
- Contratos equivalentes Rust/TypeScript.
- Documentación de limitaciones conocidas.
- Presupuestos de rendimiento y memoria.
- CI reproducible para web, Rust/WASM y Go.
- Formato de archivo recuperable y versionado.

El orden podrá ajustar detalles internos, pero no se inicia una fase dependiente sin cumplir la puerta de salida de su núcleo precedente.
