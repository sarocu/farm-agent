/**
 * @farm/backend — Zod validation schemas for REST API request bodies.
 *
 * These mirror the service-layer input types and are used by the route
 * handlers to validate JSON bodies before handing them to the services.
 */

import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Entity schemas
// ---------------------------------------------------------------------------

export const cropCreateSchema = z.object({
  name: z.string().min(1),
  variety: z.string().min(1),
  category: z.enum(["vegetable", "fruit", "herb", "flower", "grain", "other"]).optional(),
  status: z
    .enum(["planned", "seeded", "growing", "ready", "harvested", "failed"])
    .optional(),
  daysToMaturity: z.number().int().positive().optional(),
  plantedOn: z.string().optional(),
  harvestedOn: z.string().optional(),
  notes: z.string().optional(),
});

export const cropUpdateSchema = cropCreateSchema.partial().extend({
  daysToMaturity: z.number().int().positive().nullable().optional(),
  plantedOn: z.string().nullable().optional(),
  harvestedOn: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const addressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(1),
});

export const customerCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  address: addressSchema.optional(),
  isMember: z.boolean().optional(),
  notes: z.string().optional(),
});

export const customerUpdateSchema = customerCreateSchema.partial().extend({
  phone: z.string().nullable().optional(),
  address: addressSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const eventCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  kind: z
    .enum(["market", "volunteer", "tour", "workshop", "harvest", "planting", "maintenance", "other"])
    .optional(),
  visibility: z.enum(["public", "members", "private"]).optional(),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  location: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  attendeeIds: z.array(z.string()).optional(),
});

export const eventUpdateSchema = eventCreateSchema.partial().extend({
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  attendeeIds: z.array(z.string()).nullable().optional(),
});

export const aerialCreateSchema = z.object({
  label: z.string().optional(),
  url: z.string().min(1),
  thumbnailUrl: z.string().optional(),
  capturedAt: z.string().min(1),
  center: z
    .object({ lat: z.number(), lng: z.number() })
    .optional(),
  bounds: z
    .object({
      northEast: z.object({ lat: z.number(), lng: z.number() }),
      southWest: z.object({ lat: z.number(), lng: z.number() }),
    })
    .optional(),
  metersPerPixel: z.number().positive().optional(),
});

export const aerialUpdateSchema = aerialCreateSchema.partial().extend({
  label: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  center: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
  bounds: z
    .object({
      northEast: z.object({ lat: z.number(), lng: z.number() }),
      southWest: z.object({ lat: z.number(), lng: z.number() }),
    })
    .nullable()
    .optional(),
  metersPerPixel: z.number().positive().nullable().optional(),
});

export const plantingAreaCreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  areaSquareMeters: z.number().positive().optional(),
  boundary: z.array(z.object({ lat: z.number(), lng: z.number() })).optional(),
  cropIds: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const plantingAreaUpdateSchema = plantingAreaCreateSchema.partial().extend({
  code: z.string().nullable().optional(),
  areaSquareMeters: z.number().positive().nullable().optional(),
  boundary: z.array(z.object({ lat: z.number(), lng: z.number() })).nullable().optional(),
  cropIds: z.array(z.string()).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const searchSchema = z.object({
  query: z.string().default(""),
  kind: z
    .enum(["crops", "customers", "events", "aerial", "planting_areas", "all"])
    .optional(),
  limit: z.number().int().positive().max(100).optional(),
});

// ---------------------------------------------------------------------------
// Validation middleware
// ---------------------------------------------------------------------------

export type SchemaValidator<T> = z.ZodType<T>;

export function validateBody<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: "validation_error",
        details: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

/** Parse a query string param as a boolean. Returns undefined when absent. */
export function queryBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value === "1" || value.toLowerCase() === "true";
}

/** Parse a query string param as a positive integer. Returns undefined when absent/invalid. */
export function queryInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Read a route parameter as a string, coercing Express's `string | string[]`. */
export function pathParam(req: { params: Record<string, string | string[]> }, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
