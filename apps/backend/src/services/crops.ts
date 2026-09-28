/**
 * @farm/backend — Crops service.
 *
 * CRUD operations for the `crops` table, mapping between the flat SQLite rows
 * and the {@link Crop} domain type from `@farm/types`.
 */

import type { Database } from "../db/index.js";
import type { Crop, CropCategory, CropStatus } from "@farm/types";
import { generateId, nowIso } from "./_shared.js";

/** Database row shape for the `crops` table. */
interface CropRow {
  id: string;
  name: string;
  variety: string;
  category: string;
  status: string;
  days_to_maturity: number | null;
  planted_on: string | null;
  harvested_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCropInput {
  name: string;
  variety: string;
  category?: CropCategory;
  status?: CropStatus;
  daysToMaturity?: number;
  plantedOn?: string;
  harvestedOn?: string;
  notes?: string;
}

export interface UpdateCropInput {
  name?: string;
  variety?: string;
  category?: CropCategory;
  status?: CropStatus;
  daysToMaturity?: number | null;
  plantedOn?: string | null;
  harvestedOn?: string | null;
  notes?: string | null;
}

function rowToCrop(row: CropRow): Crop {
  return {
    id: row.id,
    name: row.name,
    variety: row.variety,
    category: row.category as CropCategory,
    status: row.status as CropStatus,
    daysToMaturity: row.days_to_maturity ?? undefined,
    plantedOn: row.planted_on ?? undefined,
    harvestedOn: row.harvested_on ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CropFilters {
  status?: CropStatus;
  category?: CropCategory;
}

export function createCropsService(db: Database) {
  const stmtAll = db.prepare<[], CropRow>(`SELECT * FROM crops ORDER BY created_at DESC`);
  const stmtById = db.prepare<[string], CropRow>(`SELECT * FROM crops WHERE id = ?`);
  const stmtByStatus = db.prepare<[string], CropRow>(
    `SELECT * FROM crops WHERE status = ? ORDER BY created_at DESC`,
  );
  const stmtByCategory = db.prepare<[string], CropRow>(
    `SELECT * FROM crops WHERE category = ? ORDER BY created_at DESC`,
  );
  const stmtByStatusAndCategory = db.prepare<[string, string], CropRow>(
    `SELECT * FROM crops WHERE status = ? AND category = ? ORDER BY created_at DESC`,
  );

  function list(filters: CropFilters = {}): Crop[] {
    if (filters.status && filters.category) {
      return stmtByStatusAndCategory.all(filters.status, filters.category).map(rowToCrop);
    }
    if (filters.status) {
      return stmtByStatus.all(filters.status).map(rowToCrop);
    }
    if (filters.category) {
      return stmtByCategory.all(filters.category).map(rowToCrop);
    }
    return stmtAll.all().map(rowToCrop);
  }

  function getById(id: string): Crop | undefined {
    const row = stmtById.get(id);
    return row ? rowToCrop(row) : undefined;
  }

  function create(input: CreateCropInput): Crop {
    const id = generateId();
    const ts = nowIso();
    db.prepare(
      `INSERT INTO crops
        (id, name, variety, category, status, days_to_maturity, planted_on, harvested_on, notes, created_at, updated_at)
       VALUES (@id, @name, @variety, @category, @status, @days_to_maturity, @planted_on, @harvested_on, @notes, @created_at, @updated_at)`,
    ).run({
      id,
      name: input.name,
      variety: input.variety,
      category: input.category ?? "other",
      status: input.status ?? "planned",
      days_to_maturity: input.daysToMaturity ?? null,
      planted_on: input.plantedOn ?? null,
      harvested_on: input.harvestedOn ?? null,
      notes: input.notes ?? null,
      created_at: ts,
      updated_at: ts,
    });
    const created = getById(id);
    if (!created) throw new Error(`Failed to read back crop ${id}`);
    return created;
  }

  function update(id: string, input: UpdateCropInput): Crop | undefined {
    const existing = stmtById.get(id);
    if (!existing) return undefined;
    const ts = nowIso();
    const merged: CropRow = {
      ...existing,
      name: input.name ?? existing.name,
      variety: input.variety ?? existing.variety,
      category: input.category ?? existing.category,
      status: input.status ?? existing.status,
      days_to_maturity:
        input.daysToMaturity === null ? null : input.daysToMaturity ?? existing.days_to_maturity,
      planted_on: input.plantedOn === null ? null : input.plantedOn ?? existing.planted_on,
      harvested_on: input.harvestedOn === null ? null : input.harvestedOn ?? existing.harvested_on,
      notes: input.notes === null ? null : input.notes ?? existing.notes,
      updated_at: ts,
    };
    db.prepare(
      `UPDATE crops SET
        name = @name, variety = @variety, category = @category, status = @status,
        days_to_maturity = @days_to_maturity, planted_on = @planted_on,
        harvested_on = @harvested_on, notes = @notes, updated_at = @updated_at
       WHERE id = @id`,
    ).run(merged);
    return getById(id);
  }

  function remove(id: string): boolean {
    const result = db.prepare(`DELETE FROM crops WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  /** Return every crop (used by the search indexer). */
  function all(): Crop[] {
    return stmtAll.all().map(rowToCrop);
  }

  return { list, getById, create, update, remove, all };
}

export type CropsService = ReturnType<typeof createCropsService>;
