/**
 * @farm/backend — Aerial imagery service.
 *
 * CRUD for the `aerial_images` table. The geo `center` point and `bounds`
 * rectangle are stored as JSON text columns. Upload handling (writing the
 * file to disk via multer) lives in the REST route; this service owns the
 * metadata record.
 */

import type { Database } from "../db/index.js";
import type { AerialImage, GeoBounds, GeoPoint } from "@farm/types";
import { generateId, nowIso, parseJsonColumn, toJsonColumn } from "./_shared.js";

interface AerialRow {
  id: string;
  label: string | null;
  url: string;
  thumbnail_url: string | null;
  captured_at: string;
  center: string | null;
  bounds: string | null;
  meters_per_pixel: number | null;
  created_at: string;
}

export interface CreateAerialInput {
  label?: string;
  url: string;
  thumbnailUrl?: string;
  capturedAt: string;
  center?: GeoPoint;
  bounds?: GeoBounds;
  metersPerPixel?: number;
}

export interface UpdateAerialInput {
  label?: string | null;
  url?: string;
  thumbnailUrl?: string | null;
  capturedAt?: string;
  center?: GeoPoint | null;
  bounds?: GeoBounds | null;
  metersPerPixel?: number | null;
}

export interface AerialFilters {
  /** Inclusive lower bound on `captured_at` (ISO). */
  from?: string;
  /** Inclusive upper bound on `captured_at` (ISO). */
  to?: string;
}

function rowToAerial(row: AerialRow): AerialImage {
  return {
    id: row.id,
    label: row.label ?? undefined,
    url: row.url,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    capturedAt: row.captured_at,
    center: parseJsonColumn<GeoPoint>(row.center),
    bounds: parseJsonColumn<GeoBounds>(row.bounds),
    metersPerPixel: row.meters_per_pixel ?? undefined,
    createdAt: row.created_at,
  };
}

export function createAerialService(db: Database) {
  const stmtAll = db.prepare<[], AerialRow>(`SELECT * FROM aerial_images ORDER BY captured_at DESC`);
  const stmtById = db.prepare<[string], AerialRow>(`SELECT * FROM aerial_images WHERE id = ?`);

  function list(filters: AerialFilters = {}): AerialImage[] {
    if (!filters.from && !filters.to) {
      return stmtAll.all().map(rowToAerial);
    }
    const parts: string[] = [];
    const params: unknown[] = [];
    if (filters.from) {
      parts.push("captured_at >= ?");
      params.push(filters.from);
    }
    if (filters.to) {
      parts.push("captured_at <= ?");
      params.push(filters.to);
    }
    const rows = db
      .prepare<unknown[], AerialRow>(
        `SELECT * FROM aerial_images WHERE ${parts.join(" AND ")} ORDER BY captured_at DESC`,
      )
      .all(...params);
    return rows.map(rowToAerial);
  }

  function getById(id: string): AerialImage | undefined {
    const row = stmtById.get(id);
    return row ? rowToAerial(row) : undefined;
  }

  function create(input: CreateAerialInput): AerialImage {
    const id = generateId();
    const ts = nowIso();
    db.prepare(
      `INSERT INTO aerial_images
        (id, label, url, thumbnail_url, captured_at, center, bounds, meters_per_pixel, created_at)
       VALUES (@id, @label, @url, @thumbnail_url, @captured_at, @center, @bounds, @meters_per_pixel, @created_at)`,
    ).run({
      id,
      label: input.label ?? null,
      url: input.url,
      thumbnail_url: input.thumbnailUrl ?? null,
      captured_at: input.capturedAt,
      center: toJsonColumn(input.center),
      bounds: toJsonColumn(input.bounds),
      meters_per_pixel: input.metersPerPixel ?? null,
      created_at: ts,
    });
    const created = getById(id);
    if (!created) throw new Error(`Failed to read back aerial image ${id}`);
    return created;
  }

  function update(id: string, input: UpdateAerialInput): AerialImage | undefined {
    const existing = stmtById.get(id);
    if (!existing) return undefined;
    const merged: AerialRow = {
      ...existing,
      label: input.label === null ? null : input.label ?? existing.label,
      url: input.url ?? existing.url,
      thumbnail_url:
        input.thumbnailUrl === null ? null : input.thumbnailUrl ?? existing.thumbnail_url,
      captured_at: input.capturedAt ?? existing.captured_at,
      center: input.center === null ? null : toJsonColumn(input.center) ?? existing.center,
      bounds: input.bounds === null ? null : toJsonColumn(input.bounds) ?? existing.bounds,
      meters_per_pixel:
        input.metersPerPixel === null ? null : input.metersPerPixel ?? existing.meters_per_pixel,
    };
    db.prepare(
      `UPDATE aerial_images SET
        label = @label, url = @url, thumbnail_url = @thumbnail_url, captured_at = @captured_at,
        center = @center, bounds = @bounds, meters_per_pixel = @meters_per_pixel
       WHERE id = @id`,
    ).run(merged);
    return getById(id);
  }

  function remove(id: string): boolean {
    const result = db.prepare(`DELETE FROM aerial_images WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  function all(): AerialImage[] {
    return stmtAll.all().map(rowToAerial);
  }

  return { list, getById, create, update, remove, all };
}

export type AerialService = ReturnType<typeof createAerialService>;
