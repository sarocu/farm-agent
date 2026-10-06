/**
 * @farm/backend — SQLite database access.
 *
 * Exports {@link openDatabase}, which opens (or creates) a SQLite database,
 * applies the schema, and returns the `Database` instance plus a few helpers.
 */

import Database from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Database as DatabaseType } from "better-sqlite3";
import type { BackendConfig } from "../config.js";

/**
 * Locate the `schema.sql` file shipped alongside this module.
 *
 * When running the compiled output the file may live next to the compiled JS
 * (if copied) or in the sibling `src` directory; we check both so the helper
 * works in development and after a production build.
 */
function locateSchema(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "schema.sql"),
    join(here, "src", "schema.sql"),
    join(dirname(here), "src", "db", "schema.sql"),
    resolve(process.cwd(), "apps/backend/src/db/schema.sql"),
    resolve(process.cwd(), "src/db/schema.sql"),
  ];
  for (const candidate of candidates) {
    try {
      readFileSync(candidate, "utf8");
      return candidate;
    } catch {
      // try the next candidate
    }
  }
  throw new Error(
    "Could not locate schema.sql. Looked in:\n" +
      candidates.map((c) => "  - " + c).join("\n"),
  );
}

/** Apply the schema (idempotent — all statements use `CREATE ... IF NOT EXISTS`). */
export function applySchema(db: DatabaseType): void {
  const schemaPath = locateSchema();
  const sql = readFileSync(schemaPath, "utf8");
  db.exec(sql);
}

export interface OpenDatabaseResult {
  db: DatabaseType;
  close: () => void;
}

/**
 * Open a SQLite database at `config.databasePath` and apply the schema.
 *
 * Pass an explicit `databasePath` to override the configured path (useful for
 * tests or an in-memory database via `:memory:`).
 */
export function openDatabase(
  config: Pick<BackendConfig, "databasePath">,
  databasePath?: string,
): OpenDatabaseResult {
  const path = databasePath ?? config.databasePath;
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  applySchema(db);

  return {
    db,
    close: () => db.close(),
  };
}

export type { DatabaseType as Database };
