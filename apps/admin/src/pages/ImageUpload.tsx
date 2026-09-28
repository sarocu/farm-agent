/**
 * @farm/admin — image upload page.
 *
 * Drag-and-drop (or click) upload of an aerial image to the backend's
 * multipart `/api/aerial/upload` endpoint. Optional metadata fields
 * (label, captured date, center geo-point, meters-per-pixel) are sent
 * alongside the file. A live preview and a success toast are shown.
 */

import { useCallback, useRef, useState } from "react";
import { Button, Card, Tag } from "@farm/ui";
import { aerialApi, type AerialUploadInput } from "../api.js";
import { formatDate } from "../hooks.js";
import type { AerialImage } from "@farm/types";

export function ImageUpload(): JSX.Element {
  const [file, setFile] = useState<File | undefined>(undefined);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [label, setLabel] = useState("");
  const [capturedAt, setCapturedAt] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [metersPerPixel, setMetersPerPixel] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<AerialImage | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onPick = useCallback((picked: File | undefined) => {
    if (!picked) return;
    setFile(picked);
    setResult(undefined);
    setError(undefined);
    // Build an object URL for preview.
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(picked));
  }, [previewUrl]);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) onPick(dropped);
    },
    [onPick],
  );

  const reset = () => {
    setFile(undefined);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(undefined);
    setLabel("");
    setCapturedAt("");
    setLat("");
    setLng("");
    setMetersPerPixel("");
    setResult(undefined);
    setError(undefined);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setError(undefined);
    setResult(undefined);
    try {
      const input: AerialUploadInput = {
        file,
        label: label || undefined,
        capturedAt: capturedAt
          ? new Date(capturedAt).toISOString()
          : undefined,
        center:
          lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined,
        metersPerPixel: metersPerPixel ? Number(metersPerPixel) : undefined,
      };
      const created = await aerialApi.upload(input);
      setResult(created);
      // Keep the file/preview so the user can see what was uploaded.
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="admin-grid">
      <div className="admin-page-head">
        <h2 style={{ margin: 0 }}>Upload an aerial image</h2>
      </div>

      <Card>
        {error ? <div className="admin-error">{error}</div> : null}
        {result ? (
          <div
            className="admin-error"
            style={{
              backgroundColor: "var(--farm-color-primary-soft)",
              color: "var(--farm-color-primary)",
              borderColor: "var(--farm-color-primary-soft)",
            }}
          >
            Uploaded “{result.label ?? result.id}” — captured{" "}
            {formatDate(result.capturedAt)}.
          </div>
        ) : null}

        <div
          className={`admin-dropzone${dragging ? " admin-dropzone--active" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
        >
          <span className="admin-dropzone__icon">📤</span>
          {file ? (
            <strong>{file.name}</strong>
          ) : (
            <span>
              Drag &amp; drop an image here, or click to browse.
              <br />
              <span className="admin-field__hint">
                JPG, PNG, or WebP — up to 25 MB.
              </span>
            </span>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => onPick(e.target.files?.[0])}
          />
        </div>

        {previewUrl ? (
          <div style={{ textAlign: "center", margin: "1rem 0" }}>
            <img className="admin-preview-img" src={previewUrl} alt="Preview" />
          </div>
        ) : null}

        <div className="admin-form">
          <label className="admin-field">
            <span className="admin-field__label">Label (optional)</span>
            <input
              className="admin-field__input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. North field — June drone pass"
            />
          </label>
          <label className="admin-field">
            <span className="admin-field__label">Captured at (optional)</span>
            <input
              className="admin-field__input"
              type="datetime-local"
              value={capturedAt}
              onChange={(e) => setCapturedAt(e.target.value)}
            />
            <span className="admin-field__hint">
              Defaults to the current time when left blank.
            </span>
          </label>
          <div className="admin-form__row">
            <label className="admin-field">
              <span className="admin-field__label">Center latitude</span>
              <input
                className="admin-field__input"
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="e.g. 44.5"
              />
            </label>
            <label className="admin-field">
              <span className="admin-field__label">Center longitude</span>
              <input
                className="admin-field__input"
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="e.g. -123.2"
              />
            </label>
            <label className="admin-field">
              <span className="admin-field__label">Meters per pixel</span>
              <input
                className="admin-field__input"
                type="number"
                step="any"
                min="0"
                value={metersPerPixel}
                onChange={(e) => setMetersPerPixel(e.target.value)}
                placeholder="e.g. 0.05"
              />
            </label>
          </div>
          <div className="admin-form__actions">
            <Button variant="secondary" onClick={reset} disabled={uploading}>
              Reset
            </Button>
            <Button onClick={upload} disabled={!file || uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>
      </Card>

      {result ? (
        <Card title="Uploaded record">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <Tag>id: {result.id}</Tag>
            <Tag>url: {result.url}</Tag>
            {result.center ? (
              <Tag>
                center: {result.center.lat}, {result.center.lng}
              </Tag>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
