# 🚀 Guía de arranque

De cero a Rhino Suite corriendo en tu máquina. Está pensada para desarrolladores; no se necesita experiencia previa con el proyecto.

## 1. Prerequisitos

El repositorio es políglota. **No todos los toolchains son obligatorios**: puedes trabajar solo en la web con Node/pnpm y usar el motor TypeScript de respaldo.

| Componente | Versión | Necesario para | Cómo verificar |
|---|---|---|---|
| **Node.js** | ≥ 22 | Interfaz web, scripts, smoke test | `node -v` |
| **pnpm** | 11.0.0 | Gestor del workspace JS/TS | `pnpm -v` |
| **Rust** | stable | Motor `office-core` y bindings WASM | `rustc --version` |
| target `wasm32-unknown-unknown` | — | Compilar a WebAssembly | `rustup target list --installed` |
| **wasm-pack** | reciente | Empaquetar el WASM para el navegador | `wasm-pack --version` |
| **Go** | 1.23.x | API de persistencia | `go version` |

Instalación de los toolchains opcionales:

```bash
# Rust + target WASM + wasm-pack
rustup toolchain install stable
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked

# pnpm (si no lo tienes) vía corepack
corepack enable
corepack prepare pnpm@11.0.0 --activate
```

> El campo `packageManager` del `package.json` fija pnpm **11.0.0**; usa esa versión para reproducir el CI.

## 2. Clonar e instalar

```bash
git clone https://github.com/vladimiracunadev-create/rhino-suite.git
cd rhino-suite
pnpm install
```

`pnpm install` instala solo el workspace JS/TS (`apps/web` + `packages/*`). Rust y Go se compilan bajo demanda con sus propias herramientas.

## 3. Ejecutar

### Interfaz web (camino rápido, sin Rust)

```bash
pnpm dev
```

Vite levanta la app en `http://localhost:5173`. Si no hay un artefacto WASM presente, el editor usa automáticamente **`packages/engine-client`** (el motor TypeScript compatible), de modo que puedes desarrollar la UI sin el toolchain de Rust.

### API Go (opcional, persistencia)

```bash
pnpm dev:api
```

Levanta el servicio en `http://localhost:8080`. Variables de entorno relevantes (ver [`.env.example`](../.env.example)):

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` | `8080` | Puerto de escucha |
| `DATA_DIR` | `./apps/api/data` | Directorio de almacenamiento de documentos |
| `WEB_ORIGIN` | `http://localhost:5173` | Origen permitido por CORS (el dev server de Vite) |

> En Docker, `docker-compose.yml` sobrescribe `WEB_ORIGIN` a `http://localhost:8088`, que es donde Nginx sirve la web.

Comprobación rápida:

```bash
curl http://localhost:8080/health
```

Referencia completa de endpoints en [API.md](API.md).

## 4. Construir

```bash
pnpm build            # WASM (si hay toolchain) + build web de producción
pnpm build:web        # solo la web
pnpm build:wasm       # solo el paquete WebAssembly (requiere Rust + wasm-pack)
```

`pnpm build` usa `build:wasm:optional`: si falta el toolchain de Rust, **conserva el motor TypeScript de respaldo** en lugar de fallar.

## 5. Probar y validar

```bash
pnpm test             # tests TypeScript + Go
pnpm test:ts          # solo TypeScript (Vitest)
pnpm test:go          # solo Go
pnpm test:rust        # solo Rust (cargo test --workspace)
pnpm typecheck        # typecheck de todo el workspace TS

# Smoke test de la Fase 2.4 (20 aserciones, sin dependencias externas)
npx tsx scripts/validate-phase24.ts

# Puertas completas (equivalente a lo que corre el CI)
pnpm check            # typecheck + test + build web
pnpm check:full       # check + test:rust + build:wasm
```

Ver [VALIDATION.md](VALIDATION.md) para el desglose por lenguaje.

## 6. Docker (stack web + API)

```bash
docker compose up --build
```

Publica la web en `http://localhost:8088` (Nginx) contra la API Go. La imagen de la API es `distroless/static` (sin shell), pensada para superficie mínima.

## 7. Catálogo de scripts

| Script | Qué hace |
|---|---|
| `pnpm dev` / `dev:web` | Servidor de desarrollo Vite |
| `pnpm dev:api` | API Go en local |
| `pnpm build` | Build de producción (WASM opcional + web) |
| `pnpm build:wasm` / `build:wasm:optional` | Empaqueta el WASM (falla / degrada si falta Rust) |
| `pnpm test` / `test:ts` / `test:go` / `test:rust` | Suites de prueba por lenguaje |
| `pnpm typecheck` | Typecheck del workspace TS |
| `pnpm check` / `check:full` | Puertas de validación |
| `pnpm format:rust` | `cargo fmt --all` |

## 8. Resolución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `pnpm dev` funciona pero no hay motor WASM | Falta el toolchain de Rust | Es esperado: se usa el motor TypeScript. Para WASM, instala Rust + wasm-pack. |
| `build:wasm` falla con *"Bulk memory operations require bulk memory"* | `wasm-opt` validando en MVP | Ya resuelto en `crates/office-wasm/Cargo.toml` habilitando las features post-MVP. |
| El navegador no llega a la API | CORS | Ajusta `WEB_ORIGIN` al origen real de la web. |
| `pnpm install` usa otra versión de pnpm | Discrepancia con `packageManager` | Usa pnpm **11.0.0** (`corepack prepare pnpm@11.0.0 --activate`). |

## Siguientes pasos

- [Arquitectura](ARCHITECTURE.md) — cómo encajan las capas.
- [Formato interno](INTERNAL_FORMAT.md) — el documento vivo (schema v5).
- [CONTRIBUTING](../CONTRIBUTING.md) — flujo de trabajo y convenciones.
