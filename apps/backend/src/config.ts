/**
 * @farm/backend — env-driven configuration.
 *
 * All runtime configuration is read from environment variables with sensible
 * defaults so the server can start in development without any `.env` file.
 */

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} is not a valid integer: ${raw}`);
  }
  return parsed;
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

function readString(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw === "" ? fallback : raw;
}

export interface BackendConfig {
  /** TCP port the Express REST API listens on. */
  port: number;
  /** Host/interface the REST API binds to. */
  host: string;
  /** Filesystem path to the SQLite database file. `:memory:` for an in-memory DB. */
  databasePath: string;
  /** Meilisearch server URL. */
  meiliHost: string;
  /** Meilisearch API key (optional in dev). */
  meiliApiKey: string;
  /** Meilisearch index prefix used to namespace this deployment's indexes. */
  meiliIndexPrefix: string;
  /** Whether to (re)index documents into Meilisearch on startup. */
  meiliSyncOnStartup: boolean;
  /** Directory where uploaded aerial images are stored. */
  uploadsDir: string;
  /** Public base URL under which uploaded files are served. */
  uploadsBaseUrl: string;
  /** Maximum upload size in bytes for aerial images. */
  uploadMaxBytes: number;
  /** CORS origin allow-list, or "*" for any. */
  corsOrigin: string;
  /** Node environment name. */
  nodeEnv: string;
}

export const config: BackendConfig = {
  port: readInt("PORT", 3001),
  host: readString("HOST", "127.0.0.1"),
  databasePath: readString("DATABASE_PATH", "data/farm.db"),
  meiliHost: readString("MEILI_HOST", "http://127.0.0.1:7700"),
  meiliApiKey: readString("MEILI_API_KEY", ""),
  meiliIndexPrefix: readString("MEILI_INDEX_PREFIX", "farm_"),
  meiliSyncOnStartup: readBool("MEILI_SYNC_ON_STARTUP", true),
  uploadsDir: readString("UPLOADS_DIR", "data/uploads"),
  uploadsBaseUrl: readString("UPLOADS_BASE_URL", "/uploads"),
  uploadMaxBytes: readInt("UPLOAD_MAX_BYTES", 25 * 1024 * 1024),
  corsOrigin: readString("CORS_ORIGIN", "*"),
  nodeEnv: readString("NODE_ENV", "development"),
};

/** Names of the Meilisearch indexes (with the configured prefix applied). */
export const meiliIndexNames = {
  crops: `${config.meiliIndexPrefix}crops`,
  customers: `${config.meiliIndexPrefix}customers`,
  events: `${config.meiliIndexPrefix}events`,
  aerial: `${config.meiliIndexPrefix}aerial`,
  plantingAreas: `${config.meiliIndexPrefix}planting_areas`,
} as const;
