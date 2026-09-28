/**
 * @farm/types
 *
 * Shared domain types for the CSA farm application.
 *
 * These types describe the core entities managed by the platform:
 * crops, customers, events, aerial imagery, planting areas, seasons,
 * subscriptions, and harvest calendar entries.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** ISO 8601 date-time string, e.g. `"2025-06-14T10:30:00Z"`. */
export type ISODateString = string;

/** A day in `YYYY-MM-DD` form, e.g. `"2025-06-14"`. */
export type DayDateString = string;

/** Unidentified record identifier. Concrete entities define their own `id` shape. */
export type Identifier = string;

/** Geographic latitude in decimal degrees (WGS 84). */
export type Latitude = number;

/** Geographic longitude in decimal degrees (WGS 84). */
export type Longitude = number;

/** A geo-coordinate pair. */
export interface GeoPoint {
  lat: Latitude;
  lng: Longitude;
}

/** A rectangular bounding box defined by its north-east and south-west corners. */
export interface GeoBounds {
  northEast: GeoPoint;
  southWest: GeoPoint;
}

// ---------------------------------------------------------------------------
// Enums / unions
// ---------------------------------------------------------------------------

/** Life-cycle stage of a crop on the farm. */
export type CropStatus =
  | "planned"
  | "seeded"
  | "growing"
  | "ready"
  | "harvested"
  | "failed";

/** Delivery channel for a CSA subscription. */
export type DeliveryMethod = "pickup" | "delivery" | "on-farm";

/** Frequency at which a subscription is fulfilled. */
export type SubscriptionFrequency = "weekly" | "biweekly" | "monthly";

/** State of a subscription through its life-cycle. */
export type SubscriptionStatus =
  | "active"
  | "paused"
  | "cancelled"
  | "expired"
  | "pending";

/** Kind of farm event shown on the calendar. */
export type EventKind =
  | "market"
  | "volunteer"
  | "tour"
  | "workshop"
  | "harvest"
  | "planting"
  | "maintenance"
  | "other";

/** Visibility of an event to the public. */
export type EventVisibility = "public" | "members" | "private";

/** Crop by broad botanical category, used for grouping and filtering. */
export type CropCategory =
  | "vegetable"
  | "fruit"
  | "herb"
  | "flower"
  | "grain"
  | "other";

// ---------------------------------------------------------------------------
// Crop
// ---------------------------------------------------------------------------

/**
 * A crop grown on the farm.
 */
export interface Crop {
  id: Identifier;
  name: string;
  /** Cultivar or variety name, e.g. "San Marzano". */
  variety: string;
  category: CropCategory;
  status: CropStatus;
  /** Approximate days from seeding to first harvest. */
  daysToMaturity?: number;
  /** Planned or actual planting date. */
  plantedOn?: DayDateString;
  /** Planned or actual harvest date. */
  harvestedOn?: DayDateString;
  /** Free-text growing notes for staff. */
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

/** Mailing or delivery address for a customer. */
export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/** A customer (CSA member or retail buyer). */
export interface Customer {
  id: Identifier;
  name: string;
  email: string;
  phone?: string;
  address?: Address;
  /** Whether the customer has an active subscription for the current season. */
  isMember: boolean;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

/** A farm event shown on the public / members calendar. */
export interface FarmEvent {
  id: Identifier;
  title: string;
  description?: string;
  kind: EventKind;
  visibility: EventVisibility;
  startsAt: ISODateString;
  endsAt: ISODateString;
  /** Where on the farm the event takes place. */
  location?: string;
  /** Maximum number of attendees, if the event is capped. */
  capacity?: number;
  /** Customer / member IDs registered to attend. */
  attendeeIds?: Identifier[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// AerialImage
// ---------------------------------------------------------------------------

/** A georeferenced aerial photograph of the farm, e.g. from a drone pass. */
export interface AerialImage {
  id: Identifier;
  /** Caption or label for the image. */
  label?: string;
  /** URL of the image asset. */
  url: string;
  /** Thumbnail URL, if a smaller preview is available. */
  thumbnailUrl?: string;
  /** When the photo was captured. */
  capturedAt: ISODateString;
  /** Approximate center of the image, if georeferenced. */
  center?: GeoPoint;
  /** Bounding box the image covers, if known. */
  bounds?: GeoBounds;
  /** Resolution in meters per pixel, if available. */
  metersPerPixel?: number;
  createdAt: ISODateString;
}

// ---------------------------------------------------------------------------
// PlantingArea
// ---------------------------------------------------------------------------

/** A delimited area of the farm used for planting. */
export interface PlantingArea {
  id: Identifier;
  /** Human-readable name, e.g. "North field". */
  name: string;
  /** Optional code shown on maps, e.g. "F1". */
  code?: string;
  /** Area in square meters. */
  areaSquareMeters?: number;
  /** Polygon vertices outlining the area (first/last need not repeat). */
  boundary?: GeoPoint[];
  /** IDs of crops currently or planned in this area. */
  cropIds?: Identifier[];
  /** Optional soil or exposure notes. */
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Season
// ---------------------------------------------------------------------------

/** A farming season, typically one CSA season per year. */
export interface Season {
  id: Identifier;
  /** Display name, e.g. "Summer 2025". */
  name: string;
  /** Calendar year the season belongs to. */
  year: number;
  startsOn: DayDateString;
  endsOn: DayDateString;
  /** Whether subscriptions are still being accepted for this season. */
  acceptingSubscriptions: boolean;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

/** A CSA subscription tying a customer to a season. */
export interface Subscription {
  id: Identifier;
  customerId: Identifier;
  seasonId: Identifier;
  frequency: SubscriptionFrequency;
  status: SubscriptionStatus;
  deliveryMethod: DeliveryMethod;
  /** Pickup site or delivery address, depending on `deliveryMethod`. */
  deliveryLocation?: string;
  /** ISO date of the first scheduled delivery. */
  startsOn: DayDateString;
  /** ISO date of the last scheduled delivery. */
  endsOn?: DayDateString;
  /** Price paid for the season, in cents to avoid float rounding. */
  priceCents: number;
  /** Whether delivery is currently paused (e.g. vacation hold). */
  pausedUntil?: DayDateString;
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// HarvestCalendarEntry
// ---------------------------------------------------------------------------

/**
 * A single entry on the harvest calendar: which crop is expected to be ready
 * on which date, and in what quantity.
 */
export interface HarvestCalendarEntry {
  id: Identifier;
  seasonId: Identifier;
  cropId: Identifier;
  /** Date the crop is expected to be ready for harvest. */
  date: DayDateString;
  /** Expected harvest quantity. */
  quantity: number;
  /** Unit for `quantity`, e.g. "kg", "bunches", "lbs". */
  unit: string;
  /** IDs of planting areas associated with this harvest. */
  plantingAreaIds?: Identifier[];
  /** Staff notes about readiness, weather, etc. */
  notes?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

