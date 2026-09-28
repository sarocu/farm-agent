/**
 * @farm/backend — REST routes for aerial imagery.
 *
 * Supports both JSON metadata creation and multipart file uploads. Uploaded
 * files are written to `config.uploadsDir` and served back under
 * `config.uploadsBaseUrl`.
 */

import { Router } from "express";
import multer from "multer";
import { diskStoragePath } from "../uploads.js";
import type { AerialService } from "../services/aerial.js";
import { aerialCreateSchema, aerialUpdateSchema, pathParam, validateBody } from "./validation.js";

export function createAerialRouter(service: AerialService): Router {
  const router = Router();

  // Multipart upload: single field named "file", plus optional form fields.
  const upload = multer({
    storage: diskStoragePath,
    limits: { fileSize: 25 * 1024 * 1024 },
  });

  router.get("/", (req, res) => {
    res.json(
      service.list({
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
      }),
    );
  });

  router.get("/:id", (req, res) => {
    const image = service.getById(pathParam(req, "id"));
    if (!image) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(image);
  });

  router.post("/", validateBody(aerialCreateSchema), (req, res) => {
    res.status(201).json(service.create(req.body));
  });

  router.put("/:id", validateBody(aerialUpdateSchema), (req, res) => {
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

  // Multipart upload endpoint. Form fields:
  //   - file        (the image binary, required)
  //   - label       (optional)
  //   - capturedAt  (optional ISO datetime; defaults to now)
  //   - center[lat], center[lng]            (optional)
  //   - bounds[northEast][lat], ... etc.
  router.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "no_file", message: "A 'file' field is required." });
      return;
    }
    const file = req.file;
    const body = req.body as Record<string, string | undefined>;
    const url = `${res.locals.uploadsBaseUrl}/${file.filename}`;
    const capturedAt = body.capturedAt ?? new Date().toISOString();

    let center: { lat: number; lng: number } | undefined;
    const lat = body["center[lat]"];
    const lng = body["center[lng]"];
    if (lat && lng) {
      center = { lat: Number(lat), lng: Number(lng) };
    }

    const image = service.create({
      label: body.label,
      url,
      capturedAt,
      center,
      metersPerPixel: body.metersPerPixel ? Number(body.metersPerPixel) : undefined,
    });
    res.status(201).json(image);
  });

  return router;
}
