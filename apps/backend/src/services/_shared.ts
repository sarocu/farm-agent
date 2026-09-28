/**
 * @farm/backend — shared service-layer helpers.
 */

import { randomUUID } from "node:crypto";

/** Generate a new unique identifier. */
export function generateId(): string {
  return randomUUID();
}

/** Current time as an ISO 8601 string. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Parse a JSON column value, returning `undefined` for NULL/empty. */
export function parseJsonColumn<T>(value: string | null | undefined): T | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

/** Serialise a value for a JSON column, returning `null` for `undefined`. */
export function toJsonColumn(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

/** Coerce a SQLite integer (0/1) to a boolean. */
export function toBool(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

/** Coerce a boolean to a SQLite integer (0/1). */
export function fromBool(value: boolean | undefined | null): number {
  return value ? 1 : 0;
}

/**
 * Parse a list query string into an array of strings.
 * Accepts comma-separated values, e.g. `"a,b,c"` -> `["a","b","c"]`.
 * Empty/whitespace entries are dropped.
 */
export function parseList(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
