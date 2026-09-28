/**
 * @farm/backend — REST API server entry point.
 *
 * Boots the Express app, optionally syncs documents into Meilisearch, and
 * starts listening on the configured host/port.
 */

import { config } from "./config.js";
import { createApp } from "./app.js";
import { meili } from "./search/meili.js";
import { createSearchService } from "./services/index.js";

async function main(): Promise<void> {
  const { app, db, close } = createApp();

  if (config.meiliSyncOnStartup) {
    const reachable = await meili.ping();
    if (reachable) {
      console.log("[backend] Meilisearch reachable — reindexing…");
      try {
        const search = createSearchService(db);
        await search.reindexAll();
        console.log("[backend] Meilisearch reindex complete.");
      } catch (err) {
        console.warn("[backend] Meilisearch reindex failed:", err);
      }
    } else {
      console.warn(
        "[backend] Meilisearch not reachable at %s — search will use SQL fallback.",
        config.meiliHost,
      );
    }
  }

  const server = app.listen(config.port, config.host, () => {
    console.log("[backend] REST API listening on http://%s:%d", config.host, config.port);
  });

  const shutdown = (signal: string) => {
    console.log("[backend] received %s — shutting down…", signal);
    server.close(() => {
      close();
      process.exit(0);
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[backend] fatal:", err);
  process.exit(1);
});
