/**
 * @farm/admin — small shared hooks.
 */

import { useCallback, useEffect, useState } from "react";

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | undefined;
  /** Re-run the async function. */
  refresh: () => void;
}

/**
 * Runs an async function on mount (and whenever `deps` change) and tracks
 * its loading / error / data state. Returns a `refresh` callback to
 * re-run it on demand.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    fn()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, refresh };
}

/** Format an ISO date-time into a short local string. */
export function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format a plain `YYYY-MM-DD` date. */
export function formatDateShort(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
