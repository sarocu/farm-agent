/**
 * @farm/backend — public entry point.
 *
 * Re-exports the config, database, search, and service-layer factories so
 * the package can be consumed programmatically (e.g. by tests or by the MCP
 * and REST entry points).
 */

export { config, meiliIndexNames } from "./config.js";
export type { BackendConfig } from "./config.js";

export { openDatabase, applySchema } from "./db/index.js";
export type { Database, OpenDatabaseResult } from "./db/index.js";

export { MeiliSearchClient, meili, indexNames } from "./search/meili.js";
export type { SearchOptions, SearchHits } from "./search/meili.js";

export {
  createCropsService,
  createCustomersService,
  createEventsService,
  createAerialService,
  createPlantingAreasService,
  createDashboardService,
  createSearchService,
} from "./services/index.js";
export type {
  CropsService,
  CustomersService,
  EventsService,
  AerialService,
  PlantingAreasService,
  DashboardService,
  SearchService,
  DashboardSummary,
  SearchRequest,
  SearchResponse,
  SearchHit,
  SearchKind,
} from "./services/index.js";

export { createApp } from "./app.js";
export type { AppContext } from "./app.js";

export { registerFarmTools } from "./tools.js";
