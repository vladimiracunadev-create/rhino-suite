import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const optional = process.argv.includes("--optional");
const result = spawnSync("wasm-pack", ["--version"], { stdio: "ignore" });

if (result.status !== 0) {
  const message = "wasm-pack no está instalado. Instale Rust, el target wasm32-unknown-unknown y wasm-pack.";
  if (optional) {
    console.warn(`[build:wasm] ${message} Se conservará el motor TypeScript de respaldo.`);
    process.exit(0);
  }
  console.error(`[build:wasm] ${message}`);
  process.exit(1);
}

const outDir = resolve("apps/web/public/wasm");
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const build = spawnSync(
  "wasm-pack",
  [
    "build",
    "crates/office-wasm",
    "--release",
    "--target",
    "web",
    "--out-dir",
    outDir,
    "--out-name",
    "office_wasm"
  ],
  { stdio: "inherit" }
);

process.exit(build.status ?? 1);
