/**
 * @farm/backend — Meilisearch client wrapper.
 *
 * Wraps the `meilisearch` JS client and exposes the small surface the
 * backend needs: ensuring indexes exist, (re)indexing documents, searching,
 * and deleting documents. All calls are guarded so a missing/unreachable
 * Meilisearch instance degrades to a no-op (returns empty results) rather
 * than crashing the server — the REST search endpoint then falls back to
 * the SQL-backed service search.
 */

import { Meilisearch } from "meilisearch";
import type {
  Index as MeiliIndex,
  SearchResponse,
} from "meilisearch";
import { config, meiliIndexNames } from "../config.js";

type AnyDoc = Record<string, unknown>;

export interface MeiliClientOptions {
  /** Meilisearch host URL. Defaults to {@link config.meiliHost}. */
  host?: string;
  /** Meilisearch API key. Defaults to {@link config.meiliApiKey}. */
  apiKey?: string;
  /** Prefix prepended to every index UID. Defaults to {@link config.meiliIndexPrefix}. */
  indexPrefix?: string;
}

export interface SearchOptions {
  /** Free-text query string. An empty string performs a wildcard search. */
  query?: string;
  /** Maximum number of hits to return. */
  limit?: number;
  /** Filter expressions (Meilisearch syntax), e.g. `["status = 'ready'"]`. */
  filter?: string[];
}

export interface SearchHits<T> {
  hits: T[];
  estimatedTotalHits: number;
  query: string;
  index: string;
}

interface EnsureIndexOptions {
  primaryKey?: string;
  searchableAttributes?: string[];
  filterableAttributes?: string[];
  sortableAttributes?: string[];
}

/**
 * A resilient Meilisearch wrapper. If the server is unreachable, every method
 * resolves to an empty/no-op result so callers don't need to handle network
 * errors individually.
 */
export class MeiliSearchClient {
  private client: Meilisearch;
  private reachable: boolean;
  private readonly indexPrefix: string;

  constructor(options: MeiliClientOptions = {}) {
    this.indexPrefix = options.indexPrefix ?? config.meiliIndexPrefix;
    this.client = new Meilisearch({
      host: options.host ?? config.meiliHost,
      apiKey: options.apiKey ?? config.meiliApiKey,
    });
    this.reachable = true;
  }

  private indexName(name: string): string {
    return `${this.indexPrefix}${name}`;
  }

  /** Best-effort health check; flips {@link reachable} off on failure. */
  async ping(): Promise<boolean> {
    try {
      await this.client.health();
      this.reachable = true;
      return true;
    } catch {
      this.reachable = false;
      return false;
    }
  }

  isReachable(): boolean {
    return this.reachable;
  }

  private getIndex<T extends AnyDoc>(name: string): MeiliIndex<T> {
    return this.client.index<T>(this.indexName(name));
  }

  /** Create an index if it doesn't exist, then configure its searchable/filterable attributes. */
  async ensureIndex(name: string, opts: EnsureIndexOptions = {}): Promise<void> {
    try {
      const index = this.client.index(this.indexName(name));
      await index.fetchInfo().catch(async () => {
        await this.client.createIndex(this.indexName(name), {
          primaryKey: opts.primaryKey,
        });
      });
      if (opts.searchableAttributes) {
        await index.updateSearchableAttributes(opts.searchableAttributes);
      }
      if (opts.filterableAttributes) {
        await index.updateFilterableAttributes(opts.filterableAttributes);
      }
      if (opts.sortableAttributes) {
        await index.updateSortableAttributes(opts.sortableAttributes);
      }
    } catch (err) {
      this.reachable = false;
      this.logError(`ensureIndex(${name})`, err);
    }
  }

  /** Add or replace documents, waiting for the task to complete. */
  async indexDocuments<T extends AnyDoc>(name: string, docs: T[]): Promise<void> {
    if (docs.length === 0) return;
    try {
      const index = this.getIndex<T>(name);
      await index.addDocuments(docs).waitTask();
    } catch (err) {
      this.reachable = false;
      this.logError(`indexDocuments(${name})`, err);
    }
  }

  /** Remove documents by their primary keys, waiting for the task to complete. */
  async deleteDocuments(name: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    try {
      const index = this.getIndex<AnyDoc>(name);
      await index.deleteDocuments(ids).waitTask();
    } catch (err) {
      this.reachable = false;
      this.logError(`deleteDocuments(${name})`, err);
    }
  }

  /** Clear every document in an index. */
  async clearIndex(name: string): Promise<void> {
    try {
      const index = this.getIndex<AnyDoc>(name);
      await index.deleteAllDocuments().waitTask();
    } catch (err) {
      this.reachable = false;
      this.logError(`clearIndex(${name})`, err);
    }
  }

  /** Run a search against an index; returns empty hits if Meilisearch is down. */
  async search<T extends AnyDoc>(
    name: string,
    options: SearchOptions = {},
  ): Promise<SearchHits<T>> {
    const indexName = this.indexName(name);
    try {
      const index = this.getIndex<T>(name);
      const response: SearchResponse<T> = await index.search(options.query ?? "", {
        limit: options.limit ?? 20,
        filter: options.filter,
        showRankingScore: false,
      });
      return {
        hits: response.hits as T[],
        estimatedTotalHits: response.estimatedTotalHits ?? response.hits.length,
        query: options.query ?? "",
        index: indexName,
      };
    } catch (err) {
      this.reachable = false;
      this.logError(`search(${name})`, err);
      return { hits: [], estimatedTotalHits: 0, query: options.query ?? "", index: indexName };
    }
  }

  private logError(label: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    // Keep this on stderr; the REST server keeps serving SQL-backed results.
    console.warn(`[meilisearch] ${label} failed: ${message}`);
  }
}

/** A singleton client used by the search service. */
export const meili = new MeiliSearchClient();

/** Convenience access to the configured index names. */
export const indexNames = meiliIndexNames;
