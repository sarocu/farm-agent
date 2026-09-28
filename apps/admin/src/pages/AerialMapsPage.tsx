/**
 * @farm/admin — aerial maps gallery page.
 *
 * Shows captured aerial images as a responsive grid of thumbnails with
 * metadata (label, captured date, center geo-point). Each card links to the
 * full-resolution image and supports deletion.
 */

import { useMemo, useState } from "react";
import { Button, Card, EmptyState, Spinner, Tag } from "@farm/ui";
import { aerialApi } from "../api.js";
import { useAsync, formatDate } from "../hooks.js";
import type { AerialImage } from "@farm/types";

function imageUrl(url: string): string {
  // The backend stores URLs like "/uploads/<file>"; serve them as-is so the
  // dev proxy / production reverse proxy resolves them.
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith("/") ? url : `/${url}`;
}

export function AerialMapsPage(): JSX.Element {
  const { data, loading, error, refresh } = useAsync<AerialImage[]>(() =>
    aerialApi.list(),
  );
  const [busyId, setBusyId] = useState<string | undefined>(undefined);

  const images = useMemo(() => data ?? [], [data]);

  const remove = async (image: AerialImage) => {
    if (!window.confirm(`Delete aerial image "${image.label ?? image.id}"?`))
      return;
    setBusyId(image.id);
    try {
      await aerialApi.remove(image.id);
      refresh();
    } catch (err) {
      window.alert(`Failed to delete: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <div className="admin-grid">
      {error ? (
        <div className="admin-error">
          Failed to load aerial images: {error}.{" "}
          <button type="button" onClick={refresh} className="admin-field__hint">
            Retry
          </button>
        </div>
      ) : null}

      <Card title={`Aerial images (${images.length})`}>
        {loading && !data ? (
          <div className="admin-center">
            <Spinner label="Loading aerial images" />
          </div>
        ) : images.length === 0 ? (
          <EmptyState
            icon="🛰️"
            title="No aerial images yet"
            description="Upload aerial imagery from the Image Upload page to see it here."
          />
        ) : (
          <div className="admin-aerial-grid">
            {images.map((image) => (
              <div className="admin-aerial-card" key={image.id}>
                <a
                  href={imageUrl(image.url)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={image.label ?? "Aerial image"}
                >
                  <img
                    className="admin-aerial-card__img"
                    src={imageUrl(image.thumbnailUrl ?? image.url)}
                    alt={image.label ?? "Aerial image"}
                    loading="lazy"
                  />
                </a>
                <div className="admin-aerial-card__body">
                  <span className="admin-aerial-card__title">
                    {image.label ?? "Untitled"}
                  </span>
                  <span className="admin-aerial-card__meta">
                    Captured {formatDate(image.capturedAt)}
                  </span>
                  {image.center ? (
                    <span className="admin-aerial-card__meta">
                      {image.center.lat.toFixed(5)}, {image.center.lng.toFixed(5)}
                    </span>
                  ) : null}
                  {image.metersPerPixel ? (
                    <Tag>{image.metersPerPixel} m/px</Tag>
                  ) : null}
                </div>
                <div className="admin-aerial-card__actions">
                  <Button
                    variant="secondary"
                    onClick={() => remove(image)}
                    disabled={busyId === image.id}
                  >
                    {busyId === image.id ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
