/**
 * @farm/backend — upload storage configuration.
 *
 * Configures multer's disk storage to write uploaded files into
 * `config.uploadsDir` (created on demand), using a timestamped unique
 * filename so collisions are avoided.
 */

import multer from "multer";
import { mkdirSync } from "node:fs";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";

/** Ensure the uploads directory exists. */
export function ensureUploadsDir(): string {
  mkdirSync(config.uploadsDir, { recursive: true });
  return config.uploadsDir;
}

/** Multer disk storage that writes to {@link config.uploadsDir}. */
export const diskStoragePath = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ensureUploadsDir());
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname);
    const id = randomUUID();
    cb(null, `${Date.now()}-${id}${ext}`);
  },
});
