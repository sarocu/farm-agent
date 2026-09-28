/**
 * @farm/backend — REST routes for the dashboard summary and search.
 */

import { Router } from "express";
import type { DashboardService } from "../services/dashboard.js";
import type { SearchService } from "../services/search.js";
import { queryInt, searchSchema } from "./validation.js";

export function createDashboardRouter(service: DashboardService): Router {
  const router = Router();

  router.get("/", (req, res) => {
    res.json(
      service.getSummary({
        upcomingLimit: queryInt(req.query.upcomingLimit as string | undefined),
        now: req.query.now as string | undefined,
      }),
    );
  });

  return router;
}

export function createSearchRouter(service: SearchService): Router {
  const router = Router();

  router.get("/", async (req, res, next) => {
    const parsed = searchSchema.safeParse({
      query: (req.query.query as string | undefined) ?? "",
      kind: req.query.kind as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    if (!parsed.success) {
      res.status(400).json({
        error: "validation_error",
        details: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }
    try {
      const result = await service.search(parsed.data);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/reindex", async (_req, res, next) => {
    try {
      await service.reindexAll();
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
