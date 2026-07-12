FROM rust:1-bookworm AS wasm
WORKDIR /src
RUN cargo install wasm-pack --locked
RUN rustup target add wasm32-unknown-unknown
COPY Cargo.toml ./
COPY crates/ ./crates/
RUN wasm-pack build crates/office-wasm --release --target web --out-dir /out/wasm --out-name office_wasm

FROM node:22-alpine AS web
WORKDIR /src
RUN corepack enable && corepack prepare pnpm@11.12.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/engine-client/package.json packages/engine-client/package.json
RUN pnpm install --frozen-lockfile
COPY apps/web/ apps/web/
COPY packages/engine-client/ packages/engine-client/
COPY --from=wasm /out/wasm/ apps/web/public/wasm/
RUN pnpm build:web

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web /src/release/web /usr/share/nginx/html
EXPOSE 80
