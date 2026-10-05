/**
 * @farm/backend — Events service.
 *
 * CRUD for the `events` table. The `attendeeIds` list is stored as a JSON
 * text column.
 */

import type { Database } from "../db/index.js";
import type { EventKind, EventVisibility, FarmEvent, Identifier } from "@farm/types";
import { generateId, nowIso, parseJsonColumn, toJsonColumn } from "./_shared.js";

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

export interface CreateEventInput {
  title: string;
  description?: string;
  kind?: EventKind;
  visibility?: EventVisibility;
  startsAt: string;
  endsAt: string;
  location?: string;
  capacity?: number;
  attendeeIds?: Identifier[];
}

export interface UpdateEventInput {
  title?: string;
  description?: string | null;
  kind?: EventKind;
  visibility?: EventVisibility;
  startsAt?: string;
  endsAt?: string;
  location?: string | null;
  capacity?: number | null;
  attendeeIds?: Identifier[] | null;
}

export interface EventFilters {
  kind?: EventKind;
  visibility?: EventVisibility;
  /** Inclusive lower bound on `starts_at` (ISO). */
  from?: string;
  /** Inclusive upper bound on `starts_at` (ISO). */
  to?: string;
}

function rowToEvent(row: EventRow): FarmEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    kind: row.kind as EventKind,
    visibility: row.visibility as EventVisibility,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location ?? undefined,
    capacity: row.capacity ?? undefined,
    attendeeIds: parseJsonColumn<Identifier[]>(row.attendee_ids),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildWhere(filters: EventFilters): { clause: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  if (filters.kind) {
    parts.push("kind = ?");
    params.push(filters.kind);
  }
  if (filters.visibility) {
    parts.push("visibility = ?");
    params.push(filters.visibility);
  }
  if (filters.from) {
    parts.push("starts_at >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    parts.push("starts_at <= ?");
    params.push(filters.to);
  }
  return { clause: parts.length ? "WHERE " + parts.join(" AND ") : "", params };
}

export function createEventsService(db: Database) {
  const stmtAll = db.prepare<[], EventRow>(`SELECT * FROM events ORDER BY starts_at ASC`);
  const stmtById = db.prepare<[string], EventRow>(`SELECT * FROM events WHERE id = ?`);

  function list(filters: EventFilters = {}): FarmEvent[] {
    if (!filters.kind && !filters.visibility && !filters.from && !filters.to) {
      return stmtAll.all().map(rowToEvent);
    }
    const { clause, params } = buildWhere(filters);
    const rows = db.prepare<unknown[], EventRow>(`SELECT * FROM events ${clause} ORDER BY starts_at ASC`).all(...params);
    return rows.map(rowToEvent);
  }

  function getById(id: string): FarmEvent | undefined {
    const row = stmtById.get(id);
    return row ? rowToEvent(row) : undefined;
  }

  function create(input: CreateEventInput): FarmEvent {
    const id = generateId();
    const ts = nowIso();
    db.prepare(
      `INSERT INTO events
        (id, title, description, kind, visibility, starts_at, ends_at, location, capacity, attendee_ids, created_at, updated_at)
       VALUES (@id, @title, @description, @kind, @visibility, @starts_at, @ends_at, @location, @capacity, @attendee_ids, @created_at, @updated_at)`,
    ).run({
      id,
      title: input.title,
      description: input.description ?? null,
      kind: input.kind ?? "other",
      visibility: input.visibility ?? "public",
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      location: input.location ?? null,
      capacity: input.capacity ?? null,
      attendee_ids: toJsonColumn(input.attendeeIds),
      created_at: ts,
      updated_at: ts,
    });
    const created = getById(id);
    if (!created) throw new Error(`Failed to read back event ${id}`);
    return created;
  }

  function update(id: string, input: UpdateEventInput): FarmEvent | undefined {
    const existing = stmtById.get(id);
    if (!existing) return undefined;
    const ts = nowIso();
    const merged: EventRow = {
      ...existing,
      title: input.title ?? existing.title,
      description: input.description === null ? null : input.description ?? existing.description,
      kind: input.kind ?? existing.kind,
      visibility: input.visibility ?? existing.visibility,
      starts_at: input.startsAt ?? existing.starts_at,
      ends_at: input.endsAt ?? existing.ends_at,
      location: input.location === null ? null : input.location ?? existing.location,
      capacity: input.capacity === null ? null : input.capacity ?? existing.capacity,
      attendee_ids:
        input.attendeeIds === null ? null : toJsonColumn(input.attendeeIds) ?? existing.attendee_ids,
      updated_at: ts,
    };
    db.prepare(
      `UPDATE events SET
        title = @title, description = @description, kind = @kind, visibility = @visibility,
        starts_at = @starts_at, ends_at = @ends_at, location = @location, capacity = @capacity,
        attendee_ids = @attendee_ids, updated_at = @updated_at
       WHERE id = @id`,
    ).run(merged);
    return getById(id);
  }

  function remove(id: string): boolean {
    const result = db.prepare(`DELETE FROM events WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  /** Register an attendee by ID; checks capacity. */
  function addAttendee(id: string, customerId: Identifier): FarmEvent | undefined {
    const event = getById(id);
    if (!event) return undefined;
    // Check capacity
    const attendees = event.attendeeIds ?? [];
    if (event.capacity !== undefined && attendees.length >= event.capacity) {
      return undefined; // Event is full
    }
    const attendeeSet = new Set(attendees);
    attendeeSet.add(customerId);
    return update(id, { attendeeIds: [...attendeeSet] });
  }

  /** Register an attendee by email; returns 404 if customer not found. */
  function addAttendeeByEmail(
    id: string,
    email: string,
  ): { success: boolean; customerId?: string; full?: boolean; customerNotFound?: boolean } {
    // Find customer by email
    const customer = db.prepare<{ email: string }, CustomerRow>(
      `SELECT * FROM customers WHERE email LIKE ?`,
    ).get({ email: `%${email}%` });
    
    if (!customer) {
      return { success: false, customerNotFound: true };
    }

    const event = getById(id);
    if (!event) return { success: false };

    // Check capacity
    const attendees = event.attendeeIds ?? [];
    if (event.capacity !== undefined && attendees.length >= event.capacity) {
      return { success: false, full: true };
    }

    const attendeeSet = new Set(attendees);
    attendeeSet.add(customer.id);
    update(id, { attendeeIds: [...attendeeSet] });
    return { success: true, customerId: customer.id };
  }

  /** Remove an attendee. */
  function removeAttendee(id: string, customerId: Identifier): FarmEvent | undefined {
    const event = getById(id);
    if (!event) return undefined;
    const attendees = (event.attendeeIds ?? []).filter((a) => a !== customerId);
    return update(id, { attendeeIds: attendees });
  }

  function all(): FarmEvent[] {
    return stmtAll.all().map(rowToEvent);
  }

  return { list, getById, create, update, remove, addAttendee, addAttendeeByEmail, removeAttendee, all };
}

export type EventsService = ReturnType<typeof createEventsService>;
