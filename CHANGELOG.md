# Changelog

## 0.7.0-phase.2.5 — 2026-07-15

Unidad de archivos, cuentas y compartición: el editor pasa de ser una pantalla
suelta a un producto donde los documentos tienen dónde vivir y de quién ser.

### Cuentas y compartición

- Alta y entrada con correo y contraseña. Argon2id con sal por contraseña y
  comparación en tiempo constante; sesión en cookie HttpOnly de la que solo se
  guarda el hash del token.
- Aislamiento por usuario en documentos y carpetas. Pedir uno ajeno responde
  404, no 403: un 403 confirmaría que existe.
- Compartir por correo con permiso de lectura o edición. Solo el dueño reparte
  acceso y solo él puede eliminar.
- Lo creado antes de que existieran las cuentas lo adopta la primera que se
  registra.

### Unidad de archivos

- Carpetas con navegación por ruta; eliminarlas no pierde contenido.
- Recientes, destacados y papelera con restauración.
- Búsqueda, orden, vista de cuadrícula y lista.
- Selección múltiple con acciones en lote y atajos de teclado.
- Arrastrar documentos a carpetas y menú contextual.
- Subida de DOCX y ODT desde la unidad, sin pasar por el editor.
- Descarga real a DOCX y ODT desde cada documento.

### Documentos

- Historial de versiones: instantánea por guardado (se conservan 40) y
  restauración que deja lo anterior como revisión nueva.
- Una URL por documento: recargar, compartir por enlace y botón atrás.

### Interfaz

- Rediseño de producto con tema claro y oscuro.
- Identidad propia: rinoceronte en SVG como marca.
- Idioma español e inglés en la unidad y el chrome.
- La barra del editor deja de tener scroll horizontal: sus 31 controles quedan
  visibles a la vez. Iconos SVG coherentes en lugar de glifos unicode dispares.
- Ajustes de idioma y modo visual accesibles desde la propia aplicación.

### Rendimiento

- El catálogo se lista con metadatos: el contenido de los documentos ya no se
  descarga para dibujar sus tarjetas. Medido con los documentos de prueba, el
  listado pasa de ~11 KB a 1,4 KB, y la diferencia crece con su tamaño.
- El extracto, el conteo y el texto de búsqueda se calculan una vez; antes se
  recorría el documento entero en cada render y en cada comparación al ordenar.

### Correcciones

- La API no podía escribir en su volumen: el contenedor corre como usuario no
  root y `/data` quedaba de root, así que todo guardado fallaba con 422.
- Un registro con contenido inválido se normalizaba a un documento fantasma que
  se colaba en el catálogo y podía subirse como basura.
- Al restaurar una versión, el registro y su contenido declaraban revisiones
  distintas y el editor mostraba la equivocada.
- Destacar o mover alteraba la fecha de modificación y reordenaba «Recientes».
- El título de la página seguía siendo el anterior al cambio de nombre.

### Dependencias

- Se añade `golang.org/x/crypto` (Argon2id), primera dependencia externa de la
  API. Derivar contraseñas a mano habría sido peor que depender de la
  implementación estándar.

## 0.6.0-phase.2.4 — 2026-07-12

- Schema v5 con revisión estructurada.
- Comentarios, respuestas, resolución y anclaje por rango.
- Marcadores e hipervínculos por run.
- Control de cambios con aceptación, rechazo y conflicto.
- Búsqueda en cuerpo, tablas, encabezados, pies y comentarios.
- Vista de impresión paginada.
- ZIP propio con lectura Store/Deflate y escritura Store.
- Importación/exportación DOCX y ODT inicial.
- Contrato TypeScript y Rust actualizado.
- Prueba ejecutable de 20 aserciones.

## 0.5.0-phase.2.3 — 2026-07-12

- Schema v4, secciones, columnas, encabezados, pies, saltos y composición avanzada.
