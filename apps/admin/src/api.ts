/**
 * @farm/admin — typed fetch wrappers.
 *
 * Thin, strongly-typed HTTP helpers around the backend REST API
 * (`/api/crops`, `/api/customers`, `/api/events`, `/api/aerial`,
 * `/api/planting-areas`, `/api/dashboard`, `/api/search`). All wrappers
 * return parsed JSON typed against the shared `@farm/types` entities.
 *
 * The base URL defaults to a relative `/api` so the dev-server proxy (and a
 * production reverse proxy) can route to the backend. Override with
 * `VITE_API_BASE_URL` for a split origin.
 */

import type {
  AerialImage,
  Crop,
  CropCategory,
  CropStatus,
  Customer,
  FarmEvent,
  EventKind,
  EventVisibility,
  GeoPoint,
  PlantingArea,
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
// Crops
// ---------------------------------------------------------------------------

export interface CropFilters {
  status?: CropStatus;
  category?: CropCategory;
}

export type CropInput = {
  name: string;
  variety: string;
  category?: CropCategory;
  status?: CropStatus;
  daysToMaturity?: number;
  plantedOn?: string;
  harvestedOn?: string;
  notes?: string;
};

export type CropUpdate = Partial<CropInput>;

export const cropsApi = {
  list: (filters: CropFilters = {}) =>
    request<Crop[]>(`/crops${buildQuery(filters as Record<string, unknown>)}`),
  get: (id: string) => request<Crop>(`/crops/${encodeURIComponent(id)}`),
  create: (input: CropInput) =>
    request<Crop>(`/crops`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: CropUpdate) =>
    request<Crop>(`/crops/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    request<void>(`/crops/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export interface CustomerFilters {
  isMember?: boolean;
  search?: string;
}

export type CustomerInput = {
  name: string;
  email: string;
  phone?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  isMember?: boolean;
  notes?: string;
};

export type CustomerUpdate = Partial<CustomerInput>;

export const customersApi = {
  list: (filters: CustomerFilters = {}) =>
    request<Customer[]>(
      `/customers${buildQuery(filters as Record<string, unknown>)}`,
    ),
  get: (id: string) =>
    request<Customer>(`/customers/${encodeURIComponent(id)}`),
  create: (input: CustomerInput) =>
    request<Customer>(`/customers`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: CustomerUpdate) =>
    request<Customer>(`/customers/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    request<void>(`/customers/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface EventFilters {
  kind?: EventKind;
  visibility?: EventVisibility;
  from?: string;
  to?: string;
}

export type EventInput = {
  title: string;
  description?: string;
  kind?: EventKind;
  visibility?: EventVisibility;
  startsAt: string;
  endsAt: string;
  location?: string;
  capacity?: number;
  attendeeIds?: string[];
};

export type EventUpdate = Partial<EventInput>;

export const eventsApi = {
  list: (filters: EventFilters = {}) =>
    request<FarmEvent[]>(
      `/events${buildQuery(filters as Record<string, unknown>)}`,
    ),
  get: (id: string) =>
    request<FarmEvent>(`/events/${encodeURIComponent(id)}`),
  create: (input: EventInput) =>
    request<FarmEvent>(`/events`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: EventUpdate) =>
    request<FarmEvent>(`/events/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    request<void>(`/events/${encodeURIComponent(id)}`, { method: "DELETE" }),
  addAttendee: (id: string, customerId: string) =>
    request<FarmEvent>(
      `/events/${encodeURIComponent(id)}/attendees/${encodeURIComponent(customerId)}`,
      { method: "POST" },
    ),
  removeAttendee: (id: string, customerId: string) =>
    request<FarmEvent>(
      `/events/${encodeURIComponent(id)}/attendees/${encodeURIComponent(customerId)}`,
      { method: "DELETE" },
    ),
};

// ---------------------------------------------------------------------------
// Aerial images
// ---------------------------------------------------------------------------

export interface AerialFilters {
  from?: string;
  to?: string;
}

export type AerialInput = {
  label?: string;
  url: string;
  thumbnailUrl?: string;
  capturedAt: string;
  center?: GeoPoint;
  bounds?: { northEast: GeoPoint; southWest: GeoPoint };
  metersPerPixel?: number;
};

export type AerialUpdate = Partial<AerialInput>;

export interface AerialUploadInput {
  file: File;
  label?: string;
  capturedAt?: string;
  center?: GeoPoint;
  metersPerPixel?: number;
}

export const aerialApi = {
  list: (filters: AerialFilters = {}) =>
    request<AerialImage[]>(
      `/aerial${buildQuery(filters as Record<string, unknown>)}`,
    ),
  get: (id: string) =>
    request<AerialImage>(`/aerial/${encodeURIComponent(id)}`),
  create: (input: AerialInput) =>
    request<AerialImage>(`/aerial`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: AerialUpdate) =>
    request<AerialImage>(`/aerial/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    request<void>(`/aerial/${encodeURIComponent(id)}`, { method: "DELETE" }),
  /** Multipart upload — sends the file plus optional metadata fields. */
  upload: (input: AerialUploadInput) => {
    const form = new FormData();
    form.append("file", input.file);
    if (input.label !== undefined) form.append("label", input.label);
    if (input.capturedAt !== undefined)
      form.append("capturedAt", input.capturedAt);
    if (input.center) {
      form.append("center[lat]", String(input.center.lat));
      form.append("center[lng]", String(input.center.lng));
    }
    if (input.metersPerPixel !== undefined)
      form.append("metersPerPixel", String(input.metersPerPixel));
    return request<AerialImage>(`/aerial/upload`, {
      method: "POST",
      body: form,
    });
  },
};

// ---------------------------------------------------------------------------
// Planting areas
// ---------------------------------------------------------------------------

export type PlantingAreaInput = {
  name: string;
  code?: string;
  areaSquareMeters?: number;
  boundary?: GeoPoint[];
  cropIds?: string[];
  notes?: string;
};

export type PlantingAreaUpdate = Partial<PlantingAreaInput>;

export const plantingAreasApi = {
  list: () => request<PlantingArea[]>(`/planting-areas`),
  get: (id: string) =>
    request<PlantingArea>(`/planting-areas/${encodeURIComponent(id)}`),
  create: (input: PlantingAreaInput) =>
    request<PlantingArea>(`/planting-areas`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (id: string, input: PlantingAreaUpdate) =>
    request<PlantingArea>(`/planting-areas/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  remove: (id: string) =>
    request<void>(`/planting-areas/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  assignCrop: (id: string, cropId: string) =>
    request<PlantingArea>(
      `/planting-areas/${encodeURIComponent(id)}/crops/${encodeURIComponent(cropId)}`,
      { method: "POST" },
    ),
  unassignCrop: (id: string, cropId: string) =>
    request<PlantingArea>(
      `/planting-areas/${encodeURIComponent(id)}/crops/${encodeURIComponent(cropId)}`,
      { method: "DELETE" },
    ),
};

// ---------------------------------------------------------------------------
// Dashboard
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
// Search
// ---------------------------------------------------------------------------

export type SearchKind =
  | "crops"
  | "customers"
  | "events"
  | "aerial"
  | "planting_areas"
  | "all";

export interface SearchHit {
  kind: Exclude<SearchKind, "all">;
  id: string;
  document: unknown;
  score?: number;
}

export interface SearchResponse {
  query: string;
  kind: SearchKind;
  total: number;
  hits: SearchHit[];
  source: "meilisearch" | "sql";
}

export const searchApi = {
  search: (query: string, kind?: SearchKind, limit?: number) =>
    request<SearchResponse>(
      `/search${buildQuery({ query, kind, limit })}`,
    ),
  reindex: () =>
    request<{ ok: true }>(`/search/reindex`, { method: "POST" }),
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
