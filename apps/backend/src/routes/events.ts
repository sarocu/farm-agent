/**
 * @farm/backend — REST routes for events.
 */

import { Router } from "express";
import type { EventsService } from "../services/events.js";
import { eventCreateSchema, eventUpdateSchema, pathParam, rsvpSchema, validateBody } from "./validation.js";

export function createEventsRouter(service: EventsService): Router {
  const router = Router();

  router.get("/", (req, res) => {
    res.json(
      service.list({
        kind: req.query.kind as never,
        visibility: req.query.visibility as never,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
      }),
    );
  });

  router.get("/:id", (req, res) => {
    const event = service.getById(pathParam(req, "id"));
    if (!event) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(event);
  });

  router.post("/", validateBody(eventCreateSchema), (req, res) => {
    res.status(201).json(service.create(req.body));
  });

  router.put("/:id", validateBody(eventUpdateSchema), (req, res) => {
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

  // RSVP by email (new endpoint)
  router.post("/:id/attendees", validateBody(rsvpSchema), (req, res) => {
    const { email } = req.body;
    const result = service.addAttendeeByEmail(pathParam(req, "id"), email);
    
    if (!result.success) {
      if (result.customerNotFound) {
        res.status(404).json({ error: "customer_not_found", message: "No customer found with this email" });
        return;
      }
      if (result.full) {
        res.status(409).json({ error: "event_full", message: "Event is full" });
        return;
      }
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(service.getById(pathParam(req, "id")));
  });

  // RSVP by customer ID (existing endpoint, updated to handle capacity)
  router.post("/:id/attendees/:customerId", (req, res) => {
    const event = service.addAttendee(pathParam(req, "id"), pathParam(req, "customerId"));
    if (!event) {
      // Check if event exists to determine the correct error
      const e = service.getById(pathParam(req, "id"));
      if (!e) {
        res.status(404).json({ error: "not_found" });
      } else {
        res.status(409).json({ error: "event_full", message: "Event is full" });
      }
      return;
    }
    res.json(event);
  });

  router.delete("/:id/attendees/:customerId", (req, res) => {
    const event = service.removeAttendee(pathParam(req, "id"), pathParam(req, "customerId"));
    if (!event) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(event);
  });

  return router;
}
