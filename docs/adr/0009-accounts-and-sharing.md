# ADR 0009 — Cuentas, sesión y compartición

- **Estado:** aceptada
- **Fecha:** 2026-07-15
- **Fase:** 2.5

## Contexto

Hasta la Fase 2.4 todos los documentos vivían en un espacio único: cualquiera
que abriera la web veía todo. Eso bastaba para probar el editor, pero no para
usarlo: no había forma de tener documentos propios ni de dar acceso a alguien.

Había que decidir cómo se identifica una persona, dónde vive su sesión y qué
significa compartir.

## Decisiones

### 1. Correo y contraseña, no enlaces mágicos ni OAuth

Los enlaces mágicos exigen un servidor SMTP configurado: sin él no se puede ni
entrar, y el proyecto debe poder levantarse con `docker compose up`. OAuth ata
el producto a un proveedor externo y obliga a registrar la aplicación y guardar
claves antes de poder iniciar sesión.

Correo y contraseña es autocontenido. El coste es que hay que guardar
contraseñas bien.

### 2. Argon2id, aunque rompa la regla de «sin dependencias externas»

La API no tenía ninguna dependencia y era un rasgo deliberado. Aquí se rompe a
propósito: la biblioteca estándar de Go 1.23 no trae ninguna función de
derivación de contraseñas adecuada, y escribir una a mano es peor que depender
de `golang.org/x/crypto`, que es la implementación estándar y auditada.

Se fija `x/crypto v0.31.0` porque las versiones recientes exigen Go 1.25 y el
repositorio está en 1.23.

Parámetros: 64 MiB de memoria, 1 pasada, 4 hilos. Son deliberadamente costosos:
encarecen la fuerza bruta si alguien se lleva el almacén.

### 3. La sesión en cookie HttpOnly, no en `localStorage`

Un token en `localStorage` es legible desde JavaScript, así que cualquier script
inyectado se lo lleva. En una cookie `HttpOnly` no lo es.

Del token solo se guarda su **hash**: leer el disco del servidor no da sesiones
utilizables. `Secure` se activa solo bajo HTTPS, porque en `http://localhost`
una cookie `Secure` no llegaría nunca y no se podría entrar.

### 4. Sin acceso se responde 404, no 403

Un `403` confirma que el documento existe. Para quien no tiene acceso, un
documento ajeno y uno inexistente deben ser indistinguibles.

Por lo mismo, `login` no distingue «el correo no existe» de «la contraseña es
incorrecta», y comprueba una contraseña igualmente cuando el correo no existe:
si no, el tiempo de respuesta delataría quién tiene cuenta.

### 5. La organización solo se cambia por sus endpoints

Carpeta, destacado, papelera, dueño y compartición **no se aceptan** al guardar
un documento: solo los cambian `move`, `star`, `trash`, `restore` y `share`.

Si se aceptaran al guardar, el autoguardado del editor —que no sabe nada de
carpetas— las borraría al mandar el documento sin ellas. Además, así los cambios
de metadatos no tienen que pelear con el control de concurrencia optimista.

### 6. La primera cuenta adopta lo que no tiene dueño

Los documentos creados antes de que existieran las cuentas se quedarían sin
dueño y, por tanto, invisibles para siempre. La primera cuenta que se registra
los adopta; después ya nadie puede reclamarlos, para que un segundo registro no
se lleve los documentos de otro.

## Consecuencias

- La API deja de ser utilizable sin sesión: el cliente comprueba la sesión antes
  de pedir nada, porque sin ella todo responde `401`.
- La compartición con permisos, que estaba prevista en la Fase 6, queda hecha;
  esa fase se reduce a la colaboración en tiempo real.
- Quedan fuera, y hacen falta antes de exponer esto a Internet: recuperación de
  contraseña, verificación de correo, limitación de intentos, rotación de sesión
  y HTTPS. Ver [SECURITY.md](../../SECURITY.md).
