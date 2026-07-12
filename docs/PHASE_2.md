# Fase 2 — Editor de documentos

## Estado

| Incremento | Estado |
|---|---|
| 2.1 Edición estructurada y paginación | Completado |
| 2.2 Estructuras enriquecidas | Completado |
| 2.3 Secciones y composición avanzada | Completado |
| 2.4 Revisión, impresión e intercambio | Completado |

## Alcance acumulado

### Edición y composición

- Modelo basado en bloques, runs, estilos y recursos.
- Entrada Unicode, `beforeinput`, IME, selección multipárrafo y portapapeles estructurado.
- Párrafos, títulos, listas, tablas, imágenes y saltos.
- Papel, orientación, márgenes, columnas, encabezados, pies y campos dinámicos.
- Numeración por sección, reglas keep y control de viudas/huérfanas.

### Revisión y referencias

- Schema v5 con migración automática desde v1-v4.
- Autor local y activación de control de cambios.
- Registro de cambios con estado pendiente, aceptado, rechazado o conflicto.
- Rechazo seguro del último cambio pendiente y rechazo global mediante instantáneas sanitizadas.
- Comentarios anclados a rangos, respuestas y estado resuelto.
- Marcadores con nombres únicos.
- Hipervínculos por run, separados del estilo visual.
- Búsqueda estructurada en cuerpo, tablas, encabezados, pies y comentarios.

### Impresión e intercambio

- Hoja de estilos de impresión que elimina la interfaz y conserva páginas.
- Escritor ZIP propio sin compresión para crear paquetes interoperables.
- Lector ZIP para método almacenado y Deflate mediante `DecompressionStream`.
- Exportación DOCX inicial: párrafos, títulos, estilos básicos, listas simples, tablas, saltos y configuración principal de página.
- Exportación ODT inicial: párrafos, títulos, listas simples y tablas.
- Importación básica DOCX/ODT al modelo schema v5.
- Metadatos de revisión conservados en partes auxiliares propias del paquete.

## Puerta de salida alcanzada

El editor puede crear, editar, paginar, revisar, imprimir, guardar, reabrir e intercambiar un subconjunto documentado de DOCX/ODT sin utilizar HTML como formato interno.

## Trabajo posterior

La fidelidad completa de OOXML/ODF, notas al pie, diccionario, control de cambios nativo de Office, PDF vectorial y accesibilidad exhaustiva se mantienen en la Fase 8 para evitar bloquear el inicio de la hoja de cálculo.
