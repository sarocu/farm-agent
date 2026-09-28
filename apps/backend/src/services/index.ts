/**
 * @farm/backend — service layer barrel.
 *
 * Each service is a factory that takes the shared `Database` instance and
 * returns the CRUD functions for one domain entity.
 */

export { createCropsService } from "./crops.js";
export type { CropsService, CropFilters, CreateCropInput, UpdateCropInput } from "./crops.js";

export { createCustomersService } from "./customers.js";
export type {
  CustomersService,
  CustomerFilters,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "./customers.js";

export { createEventsService } from "./events.js";
export type {
  EventsService,
  EventFilters,
  CreateEventInput,
  UpdateEventInput,
} from "./events.js";

export { createAerialService } from "./aerial.js";
export type {
  AerialService,
  AerialFilters,
  CreateAerialInput,
  UpdateAerialInput,
} from "./aerial.js";

export { createPlantingAreasService } from "./planting-areas.js";
export type {
  PlantingAreasService,
  CreatePlantingAreaInput,
  UpdatePlantingAreaInput,
} from "./planting-areas.js";

export { createDashboardService } from "./dashboard.js";
export type { DashboardService, DashboardSummary } from "./dashboard.js";

export { createSearchService } from "./search.js";
export type {
  SearchService,
  SearchRequest,
  SearchResponse,
  SearchHit,
  SearchKind,
} from "./search.js";
