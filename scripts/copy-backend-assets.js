/**
 * Copy non-TypeScript assets (e.g. the SQLite schema.sql) from
 * `apps/backend/src` into `apps/backend/dist` after the TypeScript build,
 * preserving the directory structure.
 *
 * Run as part of the `@farm/backend` build script.
 */

import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(here, "..", "apps", "backend");
const srcRoot = join(backendRoot, "src");
const distRoot = join(backendRoot, "dist");

/** Files to copy, relative to `srcRoot`. */
const ASSETS = ["db/schema.sql"];

let copied = 0;
for (const rel of ASSETS) {
  const from = join(srcRoot, rel);
  const to = join(distRoot, rel);
  try {
    statSync(from);
  } catch {
    console.warn(`[copy-assets] source not found, skipping: ${from}`);
    continue;
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`[copy-assets] ${rel} -> ${to}`);
  copied += 1;
}

console.log(`[copy-assets] copied ${copied} asset(s).`);
