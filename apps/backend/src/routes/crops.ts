/**
 * @farm/backend — REST routes for crops.
 */

import { Router } from "express";
import type { CropsService } from "../services/crops.js";
import { cropCreateSchema, cropUpdateSchema, pathParam, validateBody } from "./validation.js";

export function createCropsRouter(service: CropsService): Router {
  const router = Router();

  router.get("/", (req, res) => {
    res.json(
      service.list({
        status: req.query.status as never,
        category: req.query.category as never,
      }),
    );
  });

  router.get("/:id", (req, res) => {
    const crop = service.getById(pathParam(req, "id"));
    if (!crop) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(crop);
  });

  router.post("/", validateBody(cropCreateSchema), (req, res) => {
    res.status(201).json(service.create(req.body));
  });

  router.put("/:id", validateBody(cropUpdateSchema), (req, res) => {
    const updated = service.update(pathParam(req, "id"), req.body);
    if (!updated) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(updated);
  });

  router.delete("/:id", (req, res) => {
    const ok = service.remove(pathParam(req, "id"));
    res.status(ok ? 204 : 404).end();
  });

  return router;
}
