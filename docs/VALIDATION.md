# Validación

## TypeScript y web

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:ts
pnpm build:web
```

La Fase 2.4 prueba migración v4→v5, comentarios, marcadores, hipervínculos, búsqueda estructurada, control de cambios, aceptación/rechazo y round-trip básico DOCX/ODT.

Existe además un smoke test independiente:

```bash
# Compilar scripts/validate-phase24.ts junto con packages/engine-client/src
# y ejecutar el JavaScript resultante con Node.js.
```

## Go

```bash
gofmt -w apps/api
go vet ./apps/api/...
go test ./apps/api/...
go test -race ./apps/api/...
```

## Rust/WASM

```bash
cargo fmt --all
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
pnpm build:wasm
```

## Integración

```bash
docker compose up --build
curl http://localhost:8080/health
```
