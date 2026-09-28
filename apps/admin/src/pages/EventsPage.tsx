/**
 * @farm/admin — events page.
 *
 * Combines a month calendar (via @farm/ui CalendarGrid) with a DataTable of
 * events, filters by kind/visibility, and a create/edit modal.
 */

import { useMemo, useState } from "react";
import {
  Button,
  Card,
  CalendarGrid,
  DataTable,
  EmptyState,
  Modal,
  SearchInput,
  Spinner,
  Tag,
} from "@farm/ui";
import {
  eventsApi,
  type EventInput,
  type EventUpdate,
} from "../api.js";
import { useAsync, formatDate } from "../hooks.js";
import type { EventKind, EventVisibility, FarmEvent } from "@farm/types";

const KINDS: EventKind[] = [
  "market",
  "volunteer",
  "tour",
  "workshop",
  "harvest",
  "planting",
  "maintenance",
  "other",
];
const VISIBILITIES: EventVisibility[] = ["public", "members", "private"];

const EMPTY_FORM: EventInput = {
  title: "",
  kind: "other",
  visibility: "public",
  startsAt: "",
  endsAt: "",
  location: "",
  capacity: undefined,
};

function toDateInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Format as yyyy-MM-ddTHH:mm in local time for <input type="datetime-local">.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Local shape matching @farm/ui CalendarGridEvent (not re-exported by the package). */
interface CalendarEventItem {
  date: string;
  label: string;
}

export function EventsPage(): JSX.Element {
  const [kindFilter, setKindFilter] = useState<EventKind | "">("");
  const [visFilter, setVisFilter] = useState<EventVisibility | "">("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<FarmEvent | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<EventInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const today = useMemo(() => new Date(), []);

  const { data, loading, error, refresh } = useAsync<FarmEvent[]>(() =>
    eventsApi.list({
      kind: kindFilter || undefined,
      visibility: visFilter || undefined,
    }),
  );

  const rows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return q
      ? data.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            (e.description ?? "").toLowerCase().includes(q) ||
            (e.location ?? "").toLowerCase().includes(q),
        )
      : data;
  }, [data, search]);

  const calendarEvents = useMemo<CalendarEventItem[]>(
    () =>
      rows.map((e) => ({
        date: toDateKey(e.startsAt),
        label: e.title,
      })),
    [rows],
  );

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setFormError(undefined);
    setCreating(true);
  };

  const openEdit = (event: FarmEvent) => {
    setForm({
      title: event.title,
      description: event.description,
      kind: event.kind,
      visibility: event.visibility,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      location: event.location,
      capacity: event.capacity,
      attendeeIds: event.attendeeIds,
    });
    setFormError(undefined);
    setEditing(event);
  };

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setFormError(undefined);
  };

  const submit = async () => {
    setSaving(true);
    setFormError(undefined);
    try {
      const cleaned: EventInput = {
        ...form,
        description: form.description || undefined,
        location: form.location || undefined,
        capacity: form.capacity || undefined,
        // Convert datetime-local value to ISO for the API.
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : "",
      };
      if (!cleaned.startsAt || !cleaned.endsAt) {
        setFormError("Start and end times are required.");
        setSaving(false);
        return;
      }
      if (editing) {
        const update: EventUpdate = cleaned;
        await eventsApi.update(editing.id, update);
      } else {
        await eventsApi.create(cleaned);
      }
      closeForm();
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (event: FarmEvent) => {
    if (!window.confirm(`Delete event "${event.title}"?`)) return;
    try {
      await eventsApi.remove(event.id);
      refresh();
    } catch (err) {
      window.alert(`Failed to delete: ${err instanceof Error ? err.message : err}`);
    }
  };

  return (
    <div className="admin-grid">
      {error ? (
        <div className="admin-error">
          Failed to load events: {error}.{" "}
          <button type="button" onClick={refresh} className="admin-field__hint">
            Retry
          </button>
        </div>
      ) : null}

      <div className="admin-page-head">
        <div className="admin-page-head__filters">
          <select
            className="admin-field__select"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as EventKind | "")}
            aria-label="Filter by kind"
          >
            <option value="">All kinds</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <select
            className="admin-field__select"
            value={visFilter}
            onChange={(e) => setVisFilter(e.target.value as EventVisibility | "")}
            aria-label="Filter by visibility"
          >
            <option value="">All visibility</option>
            {VISIBILITIES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <SearchInput
            placeholder="Search events…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={openCreate}>+ New event</Button>
      </div>

      <Card title="Calendar">
        <CalendarGrid
          year={today.getFullYear()}
          month={today.getMonth() + 1}
          events={calendarEvents}
          today={today}
        />
      </Card>

      <Card title="All events">
        {loading && !data ? (
          <div className="admin-center">
            <Spinner label="Loading events" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="📅"
            title="No events found"
            description="Adjust filters or create a new event."
            action={<Button onClick={openCreate}>+ New event</Button>}
          />
        ) : (
          <DataTable
            rows={rows}
            rowKey={(e) => e.id}
            columns={[
              { key: "title", header: "Title", render: (e) => <strong>{e.title}</strong> },
              { key: "kind", header: "Kind", render: (e) => <Tag>{e.kind}</Tag> },
              {
                key: "visibility",
                header: "Visibility",
                render: (e) => <Tag>{e.visibility}</Tag>,
              },
              {
                key: "startsAt",
                header: "Starts",
                render: (e) => formatDate(e.startsAt),
              },
              {
                key: "location",
                header: "Location",
                render: (e) => e.location ?? "—",
              },
              {
                key: "actions",
                header: "",
                width: "8rem",
                render: (e) => (
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Button variant="ghost" onClick={() => openEdit(e)}>
                      Edit
                    </Button>
                    <Button variant="secondary" onClick={() => remove(e)}>
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Modal
        open={creating || editing !== null}
        title={editing ? `Edit ${editing.title}` : "New event"}
        onClose={closeForm}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        {formError ? <div className="admin-error">{formError}</div> : null}
        <div className="admin-form">
          <label className="admin-field">
            <span className="admin-field__label">Title</span>
            <input
              className="admin-field__input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </label>
          <div className="admin-form__row">
            <label className="admin-field">
              <span className="admin-field__label">Kind</span>
              <select
                className="admin-field__select"
                value={form.kind ?? "other"}
                onChange={(e) =>
                  setForm({ ...form, kind: e.target.value as EventKind })
                }
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              <span className="admin-field__label">Visibility</span>
              <select
                className="admin-field__select"
                value={form.visibility ?? "public"}
                onChange={(e) =>
                  setForm({ ...form, visibility: e.target.value as EventVisibility })
                }
              >
                {VISIBILITIES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="admin-form__row">
            <label className="admin-field">
              <span className="admin-field__label">Starts at</span>
              <input
                className="admin-field__input"
                type="datetime-local"
                value={form.startsAt ? toDateInput(form.startsAt) : ""}
                onChange={(e) =>
                  setForm({ ...form, startsAt: e.target.value })
                }
                required
              />
            </label>
            <label className="admin-field">
              <span className="admin-field__label">Ends at</span>
              <input
                className="admin-field__input"
                type="datetime-local"
                value={form.endsAt ? toDateInput(form.endsAt) : ""}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                required
              />
            </label>
          </div>
          <div className="admin-form__row">
            <label className="admin-field">
              <span className="admin-field__label">Location</span>
              <input
                className="admin-field__input"
                value={form.location ?? ""}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </label>
            <label className="admin-field">
              <span className="admin-field__label">Capacity</span>
              <input
                className="admin-field__input"
                type="number"
                min="1"
                value={form.capacity ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    capacity: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </label>
          </div>
          <label className="admin-field">
            <span className="admin-field__label">Description</span>
            <textarea
              className="admin-field__textarea"
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
