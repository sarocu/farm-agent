/**
 * @farm/backend — REST routes for planting areas.
 */

import { Router } from "express";
import type { PlantingAreasService } from "../services/planting-areas.js";
import {
  plantingAreaCreateSchema,
  plantingAreaUpdateSchema,
  pathParam,
  validateBody,
} from "./validation.js";

export function createPlantingAreasRouter(service: PlantingAreasService): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(service.list());
  });

  router.get("/:id", (req, res) => {
    const area = service.getById(pathParam(req, "id"));
    if (!area) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(area);
  });

  router.post("/", validateBody(plantingAreaCreateSchema), (req, res) => {
    res.status(201).json(service.create(req.body));
  });

  router.put("/:id", validateBody(plantingAreaUpdateSchema), (req, res) => {
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

  router.post("/:id/crops/:cropId", (req, res) => {
    const area = service.assignCrop(pathParam(req, "id"), pathParam(req, "cropId"));
    if (!area) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(area);
  });

  router.delete("/:id/crops/:cropId", (req, res) => {
    const area = service.unassignCrop(pathParam(req, "id"), pathParam(req, "cropId"));
    if (!area) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(area);
  });

  return router;
}
