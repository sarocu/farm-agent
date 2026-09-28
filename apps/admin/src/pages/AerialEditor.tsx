/**
 * @farm/admin — aerial editor page.
 *
 * Lets an admin select an aerial image and draw a polygon over it by
 * clicking to add vertices. The polygon is rendered on a canvas overlay
 * aligned to the image. When the image is georeferenced (has `bounds`),
 * pixel vertices are interpolated to geographic coordinates; otherwise the
 * polygon is saved as a planting area with the raw boundary omitted and a
 * note recording the pixel outline.
 *
 * The drawn polygon can be saved as a new PlantingArea (name + optional code).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, EmptyState, Spinner, Tag } from "@farm/ui";
import { aerialApi, plantingAreasApi } from "../api.js";
import { useAsync } from "../hooks.js";
import type { AerialImage, GeoPoint, PlantingArea } from "@farm/types";

interface PixelPoint {
  x: number;
  y: number;
}

function imageUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith("/") ? url : `/${url}`;
}

export function AerialEditor(): JSX.Element {
  const { data: images, loading, error, refresh } = useAsync<AerialImage[]>(() =>
    aerialApi.list(),
  );

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [vertices, setVertices] = useState<PixelPoint[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState<PlantingArea | undefined>(undefined);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const selected = useMemo(
    () => images?.find((i) => i.id === selectedId),
    [images, selectedId],
  );

  // Reset polygon when switching images.
  useEffect(() => {
    setVertices([]);
    setSaved(undefined);
    setSaveError(undefined);
  }, [selectedId]);

  // Redraw canvas whenever vertices or image size change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = imgSize;
    if (w === 0 || h === 0) return;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);

    if (vertices.length > 0) {
      ctx.beginPath();
      ctx.moveTo(vertices[0]!.x, vertices[0]!.y);
      for (let i = 1; i < vertices.length; i++) {
        const v = vertices[i]!;
        ctx.lineTo(v.x, v.y);
      }
      if (vertices.length >= 3) {
        ctx.closePath();
        ctx.fillStyle = "rgba(21, 128, 61, 0.25)";
        ctx.fill();
      }
      ctx.strokeStyle = "#15803d";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw vertex handles.
      for (const v of vertices) {
        ctx.beginPath();
        ctx.arc(v.x, v.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#15803d";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }, [vertices, imgSize]);

  const onImageClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setVertices((prev) => [...prev, { x, y }]);
  };

  const removeVertex = (index: number) => {
    setVertices((prev) => prev.filter((_, i) => i !== index));
  };

  const undo = () => setVertices((prev) => prev.slice(0, -1));
  const clearAll = () => setVertices([]);

  /** Convert pixel vertices to geographic coordinates using image bounds. */
  const toGeoPoints = (): GeoPoint[] | undefined => {
    if (!selected || !selected.bounds || imgSize.w === 0 || imgSize.h === 0)
      return undefined;
    const { northEast, southWest } = selected.bounds;
    const latSpan = northEast.lat - southWest.lat;
    const lngSpan = northEast.lng - southWest.lng;
    return vertices.map((v) => ({
      // y=0 -> north (northEast.lat), y=h -> south (southWest.lat)
      lat: northEast.lat - (v.y / imgSize.h) * latSpan,
      // x=0 -> west (southWest.lng), x=w -> east (northEast.lng)
      lng: southWest.lng + (v.x / imgSize.w) * lngSpan,
    }));
  };

  const canSave = selected !== undefined && name.trim() !== "" && vertices.length >= 3;

  const save = async () => {
    if (!selected || !canSave) return;
    setSaving(true);
    setSaveError(undefined);
    setSaved(undefined);
    try {
      const geoBoundary = toGeoPoints();
      const pixelOutline = vertices
        .map((v) => `${Math.round(v.x)},${Math.round(v.y)}`)
        .join(" | ");
      const area = await plantingAreasApi.create({
        name: name.trim(),
        code: code.trim() || undefined,
        boundary: geoBoundary,
        notes: geoBoundary
          ? `Drawn on aerial image ${selected.id}`
          : `Pixel outline (${imgSize.w}x${imgSize.h}): ${pixelOutline}`,
      });
      setSaved(area);
      setVertices([]);
      setName("");
      setCode("");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
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

      <div className="admin-toolbar">
        <label className="admin-field" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
          <span className="admin-field__label">Image:</span>
          <select
            className="admin-field__select"
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value || undefined)}
            disabled={loading || (images?.length ?? 0) === 0}
          >
            <option value="">Select an aerial image…</option>
            {images?.map((img) => (
              <option key={img.id} value={img.id}>
                {img.label ?? img.id} — {img.capturedAt.slice(0, 10)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && !images ? (
        <div className="admin-center">
          <Spinner label="Loading aerial images" />
        </div>
      ) : (images?.length ?? 0) === 0 ? (
        <EmptyState
          icon="🛰️"
          title="No aerial images available"
          description="Upload aerial imagery first to draw planting-area polygons."
        />
      ) : !selected ? (
        <EmptyState
          icon="✏️"
          title="Pick an image to begin"
          description="Select an aerial image above to draw a polygon over it."
        />
      ) : (
        <div className="admin-editor">
          <Card title={`Drawing on ${selected.label ?? selected.id}`}>
            <div className="admin-editor__canvas-wrap">
              <img
                ref={imgRef}
                src={imageUrl(selected.thumbnailUrl ?? selected.url)}
                alt={selected.label ?? "Aerial image"}
                className="admin-editor__canvas"
                onLoad={(e) => {
                  const t = e.currentTarget;
                  setImgSize({ w: t.naturalWidth, h: t.naturalHeight });
                }}
                style={{ position: "absolute", inset: 0, userSelect: "none" }}
              />
              <canvas
                ref={canvasRef}
                onClick={onImageClick}
                className="admin-editor__canvas"
                style={{ position: "relative", zIndex: 1 }}
              />
            </div>
            <div className="admin-toolbar" style={{ marginTop: "0.75rem" }}>
              <Button variant="secondary" onClick={undo} disabled={vertices.length === 0}>
                Undo
              </Button>
              <Button variant="secondary" onClick={clearAll} disabled={vertices.length === 0}>
                Clear
              </Button>
              <Tag>{vertices.length} vertices</Tag>
              {selected.bounds ? (
                <Tag>georeferenced</Tag>
              ) : (
                <Tag>no geo bounds — pixel outline saved</Tag>
              )}
            </div>
          </Card>

          <div className="admin-editor__side">
            <Card title="Save planting area">
              {saveError ? <div className="admin-error">{saveError}</div> : null}
              {saved ? (
                <div className="admin-error" style={{ backgroundColor: "var(--farm-color-primary-soft)", color: "var(--farm-color-primary)", borderColor: "var(--farm-color-primary-soft)" }}>
                  Saved “{saved.name}” ({saved.id})
                </div>
              ) : null}
              <div className="admin-form">
                <label className="admin-field">
                  <span className="admin-field__label">Name</span>
                  <input
                    className="admin-field__input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. North field"
                  />
                </label>
                <label className="admin-field">
                  <span className="admin-field__label">Code</span>
                  <input
                    className="admin-field__input"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. F1"
                  />
                </label>
                <span className="admin-field__hint">
                  A polygon needs at least 3 vertices to save.
                </span>
                <Button onClick={save} disabled={!canSave || saving}>
                  {saving ? "Saving…" : "Save planting area"}
                </Button>
              </div>
            </Card>

            {vertices.length > 0 ? (
              <Card title="Vertices">
                <ol className="admin-editor__vertex-list">
                  {vertices.map((v, i) => (
                    <li className="admin-editor__vertex" key={`${i}-${v.x}-${v.y}`}>
                      <span>
                        {i + 1}. {Math.round(v.x)}, {Math.round(v.y)}
                      </span>
                      <button
                        type="button"
                        className="admin-editor__vertex-remove"
                        onClick={() => removeVertex(i)}
                        aria-label={`Remove vertex ${i + 1}`}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ol>
              </Card>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
