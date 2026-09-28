/**
 * @farm/backend — Express application factory.
 *
 * Builds and returns the configured Express `app` together with the service
 * instances and a `close` function. Keeping the factory separate from the
 * listen call makes the app testable and reusable.
 */

import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import { config } from "./config.js";
import { openDatabase, type Database } from "./db/index.js";
import {
  createAerialService,
  createCropsService,
  createCustomersService,
  createDashboardService,
  createEventsService,
  createPlantingAreasService,
  createSearchService,
} from "./services/index.js";
import { createAerialRouter } from "./routes/aerial.js";
import { createCropsRouter } from "./routes/crops.js";
import { createCustomersRouter } from "./routes/customers.js";
import { createEventsRouter } from "./routes/events.js";
import { createPlantingAreasRouter } from "./routes/planting-areas.js";
import {
  createDashboardRouter,
  createSearchRouter,
} from "./routes/dashboard-search.js";
import { ensureUploadsDir } from "./uploads.js";

export interface AppContext {
  app: Express;
  db: Database;
  close: () => void;
}

export function createApp(): AppContext {
  const { db, close: closeDb } = openDatabase(config);

  const crops = createCropsService(db);
  const customers = createCustomersService(db);
  const events = createEventsService(db);
  const aerial = createAerialService(db);
  const plantingAreas = createPlantingAreasService(db);
  const dashboard = createDashboardService(db);
  const search = createSearchService(db);

  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  // Serve uploaded files and expose the base URL to the aerial upload route.
  ensureUploadsDir();
  app.use(
    config.uploadsBaseUrl,
    express.static(config.uploadsDir, { maxAge: "7d" }),
  );
  app.use((req, res, next) => {
    res.locals.uploadsBaseUrl = config.uploadsBaseUrl;
    next();
  });

  // Health check.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.use("/api/crops", createCropsRouter(crops));
  app.use("/api/customers", createCustomersRouter(customers));
  app.use("/api/events", createEventsRouter(events));
  app.use("/api/aerial", createAerialRouter(aerial));
  app.use("/api/planting-areas", createPlantingAreasRouter(plantingAreas));
  app.use("/api/dashboard", createDashboardRouter(dashboard));
  app.use("/api/search", createSearchRouter(search));

  // 404 fallback.
  app.use((req, res) => {
    res.status(404).json({ error: "not_found", path: req.path });
  });

  // Error handler.
  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error("[backend] unhandled error:", err);
    res.status(500).json({ error: "internal_error" });
  };
  app.use(errorHandler);

  return {
    app,
    db,
    close: () => closeDb(),
  };
}

export type { Database };
