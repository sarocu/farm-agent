/**
 * @farm/backend — Search service.
 *
 * A unified search facade over the domain entities. On startup (or on
 * demand) it pushes documents into Meilisearch via {@link MeiliSearchClient};
 * queries are served from Meilisearch when it is reachable, and fall back to
 * a SQL `LIKE` search over the database otherwise.
 */

import type { Database } from "../db/index.js";
import type { AerialImage, Crop, Customer, FarmEvent, PlantingArea } from "@farm/types";
import { meili } from "../search/meili.js";
import {
  createAerialService,
  createCropsService,
  createCustomersService,
  createEventsService,
  createPlantingAreasService,
} from "./index.js";

/** The set of entity kinds that can be searched. */
export type SearchKind = "crops" | "customers" | "events" | "aerial" | "planting_areas" | "all";

export interface SearchRequest {
  query: string;
  kind?: SearchKind;
  limit?: number;
}

export interface SearchHit {
  kind: Exclude<SearchKind, "all">;
  id: string;
  /** The full entity document, or a subset when sourced from Meilisearch. */
  document: unknown;
  /** Relevance score when served from Meilisearch, otherwise undefined. */
  score?: number;
}

export interface SearchResponse {
  query: string;
  kind: SearchKind;
  total: number;
  hits: SearchHit[];
  source: "meilisearch" | "sql";
}

interface MeiliHit {
  id: string;
  [key: string]: unknown;
}

const SEARCHABLE_KINDS = ["crops", "customers", "events", "aerial", "planting_areas"] as const;
type SearchableKind = (typeof SEARCHABLE_KINDS)[number];

interface IndexDef {
  primaryKey?: string;
  searchableAttributes?: string[];
  filterableAttributes?: string[];
  sortableAttributes?: string[];
}

const INDEX_DEFS: Record<SearchableKind, IndexDef> = {
  crops: {
    primaryKey: "id",
    searchableAttributes: ["name", "variety", "category", "status", "notes"],
    filterableAttributes: ["status", "category"],
    sortableAttributes: ["createdAt"],
  },
  customers: {
    primaryKey: "id",
    searchableAttributes: ["name", "email", "phone", "notes"],
    filterableAttributes: ["isMember"],
    sortableAttributes: ["createdAt"],
  },
  events: {
    primaryKey: "id",
    searchableAttributes: ["title", "description", "kind", "location"],
    filterableAttributes: ["kind", "visibility"],
    sortableAttributes: ["startsAt"],
  },
  aerial: {
    primaryKey: "id",
    searchableAttributes: ["label", "url"],
    filterableAttributes: [],
    sortableAttributes: ["capturedAt"],
  },
  planting_areas: {
    primaryKey: "id",
    searchableAttributes: ["name", "code", "notes"],
    filterableAttributes: [],
    sortableAttributes: ["createdAt"],
  },
};

export function createSearchService(db: Database) {
  const crops = createCropsService(db);
  const customers = createCustomersService(db);
  const events = createEventsService(db);
  const aerial = createAerialService(db);
  const plantingAreas = createPlantingAreasService(db);

  /** Ensure all Meilisearch indexes exist with the right settings. */
  async function ensureIndexes(): Promise<void> {
    await Promise.all(
      SEARCHABLE_KINDS.map((kind) => meili.ensureIndex(kind, INDEX_DEFS[kind])),
    );
  }

  /** Re-index every entity type from the database into Meilisearch. */
  async function reindexAll(): Promise<void> {
    await ensureIndexes();
    await Promise.all([
      meili.indexDocuments<SearchHitDoc>("crops", toCropDocs(crops.all())),
      meili.indexDocuments<SearchHitDoc>("customers", toCustomerDocs(customers.all())),
      meili.indexDocuments<SearchHitDoc>("events", toEventDocs(events.all())),
      meili.indexDocuments<SearchHitDoc>("aerial", toAerialDocs(aerial.all())),
      meili.indexDocuments<SearchHitDoc>("planting_areas", toPlantingAreaDocs(plantingAreas.all())),
    ]);
  }

  /** Index a single entity after a create/update. */
  async function indexOne(kind: SearchableKind, document: SearchHitDoc): Promise<void> {
    await meili.indexDocuments<SearchHitDoc>(kind, [document]);
  }

  /** Remove a single entity from the index after a delete. */
  async function removeOne(kind: SearchableKind, id: string): Promise<void> {
    await meili.deleteDocuments(kind, [id]);
  }

  /** Run a search across one or all kinds. */
  async function search(request: SearchRequest): Promise<SearchResponse> {
    const query = request.query ?? "";
    const limit = request.limit ?? 20;
    const kind = request.kind ?? "all";
    const kinds: SearchableKind[] = kind === "all" ? [...SEARCHABLE_KINDS] : [kind];

    if (await meili.ping()) {
      const perKind = kind === "all" ? Math.max(1, Math.ceil(limit / kinds.length)) : limit;
      const results = await Promise.all(
        kinds.map((k) => meili.search<MeiliHit>(k, { query, limit: perKind })),
      );
      const hits: SearchHit[] = [];
      for (let i = 0; i < kinds.length; i++) {
        const k = kinds[i]!;
        const res = results[i]!;
        for (const hit of res.hits) {
          hits.push({ kind: k, id: String(hit.id), document: hit });
        }
      }
      const trimmed = hits.slice(0, limit);
      return {
        query,
        kind,
        total: trimmed.length,
        hits: trimmed,
        source: "meilisearch",
      };
    }

    // SQL fallback when Meilisearch is unavailable.
    const hits = sqlSearch(query, kinds, limit);
    return { query, kind, total: hits.length, hits, source: "sql" };
  }

  function sqlSearch(query: string, kinds: SearchableKind[], limit: number): SearchHit[] {
    const like = `%${query}%`;
    const hits: SearchHit[] = [];
    const perKind = kinds.length === 1 ? limit : Math.max(1, Math.ceil(limit / kinds.length));

    if (kinds.includes("crops")) {
      const rows = db
        .prepare<{ q: string }, CropRow>(
          `SELECT * FROM crops WHERE name LIKE @q OR variety LIKE @q OR notes LIKE @q
           ORDER BY created_at DESC LIMIT ${perKind}`,
        )
        .all({ q: like })
        .map(rowToCropDoc);
      pushHits(hits, "crops", rows);
    }
    if (kinds.includes("customers")) {
      const rows = db
        .prepare<{ q: string }, CustomerRow>(
          `SELECT * FROM customers WHERE name LIKE @q OR email LIKE @q OR phone LIKE @q OR notes LIKE @q
           ORDER BY created_at DESC LIMIT ${perKind}`,
        )
        .all({ q: like })
        .map(rowToCustomerDoc);
      pushHits(hits, "customers", rows);
    }
    if (kinds.includes("events")) {
      const rows = db
        .prepare<{ q: string }, EventRow>(
          `SELECT * FROM events WHERE title LIKE @q OR description LIKE @q OR location LIKE @q
           ORDER BY starts_at DESC LIMIT ${perKind}`,
        )
        .all({ q: like })
        .map(rowToEventDoc);
      pushHits(hits, "events", rows);
    }
    if (kinds.includes("aerial")) {
      const rows = db
        .prepare<{ q: string }, AerialRow>(
          `SELECT * FROM aerial_images WHERE label LIKE @q OR url LIKE @q
           ORDER BY captured_at DESC LIMIT ${perKind}`,
        )
        .all({ q: like })
        .map(rowToAerialDoc);
      pushHits(hits, "aerial", rows);
    }
    if (kinds.includes("planting_areas")) {
      const rows = db
        .prepare<{ q: string }, PlantingAreaRow>(
          `SELECT * FROM planting_areas WHERE name LIKE @q OR code LIKE @q OR notes LIKE @q
           ORDER BY created_at DESC LIMIT ${perKind}`,
        )
        .all({ q: like })
        .map(rowToPlantingAreaDoc);
      pushHits(hits, "planting_areas", rows);
    }
    return hits.slice(0, limit);
  }

  return { ensureIndexes, reindexAll, indexOne, removeOne, search };
}

function pushHits(hits: SearchHit[], kind: SearchableKind, docs: SearchHitDoc[]): void {
  for (const doc of docs) {
    hits.push({ kind, id: doc.id, document: doc });
  }
}

// ---------------------------------------------------------------------------
// Document mappers — turn domain entities into the documents stored in
// Meilisearch, plus the row mappers used by the SQL fallback.
// ---------------------------------------------------------------------------

interface SearchHitDoc {
  id: string;
  [key: string]: unknown;
}

function toCropDocs(list: Crop[]): SearchHitDoc[] {
  return list.map((c) => ({
    id: c.id,
    name: c.name,
    variety: c.variety,
    category: c.category,
    status: c.status,
    daysToMaturity: c.daysToMaturity,
    plantedOn: c.plantedOn,
    harvestedOn: c.harvestedOn,
    notes: c.notes,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

function toCustomerDocs(list: Customer[]): SearchHitDoc[] {
  return list.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    address: c.address,
    isMember: c.isMember,
    notes: c.notes,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}

function toEventDocs(list: FarmEvent[]): SearchHitDoc[] {
  return list.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    kind: e.kind,
    visibility: e.visibility,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    location: e.location,
    capacity: e.capacity,
    attendeeIds: e.attendeeIds,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }));
}

function toAerialDocs(list: AerialImage[]): SearchHitDoc[] {
  return list.map((a) => ({
    id: a.id,
    label: a.label,
    url: a.url,
    thumbnailUrl: a.thumbnailUrl,
    capturedAt: a.capturedAt,
    center: a.center,
    bounds: a.bounds,
    metersPerPixel: a.metersPerPixel,
    createdAt: a.createdAt,
  }));
}

function toPlantingAreaDocs(list: PlantingArea[]): SearchHitDoc[] {
  return list.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    areaSquareMeters: p.areaSquareMeters,
    boundary: p.boundary,
    cropIds: p.cropIds,
    notes: p.notes,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

// --- Raw (snake_case) row interfaces for the SQL fallback ------------------

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
interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  is_member: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
interface EventRow {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  visibility: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  capacity: number | null;
  attendee_ids: string | null;
  created_at: string;
  updated_at: string;
}
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

function parseJson<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function rowToCropDoc(row: CropRow): SearchHitDoc {
  return {
    id: row.id,
    name: row.name,
    variety: row.variety,
    category: row.category,
    status: row.status,
    daysToMaturity: row.days_to_maturity ?? undefined,
    plantedOn: row.planted_on ?? undefined,
    harvestedOn: row.harvested_on ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToCustomerDoc(row: CustomerRow): SearchHitDoc {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    address: parseJson(row.address),
    isMember: row.is_member === 1,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToEventDoc(row: EventRow): SearchHitDoc {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    kind: row.kind,
    visibility: row.visibility,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location ?? undefined,
    capacity: row.capacity ?? undefined,
    attendeeIds: parseJson<string[]>(row.attendee_ids),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAerialDoc(row: AerialRow): SearchHitDoc {
  return {
    id: row.id,
    label: row.label ?? undefined,
    url: row.url,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    capturedAt: row.captured_at,
    center: parseJson(row.center),
    bounds: parseJson(row.bounds),
    metersPerPixel: row.meters_per_pixel ?? undefined,
    createdAt: row.created_at,
  };
}

function rowToPlantingAreaDoc(row: PlantingAreaRow): SearchHitDoc {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? undefined,
    areaSquareMeters: row.area_square_meters ?? undefined,
    boundary: parseJson(row.boundary),
    cropIds: parseJson<string[]>(row.crop_ids),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type SearchService = ReturnType<typeof createSearchService>;
