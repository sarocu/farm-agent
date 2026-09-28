/**
 * @farm/customer — typed fetch wrappers.
 *
 * Thin, strongly-typed HTTP helpers around the backend REST API, scoped to
 * the endpoints a customer-facing site needs:
 *
 *  - `/api/events`       — public + members-only farm events, RSVP sign-up
 *  - `/api/crops`        — what's growing / ready this season (read-only)
 *  - `/api/customers`    — self-service portal lookups (by id / email)
 *  - `/api/dashboard`    — homepage highlight stats
 *
 * All wrappers return parsed JSON typed against the shared `@farm/types`
 * entities. The base URL defaults to a relative `/api` so the dev-server
 * proxy (and a production reverse proxy) can route to the backend. Override
 * with `VITE_API_BASE_URL` for a split origin.
 */

import type {
  Crop,
  CropCategory,
  CropStatus,
  Customer,
  FarmEvent,
  EventKind,
  EventVisibility,
} from "@farm/types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/** Error thrown by the API helpers when a request fails. */
export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body !== undefined && !(init.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch (err) {
    throw new ApiError(
      `Network error contacting ${url}: ${(err as Error).message}`,
      0,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    const message =
      (body as { error?: string; message?: string } | undefined)?.error ??
      (body as { message?: string } | undefined)?.message ??
      response.statusText;
    throw new ApiError(message, response.status, body);
  }
  return body as T;
}

function buildQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * Filters for the public calendar. The customer site only ever asks for
 * `public` or `members` events — never `private` — so the union reflects
 * that.
 */
export interface PublicEventFilters {
  kind?: EventKind;
  visibility?: Exclude<EventVisibility, "private">;
  from?: string;
  to?: string;
}

export const eventsApi = {
  list: (filters: PublicEventFilters = {}) =>
    request<FarmEvent[]>(
      `/events${buildQuery(filters as Record<string, unknown>)}`,
    ),
  get: (id: string) =>
    request<FarmEvent>(`/events/${encodeURIComponent(id)}`),
  /** Sign the given customer up to attend an event. */
  rsvp: (id: string, customerId: string) =>
    request<FarmEvent>(
      `/events/${encodeURIComponent(id)}/attendees/${encodeURIComponent(customerId)}`,
      { method: "POST" },
    ),
  /** Cancel a customer's attendance for an event. */
  cancelRsvp: (id: string, customerId: string) =>
    request<FarmEvent>(
      `/events/${encodeURIComponent(id)}/attendees/${encodeURIComponent(customerId)}`,
      { method: "DELETE" },
    ),
};

// ---------------------------------------------------------------------------
// Crops (read-only public catalog)
// ---------------------------------------------------------------------------

export interface CropFilters {
  status?: CropStatus;
  category?: CropCategory;
}

export const cropsApi = {
  list: (filters: CropFilters = {}) =>
    request<Crop[]>(`/crops${buildQuery(filters as Record<string, unknown>)}`),
  get: (id: string) => request<Crop>(`/crops/${encodeURIComponent(id)}`),
};

// ---------------------------------------------------------------------------
// Customers (self-service portal)
// ---------------------------------------------------------------------------

export interface CustomerLookupFilters {
  search?: string;
}

export const customersApi = {
  /** Look up a single customer by id (the portal "open my account" flow). */
  get: (id: string) =>
    request<Customer>(`/customers/${encodeURIComponent(id)}`),
  /**
   * Find a customer by email/name. The backend `/customers?search=` endpoint
   * returns all matches; we take the first for the portal sign-in flow.
   */
  findByEmail: async (email: string): Promise<Customer | undefined> => {
    const matches = await request<Customer[]>(
      `/customers${buildQuery({ search: email })}`,
    );
    const lower = email.trim().toLowerCase();
    return (
      matches.find((c) => c.email.toLowerCase() === lower) ?? matches[0]
    );
  },
};

// ---------------------------------------------------------------------------
// Dashboard (homepage highlights)
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  crops: { total: number; byStatus: Record<CropStatus, number> };
  customers: { total: number; members: number; nonMembers: number };
  events: { total: number; upcoming: number };
  aerialImages: { total: number };
  plantingAreas: { total: number };
  upcomingEvents: FarmEvent[];
  generatedAt: string;
}

export const dashboardApi = {
  summary: (opts: { upcomingLimit?: number; now?: string } = {}) =>
    request<DashboardSummary>(
      `/dashboard${buildQuery(opts as Record<string, unknown>)}`,
    ),
};

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export const healthApi = {
  /** The health endpoint lives at `/health`, outside the `/api` namespace. */
  check: async (): Promise<{ status: string; time: string }> => {
    const res = await fetch("/health");
    if (!res.ok) {
      throw new ApiError(res.statusText, res.status);
    }
    return (await res.json()) as { status: string; time: string };
  },
};

export { API_BASE_URL };
