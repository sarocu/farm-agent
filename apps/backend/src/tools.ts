/**
 * @farm/backend — MCP tool registration.
 *
 * Registers Model Context Protocol tools that wrap the service layer, so an
 * MCP client (e.g. an AI assistant) can read and mutate farm data. Each tool
 * accepts a Zod raw-shape input schema and returns a {@link CallToolResult}
 * whose content is a single JSON text block.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Database } from "./db/index.js";
import {
  createAerialService,
  createCropsService,
  createCustomersService,
  createDashboardService,
  createEventsService,
  createPlantingAreasService,
  createSearchService,
} from "./services/index.js";

/** Stringify a value as the text content of a tool result. */
function jsonContent(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorContent(message: string, status = 404) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: message, status }),
      },
    ],
  };
}

// Enum unions re-declared as zod enums for tool input schemas.
const cropCategory = z.enum([
  "vegetable",
  "fruit",
  "herb",
  "flower",
  "grain",
  "other",
]);
const cropStatus = z.enum([
  "planned",
  "seeded",
  "growing",
  "ready",
  "harvested",
  "failed",
]);
const eventKind = z.enum([
  "market",
  "volunteer",
  "tour",
  "workshop",
  "harvest",
  "planting",
  "maintenance",
  "other",
]);
const eventVisibility = z.enum(["public", "members", "private"]);

/**
 * Register every farm MCP tool onto the given server.
 *
 * @returns the same server, for chaining.
 */
export function registerFarmTools(server: McpServer, db: Database): McpServer {
  const crops = createCropsService(db);
  const customers = createCustomersService(db);
  const events = createEventsService(db);
  const aerial = createAerialService(db);
  const plantingAreas = createPlantingAreasService(db);
  const dashboard = createDashboardService(db);
  const search = createSearchService(db);

  // ----------------------------------------------------------------- crops
  server.registerTool(
    "list_crops",
    {
      title: "List crops",
      description: "List crops, optionally filtered by status and/or category.",
      inputSchema: {
        status: cropStatus.optional(),
        category: cropCategory.optional(),
      },
    },
    async ({ status, category }) => jsonContent(crops.list({ status, category })),
  );

  server.registerTool(
    "get_crop",
    {
      title: "Get crop",
      description: "Get a single crop by its id.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const crop = crops.getById(id);
      return crop ? jsonContent(crop) : errorContent(`crop ${id} not found`);
    },
  );

  server.registerTool(
    "create_crop",
    {
      title: "Create crop",
      description: "Create a new crop record.",
      inputSchema: {
        name: z.string(),
        variety: z.string(),
        category: cropCategory.optional(),
        status: cropStatus.optional(),
        daysToMaturity: z.number().int().positive().optional(),
        plantedOn: z.string().optional(),
        harvestedOn: z.string().optional(),
        notes: z.string().optional(),
      },
    },
    async (input) => jsonContent(crops.create(input)),
  );

  server.registerTool(
    "update_crop",
    {
      title: "Update crop",
      description: "Update an existing crop. Omitted fields are left unchanged; pass null to clear a nullable field.",
      inputSchema: {
        id: z.string(),
        name: z.string().optional(),
        variety: z.string().optional(),
        category: cropCategory.optional(),
        status: cropStatus.optional(),
        daysToMaturity: z.number().int().positive().nullable().optional(),
        plantedOn: z.string().nullable().optional(),
        harvestedOn: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      },
    },
    async ({ id, ...input }) => {
      const updated = crops.update(id, input);
      return updated ? jsonContent(updated) : errorContent(`crop ${id} not found`);
    },
  );

  server.registerTool(
    "delete_crop",
    {
      title: "Delete crop",
      description: "Delete a crop by id.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const ok = crops.remove(id);
      return ok ? jsonContent({ id, deleted: true }) : errorContent(`crop ${id} not found`);
    },
  );

  // ------------------------------------------------------------- customers
  server.registerTool(
    "list_customers",
    {
      title: "List customers",
      description: "List customers, optionally filtered by membership or a free-text search across name/email/phone.",
      inputSchema: {
        isMember: z.boolean().optional(),
        search: z.string().optional(),
      },
    },
    async (input) => jsonContent(customers.list(input)),
  );

  server.registerTool(
    "get_customer",
    {
      title: "Get customer",
      description: "Get a single customer by id.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const customer = customers.getById(id);
      return customer ? jsonContent(customer) : errorContent(`customer ${id} not found`);
    },
  );

  server.registerTool(
    "create_customer",
    {
      title: "Create customer",
      description: "Create a new customer (CSA member or retail buyer).",
      inputSchema: {
        name: z.string(),
        email: z.string().email(),
        phone: z.string().optional(),
        address: z
          .object({
            line1: z.string(),
            line2: z.string().optional(),
            city: z.string(),
            state: z.string(),
            postalCode: z.string(),
            country: z.string(),
          })
          .optional(),
        isMember: z.boolean().optional(),
        notes: z.string().optional(),
      },
    },
    async (input) => jsonContent(customers.create(input)),
  );

  server.registerTool(
    "update_customer",
    {
      title: "Update customer",
      description: "Update an existing customer. Omitted fields are left unchanged; pass null to clear a nullable field.",
      inputSchema: {
        id: z.string(),
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().nullable().optional(),
        address: z
          .object({
            line1: z.string(),
            line2: z.string().optional(),
            city: z.string(),
            state: z.string(),
            postalCode: z.string(),
            country: z.string(),
          })
          .nullable()
          .optional(),
        isMember: z.boolean().optional(),
        notes: z.string().nullable().optional(),
      },
    },
    async ({ id, ...input }) => {
      const updated = customers.update(id, input);
      return updated ? jsonContent(updated) : errorContent(`customer ${id} not found`);
    },
  );

  server.registerTool(
    "delete_customer",
    {
      title: "Delete customer",
      description: "Delete a customer by id.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const ok = customers.remove(id);
      return ok ? jsonContent({ id, deleted: true }) : errorContent(`customer ${id} not found`);
    },
  );

  // --------------------------------------------------------------- events
  server.registerTool(
    "list_events",
    {
      title: "List events",
      description: "List farm events, optionally filtered by kind, visibility, or a date range on starts_at.",
      inputSchema: {
        kind: eventKind.optional(),
        visibility: eventVisibility.optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      },
    },
    async (input) => jsonContent(events.list(input)),
  );

  server.registerTool(
    "get_event",
    {
      title: "Get event",
      description: "Get a single event by id.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const event = events.getById(id);
      return event ? jsonContent(event) : errorContent(`event ${id} not found`);
    },
  );

  server.registerTool(
    "create_event",
    {
      title: "Create event",
      description: "Create a new farm event.",
      inputSchema: {
        title: z.string(),
        description: z.string().optional(),
        kind: eventKind.optional(),
        visibility: eventVisibility.optional(),
        startsAt: z.string(),
        endsAt: z.string(),
        location: z.string().optional(),
        capacity: z.number().int().positive().optional(),
        attendeeIds: z.array(z.string()).optional(),
      },
    },
    async (input) => jsonContent(events.create(input)),
  );

  server.registerTool(
    "update_event",
    {
      title: "Update event",
      description: "Update an existing event. Omitted fields are left unchanged; pass null to clear a nullable field.",
      inputSchema: {
        id: z.string(),
        title: z.string().optional(),
        description: z.string().nullable().optional(),
        kind: eventKind.optional(),
        visibility: eventVisibility.optional(),
        startsAt: z.string().optional(),
        endsAt: z.string().optional(),
        location: z.string().nullable().optional(),
        capacity: z.number().int().positive().nullable().optional(),
        attendeeIds: z.array(z.string()).nullable().optional(),
      },
    },
    async ({ id, ...input }) => {
      const updated = events.update(id, input);
      return updated ? jsonContent(updated) : errorContent(`event ${id} not found`);
    },
  );

  server.registerTool(
    "delete_event",
    {
      title: "Delete event",
      description: "Delete an event by id.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const ok = events.remove(id);
      return ok ? jsonContent({ id, deleted: true }) : errorContent(`event ${id} not found`);
    },
  );

  // ----------------------------------------------------------- aerial images
  server.registerTool(
    "list_aerial",
    {
      title: "List aerial images",
      description: "List aerial imagery records, optionally filtered by capture date range.",
      inputSchema: {
        from: z.string().optional(),
        to: z.string().optional(),
      },
    },
    async (input) => jsonContent(aerial.list(input)),
  );

  server.registerTool(
    "get_aerial",
    {
      title: "Get aerial image",
      description: "Get a single aerial image record by id.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const image = aerial.getById(id);
      return image ? jsonContent(image) : errorContent(`aerial image ${id} not found`);
    },
  );

  server.registerTool(
    "create_aerial",
    {
      title: "Create aerial image metadata",
      description:
        "Register an aerial image's metadata (URL, capture time, geo). The image file itself must already be hosted at `url`.",
      inputSchema: {
        url: z.string(),
        label: z.string().optional(),
        thumbnailUrl: z.string().optional(),
        capturedAt: z.string(),
        center: z.object({ lat: z.number(), lng: z.number() }).optional(),
        bounds: z
          .object({
            northEast: z.object({ lat: z.number(), lng: z.number() }),
            southWest: z.object({ lat: z.number(), lng: z.number() }),
          })
          .optional(),
        metersPerPixel: z.number().positive().optional(),
      },
    },
    async (input) => jsonContent(aerial.create(input)),
  );

  server.registerTool(
    "delete_aerial",
    {
      title: "Delete aerial image",
      description: "Delete an aerial image record by id (does not delete the file from storage).",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const ok = aerial.remove(id);
      return ok ? jsonContent({ id, deleted: true }) : errorContent(`aerial image ${id} not found`);
    },
  );

  // --------------------------------------------------------- planting areas
  server.registerTool(
    "list_planting_areas",
    {
      title: "List planting areas",
      description: "List all planting areas.",
      inputSchema: {},
    },
    async () => jsonContent(plantingAreas.list()),
  );

  server.registerTool(
    "get_planting_area",
    {
      title: "Get planting area",
      description: "Get a single planting area by id.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const area = plantingAreas.getById(id);
      return area ? jsonContent(area) : errorContent(`planting area ${id} not found`);
    },
  );

  server.registerTool(
    "create_planting_area",
    {
      title: "Create planting area",
      description: "Create a new planting area.",
      inputSchema: {
        name: z.string(),
        code: z.string().optional(),
        areaSquareMeters: z.number().positive().optional(),
        boundary: z.array(z.object({ lat: z.number(), lng: z.number() })).optional(),
        cropIds: z.array(z.string()).optional(),
        notes: z.string().optional(),
      },
    },
    async (input) => jsonContent(plantingAreas.create(input)),
  );

  server.registerTool(
    "update_planting_area",
    {
      title: "Update planting area",
      description: "Update an existing planting area. Omitted fields are left unchanged; pass null to clear a nullable field.",
      inputSchema: {
        id: z.string(),
        name: z.string().optional(),
        code: z.string().nullable().optional(),
        areaSquareMeters: z.number().positive().nullable().optional(),
        boundary: z.array(z.object({ lat: z.number(), lng: z.number() })).nullable().optional(),
        cropIds: z.array(z.string()).nullable().optional(),
        notes: z.string().nullable().optional(),
      },
    },
    async ({ id, ...input }) => {
      const updated = plantingAreas.update(id, input);
      return updated ? jsonContent(updated) : errorContent(`planting area ${id} not found`);
    },
  );

  server.registerTool(
    "delete_planting_area",
    {
      title: "Delete planting area",
      description: "Delete a planting area by id.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const ok = plantingAreas.remove(id);
      return ok ? jsonContent({ id, deleted: true }) : errorContent(`planting area ${id} not found`);
    },
  );

  // -------------------------------------------------------------- dashboard
  server.registerTool(
    "get_dashboard",
    {
      title: "Get dashboard summary",
      description:
        "Return aggregate farm statistics: crop counts by status, member counts, upcoming events, and totals for aerial images and planting areas.",
      inputSchema: {
        upcomingLimit: z.number().int().positive().optional(),
      },
    },
    async (input) =>
      jsonContent(dashboard.getSummary({ upcomingLimit: input?.upcomingLimit })),
  );

  // ----------------------------------------------------------------- search
  server.registerTool(
    "search",
    {
      title: "Search farm data",
      description:
        "Full-text search across crops, customers, events, aerial images and planting areas. Set `kind` to restrict to one entity type, or omit it to search everything. Uses Meilisearch when available, with a SQL fallback.",
      inputSchema: {
        query: z.string(),
        kind: z
          .enum(["crops", "customers", "events", "aerial", "planting_areas", "all"])
          .optional(),
        limit: z.number().int().positive().max(100).optional(),
      },
    },
    async (input) =>
      jsonContent(await search.search({ query: input.query, kind: input.kind, limit: input.limit })),
  );

  return server;
}
