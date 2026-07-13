# Contribuir a Rhino Suite

Gracias por tu interés. Esta guía describe el flujo de trabajo, las convenciones y las puertas de calidad del proyecto. Si es tu primera vez, empieza por la [Guía de arranque](docs/GETTING_STARTED.md).

## Principios

1. **Un solo repositorio evolutivo.** Cada cambio amplía lo anterior y mantiene las migraciones de formato.
2. **Las reglas del documento no dependen de la interfaz.** Nada de lógica del modelo en React o en el DOM.
3. **Paridad de motores.** Toda modificación del modelo interno que afecte al comportamiento debe reflejarse en Rust (`office-core`) y en el motor TypeScript (`engine-client`), conservando equivalencia semántica.
4. **Nada de atajos de edición.** No incorpores dependencias que sustituyan el objetivo de construir el motor (editores WYSIWYG de terceros, librerías DOCX, etc.).

## Flujo de trabajo

1. Crea una **rama corta** por cambio (`feat/…`, `fix/…`, `docs/…`, `refactor/…`).
2. Haz cambios pequeños y coherentes.
3. Ejecuta las puertas de validación (ver abajo) antes de abrir el PR.
4. Abre un Pull Request contra `main`. El CI debe quedar en verde.

## Convención de commits

Se usa [Conventional Commits](https://www.conventionalcommits.org/):

```
feat:     nueva funcionalidad
fix:      corrección de errores
test:     añadir o corregir pruebas
docs:     solo documentación
refactor: cambio interno sin alterar comportamiento
ci:       workflows / configuración de CI
chore:    tareas de mantenimiento
```

Ejemplo: `feat: numeración romana reiniciable por sección`.

## Reglas del modelo interno

Toda modificación del documento vivo debe:

- **Incluir migración** hacia adelante desde los schemas anteriores (v1…v(N-1) → vN).
- **Incluir prueba** que cubra la migración y el comportamiento nuevo.
- **Actualizar el contrato** en Rust y TypeScript cuando afecte a ambos motores.
- **Preservar las invariantes** documentadas en [INTERNAL_FORMAT.md](docs/INTERNAL_FORMAT.md) (offsets Unicode, referencias de sección, unicidad de marcadores, `revision` monótona, etc.).

## Estilo por lenguaje

| Lenguaje | Formato | Lint |
|---|---|---|
| Rust | `cargo fmt --all` | `cargo clippy --workspace --all-targets -- -D warnings` |
| Go | `gofmt -w apps/api` | `go vet ./apps/api/...` |
| TypeScript | Config del workspace | `pnpm typecheck` |

El CI verifica el formato con `cargo fmt --all --check` y `gofmt` + `git diff --exit-code`: **el código debe venir formateado**.

## Puertas de validación

Antes de abrir el PR, corre lo que aplique a tu cambio:

```bash
# Mínimo (web / TypeScript)
pnpm check                 # typecheck + test + build web

# Completo (si tocaste Rust)
pnpm check:full            # lo anterior + cargo test + build:wasm

# Go
pnpm test:go

# Smoke test de la fase
npx tsx scripts/validate-phase24.ts
```

Desglose por lenguaje en [VALIDATION.md](docs/VALIDATION.md).

## Qué corre el CI en tu PR

- **CI** (`ci.yml`) — web (typecheck, tests, build), rust-wasm (fmt/clippy/test/build WASM) y go (vet, test -race, build).
- **Security Scan** (`security.yml`) — CodeQL, Trojan Source y escaneo advisory de dependencias.
- **Workflow security** (`workflow-security.yml`) — actionlint, zizmor y verificación de que toda acción esté pinned a SHA.

Si añades o editas un workflow, **todas las acciones deben pinnearse a un SHA de 40 caracteres** con la versión humana en comentario:

```yaml
uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
```

## Checklist del Pull Request

- [ ] Rama corta y commits en formato Conventional Commits.
- [ ] Las reglas del modelo viven fuera de React/DOM.
- [ ] Si tocaste el modelo interno: migración + prueba + contrato Rust/TS.
- [ ] Formato y lint pasan localmente (`fmt`, `clippy`, `gofmt`, `typecheck`).
- [ ] Puertas de validación relevantes en verde.
- [ ] Documentación actualizada si el cambio la afecta (incluye marcadores de estado).
- [ ] CI en verde en el PR.

## Documentación

Si tu cambio afecta a la doc, actualízala en el mismo PR. Distingue siempre el **marcador de estado actual** (se sincroniza: "Fase 2.4", "schema v5") de la **referencia histórica** (se conserva: CHANGELOG, ADR). Ver la [convención de estado](docs/INDEX.md#convención-de-estado).

## Decisiones de arquitectura

Los cambios de alto impacto o irreversibles se registran como ADR en [`docs/adr/`](docs/adr/). Si propones uno, añade un archivo numerado siguiendo el formato existente.
