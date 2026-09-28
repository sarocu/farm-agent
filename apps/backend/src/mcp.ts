/**
 * @farm/backend — MCP server entry point.
 *
 * Runs the farm backend as a Model Context Protocol server over the standard
 * stdio transport, exposing the tools registered in {@link registerFarmTools}.
 * An MCP client launches this process and communicates over stdin/stdout.
 *
 * Configure with the same environment variables as the REST server; notably
 * `DATABASE_PATH` (defaults to `data/farm.db`). Set `MEILI_SYNC_ON_STARTUP=0`
 * to skip the startup Meilisearch reindex when running as an MCP server.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "./config.js";
import { openDatabase } from "./db/index.js";
import { registerFarmTools } from "./tools.js";

async function main(): Promise<void> {
  const { db, close } = openDatabase(config);

  const server = new McpServer({
    name: "farm-backend",
    version: "0.0.0",
  });

  registerFarmTools(server, db);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Keep stdout clean for the protocol; log to stderr only.
  console.error("[mcp] farm-backend MCP server running on stdio (db=%s)", config.databasePath);

  const shutdown = (signal: string) => {
    console.error("[mcp] received %s — closing…", signal);
    server
      .close()
      .then(() => close())
      .finally(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[mcp] fatal:", err);
  process.exit(1);
});
