/**
 * @farm/backend — Dashboard service.
 *
 * Aggregates a handful of summary statistics used by the farm dashboard:
 * counts of crops by status, members vs. non-members, upcoming events,
 * recent aerial imagery, and this season's active subscriptions.
 */

import type { Database } from "../db/index.js";
import type { CropStatus, DayDateString, FarmEvent } from "@farm/types";

export interface DashboardSummary {
  crops: {
    total: number;
    byStatus: Record<CropStatus, number>;
  };
  customers: {
    total: number;
    members: number;
    nonMembers: number;
  };
  events: {
    total: number;
    upcoming: number;
  };
  aerialImages: {
    total: number;
  };
  plantingAreas: {
    total: number;
  };
  /** The number of events to include in the `upcomingEvents` preview. */
  upcomingEvents: FarmEvent[];
  generatedAt: string;
}

const CROP_STATUSES: CropStatus[] = [
  "planned",
  "seeded",
  "growing",
  "ready",
  "harvested",
  "failed",
];

export function createDashboardService(db: Database) {
  const stmtCropTotal = db.prepare<[], { c: number }>(`SELECT COUNT(*) AS c FROM crops`);
  const stmtCropByStatus = db.prepare<[], { status: string; c: number }>(
    `SELECT status, COUNT(*) AS c FROM crops GROUP BY status`,
  );
  const stmtCustomerTotal = db.prepare<[], { c: number }>(`SELECT COUNT(*) AS c FROM customers`);
  const stmtMembers = db.prepare<[], { c: number }>(
    `SELECT COUNT(*) AS c FROM customers WHERE is_member = 1`,
  );
  const stmtEventTotal = db.prepare<[], { c: number }>(`SELECT COUNT(*) AS c FROM events`);
  const stmtEventUpcomingCount = db.prepare<[string], { c: number }>(
    `SELECT COUNT(*) AS c FROM events WHERE starts_at >= ?`,
  );
  const stmtEventUpcoming = db.prepare<
    [string, number],
    {
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
  >(
    `SELECT * FROM events WHERE starts_at >= ? ORDER BY starts_at ASC LIMIT ?`,
  );
  const stmtAerialTotal = db.prepare<[], { c: number }>(
    `SELECT COUNT(*) AS c FROM aerial_images`,
  );
  const stmtPlantingAreaTotal = db.prepare<[], { c: number }>(
    `SELECT COUNT(*) AS c FROM planting_areas`,
  );

  function getSummary(opts: { upcomingLimit?: number; now?: DayDateString } = {}): DashboardSummary {
    const now = opts.now ?? new Date().toISOString();
    const upcomingLimit = opts.upcomingLimit ?? 5;

    const byStatus = Object.fromEntries(
      CROP_STATUSES.map((s) => [s, 0] as const),
    ) as Record<CropStatus, number>;
    for (const row of stmtCropByStatus.all()) {
      // Only count statuses we know about; unknown values are ignored.
      if (row.status in byStatus) {
        byStatus[row.status as CropStatus] = row.c;
      }
    }

    const totalCrops = stmtCropTotal.get()?.c ?? 0;
    const totalCustomers = stmtCustomerTotal.get()?.c ?? 0;
    const members = stmtMembers.get()?.c ?? 0;
    const totalEvents = stmtEventTotal.get()?.c ?? 0;
    const upcomingCount = stmtEventUpcomingCount.get(now)?.c ?? 0;
    const totalAerial = stmtAerialTotal.get()?.c ?? 0;
    const totalAreas = stmtPlantingAreaTotal.get()?.c ?? 0;

    const upcomingRows = stmtEventUpcoming.all(now, upcomingLimit);
    const upcomingEvents: FarmEvent[] = upcomingRows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description ?? undefined,
      kind: row.kind as FarmEvent["kind"],
      visibility: row.visibility as FarmEvent["visibility"],
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      location: row.location ?? undefined,
      capacity: row.capacity ?? undefined,
      attendeeIds: safeParseArray(row.attendee_ids),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return {
      crops: { total: totalCrops, byStatus },
      customers: {
        total: totalCustomers,
        members,
        nonMembers: Math.max(0, totalCustomers - members),
      },
      events: { total: totalEvents, upcoming: upcomingCount },
      aerialImages: { total: totalAerial },
      plantingAreas: { total: totalAreas },
      upcomingEvents,
      generatedAt: now,
    };
  }

  return { getSummary };
}

function safeParseArray(value: string | null): string[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as string[]) : undefined;
  } catch {
    return undefined;
  }
}

export type DashboardService = ReturnType<typeof createDashboardService>;
