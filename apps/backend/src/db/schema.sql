-- ---------------------------------------------------------------------------
-- Farm backend — SQLite schema
--
-- All domain entities defined in @farm/types are persisted here. Nested /
-- array-valued fields (addresses, geo points, boundary polygons, id lists)
-- are stored as JSON text columns and (de)serialised by the service layer.
-- ---------------------------------------------------------------------------

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ---------------------------------------------------------------------------
-- crops
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crops (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  variety         TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other',
  status          TEXT NOT NULL DEFAULT 'planned',
  days_to_maturity INTEGER,
  planted_on      TEXT,
  harvested_on    TEXT,
  notes           TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_crops_status   ON crops(status);
CREATE INDEX IF NOT EXISTS idx_crops_category ON crops(category);

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  address    TEXT,        -- JSON: Address | null
  is_member  INTEGER NOT NULL DEFAULT 0,
  notes      TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_email    ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_is_member ON customers(is_member);

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  kind         TEXT NOT NULL DEFAULT 'other',
  visibility   TEXT NOT NULL DEFAULT 'public',
  starts_at    TEXT NOT NULL,
  ends_at      TEXT NOT NULL,
  location     TEXT,
  capacity     INTEGER,
  attendee_ids TEXT,       -- JSON: Identifier[] | null
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_kind      ON events(kind);

-- ---------------------------------------------------------------------------
-- aerial_images
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aerial_images (
  id               TEXT PRIMARY KEY,
  label            TEXT,
  url              TEXT NOT NULL,
  thumbnail_url    TEXT,
  captured_at      TEXT NOT NULL,
  center           TEXT,     -- JSON: GeoPoint | null
  bounds           TEXT,     -- JSON: GeoBounds | null
  meters_per_pixel REAL,
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_aerial_captured_at ON aerial_images(captured_at);

-- ---------------------------------------------------------------------------
-- planting_areas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planting_areas (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  code                 TEXT,
  area_square_meters   REAL,
  boundary             TEXT,    -- JSON: GeoPoint[] | null
  crop_ids             TEXT,    -- JSON: Identifier[] | null
  notes                TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_planting_areas_name ON planting_areas(name);

-- ---------------------------------------------------------------------------
-- seasons
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seasons (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  year                   INTEGER NOT NULL,
  starts_on              TEXT NOT NULL,
  ends_on                TEXT NOT NULL,
  accepting_subscriptions INTEGER NOT NULL DEFAULT 0,
  notes                  TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_seasons_year ON seasons(year);

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id                TEXT PRIMARY KEY,
  customer_id       TEXT NOT NULL,
  season_id         TEXT NOT NULL,
  frequency         TEXT NOT NULL DEFAULT 'weekly',
  status            TEXT NOT NULL DEFAULT 'pending',
  delivery_method   TEXT NOT NULL DEFAULT 'pickup',
  delivery_location TEXT,
  starts_on         TEXT NOT NULL,
  ends_on           TEXT,
  price_cents       INTEGER NOT NULL DEFAULT 0,
  paused_until      TEXT,
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (season_id)   REFERENCES seasons(id)   ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_season   ON subscriptions(season_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status   ON subscriptions(status);

-- ---------------------------------------------------------------------------
-- harvest_calendar
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS harvest_calendar (
  id                TEXT PRIMARY KEY,
  season_id         TEXT NOT NULL,
  crop_id           TEXT NOT NULL,
  date              TEXT NOT NULL,
  quantity          REAL NOT NULL DEFAULT 0,
  unit              TEXT NOT NULL DEFAULT 'kg',
  planting_area_ids TEXT,    -- JSON: Identifier[] | null
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
  FOREIGN KEY (crop_id)   REFERENCES crops(id)   ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_harvest_date   ON harvest_calendar(date);
CREATE INDEX IF NOT EXISTS idx_harvest_season ON harvest_calendar(season_id);
CREATE INDEX IF NOT EXISTS idx_harvest_crop   ON harvest_calendar(crop_id);
