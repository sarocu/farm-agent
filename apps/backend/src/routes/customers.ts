/**
 * @farm/backend — REST routes for customers.
 */

import { Router } from "express";
import type { CustomersService } from "../services/customers.js";
import {
  customerCreateSchema,
  customerUpdateSchema,
  pathParam,
  queryBool,
  validateBody,
} from "./validation.js";

export function createCustomersRouter(service: CustomersService): Router {
  const router = Router();

  router.get("/", (req, res) => {
    res.json(
      service.list({
        isMember: queryBool(req.query.isMember as string | undefined),
        search: req.query.search as string | undefined,
      }),
    );
  });

  router.get("/:id", (req, res) => {
    const customer = service.getById(pathParam(req, "id"));
    if (!customer) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(customer);
  });

  router.post("/", validateBody(customerCreateSchema), (req, res) => {
    res.status(201).json(service.create(req.body));
  });

  router.put("/:id", validateBody(customerUpdateSchema), (req, res) => {
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
