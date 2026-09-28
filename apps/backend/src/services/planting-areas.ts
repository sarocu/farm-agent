/**
 * @farm/backend — Planting areas service.
 *
 * CRUD for the `planting_areas` table. The polygon `boundary` (array of
 * geo points) and `cropIds` list are stored as JSON text columns.
 */

import type { Database } from "../db/index.js";
import type { GeoPoint, Identifier, PlantingArea } from "@farm/types";
import { generateId, nowIso, parseJsonColumn, toJsonColumn } from "./_shared.js";

interface PlantingAreaRow {
  id: string;
  name: string;
  code: string | null;
  area_square_meters: number | null;
  boundary: string | null;
  crop_ids: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePlantingAreaInput {
  name: string;
  code?: string;
  areaSquareMeters?: number;
  boundary?: GeoPoint[];
  cropIds?: Identifier[];
  notes?: string;
}

export interface UpdatePlantingAreaInput {
  name?: string;
  code?: string | null;
  areaSquareMeters?: number | null;
  boundary?: GeoPoint[] | null;
  cropIds?: Identifier[] | null;
  notes?: string | null;
}

function rowToPlantingArea(row: PlantingAreaRow): PlantingArea {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? undefined,
    areaSquareMeters: row.area_square_meters ?? undefined,
    boundary: parseJsonColumn<GeoPoint[]>(row.boundary),
    cropIds: parseJsonColumn<Identifier[]>(row.crop_ids),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPlantingAreasService(db: Database) {
  const stmtAll = db.prepare<[], PlantingAreaRow>(
    `SELECT * FROM planting_areas ORDER BY created_at DESC`,
  );
  const stmtById = db.prepare<[string], PlantingAreaRow>(
    `SELECT * FROM planting_areas WHERE id = ?`,
  );

  function list(): PlantingArea[] {
    return stmtAll.all().map(rowToPlantingArea);
  }

  function getById(id: string): PlantingArea | undefined {
    const row = stmtById.get(id);
    return row ? rowToPlantingArea(row) : undefined;
  }

  function create(input: CreatePlantingAreaInput): PlantingArea {
    const id = generateId();
    const ts = nowIso();
    db.prepare(
      `INSERT INTO planting_areas
        (id, name, code, area_square_meters, boundary, crop_ids, notes, created_at, updated_at)
       VALUES (@id, @name, @code, @area_square_meters, @boundary, @crop_ids, @notes, @created_at, @updated_at)`,
    ).run({
      id,
      name: input.name,
      code: input.code ?? null,
      area_square_meters: input.areaSquareMeters ?? null,
      boundary: toJsonColumn(input.boundary),
      crop_ids: toJsonColumn(input.cropIds),
      notes: input.notes ?? null,
      created_at: ts,
      updated_at: ts,
    });
    const created = getById(id);
    if (!created) throw new Error(`Failed to read back planting area ${id}`);
    return created;
  }

  function update(id: string, input: UpdatePlantingAreaInput): PlantingArea | undefined {
    const existing = stmtById.get(id);
    if (!existing) return undefined;
    const ts = nowIso();
    const merged: PlantingAreaRow = {
      ...existing,
      name: input.name ?? existing.name,
      code: input.code === null ? null : input.code ?? existing.code,
      area_square_meters:
        input.areaSquareMeters === null ? null : input.areaSquareMeters ?? existing.area_square_meters,
      boundary: input.boundary === null ? null : toJsonColumn(input.boundary) ?? existing.boundary,
      crop_ids: input.cropIds === null ? null : toJsonColumn(input.cropIds) ?? existing.crop_ids,
      notes: input.notes === null ? null : input.notes ?? existing.notes,
      updated_at: ts,
    };
    db.prepare(
      `UPDATE planting_areas SET
        name = @name, code = @code, area_square_meters = @area_square_meters,
        boundary = @boundary, crop_ids = @crop_ids, notes = @notes, updated_at = @updated_at
       WHERE id = @id`,
    ).run(merged);
    return getById(id);
  }

  function remove(id: string): boolean {
    const result = db.prepare(`DELETE FROM planting_areas WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  /** Assign a crop to a planting area (idempotent). */
  function assignCrop(id: string, cropId: Identifier): PlantingArea | undefined {
    const area = getById(id);
    if (!area) return undefined;
    const crops = new Set(area.cropIds ?? []);
    crops.add(cropId);
    return update(id, { cropIds: [...crops] });
  }

  /** Remove a crop from a planting area. */
  function unassignCrop(id: string, cropId: Identifier): PlantingArea | undefined {
    const area = getById(id);
    if (!area) return undefined;
    const crops = (area.cropIds ?? []).filter((c) => c !== cropId);
    return update(id, { cropIds: crops });
  }

  function all(): PlantingArea[] {
    return stmtAll.all().map(rowToPlantingArea);
  }

  return { list, getById, create, update, remove, assignCrop, unassignCrop, all };
}

export type PlantingAreasService = ReturnType<typeof createPlantingAreasService>;
