/**
 * @farm/admin — crops page.
 *
 * Lists crops in a DataTable with status/category filters and a search box,
 * and supports creating and editing crops through a modal form.
 */

import { useMemo, useState } from "react";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Modal,
  SearchInput,
  Spinner,
  Tag,
} from "@farm/ui";
import {
  cropsApi,
  type CropInput,
  type CropUpdate,
} from "../api.js";
import { useAsync } from "../hooks.js";
import type { Crop, CropCategory, CropStatus } from "@farm/types";

const CATEGORIES: CropCategory[] = [
  "vegetable",
  "fruit",
  "herb",
  "flower",
  "grain",
  "other",
];
const STATUSES: CropStatus[] = [
  "planned",
  "seeded",
  "growing",
  "ready",
  "harvested",
  "failed",
];

const EMPTY_FORM: CropInput = {
  name: "",
  variety: "",
  category: "vegetable",
  status: "planned",
};

export function CropsPage(): JSX.Element {
  const [statusFilter, setStatusFilter] = useState<CropStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState<CropCategory | "">("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Crop | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CropInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const { data, loading, error, refresh } = useAsync<Crop[]>(() =>
    cropsApi.list({
      status: statusFilter || undefined,
      category: categoryFilter || undefined,
    }),
  );

  const rows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.variety.toLowerCase().includes(q) ||
        (c.notes ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(undefined);
    setCreating(true);
  };

  const openEdit = (crop: Crop) => {
    setForm({
      name: crop.name,
      variety: crop.variety,
      category: crop.category,
      status: crop.status,
      daysToMaturity: crop.daysToMaturity,
      plantedOn: crop.plantedOn,
      harvestedOn: crop.harvestedOn,
      notes: crop.notes,
    });
    setFormError(undefined);
    setEditing(crop);
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
      if (editing) {
        const update: CropUpdate = {
          ...form,
          daysToMaturity: form.daysToMaturity || undefined,
          plantedOn: form.plantedOn || undefined,
          harvestedOn: form.harvestedOn || undefined,
          notes: form.notes || undefined,
        };
        await cropsApi.update(editing.id, update);
      } else {
        await cropsApi.create(form);
      }
      closeForm();
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (crop: Crop) => {
    if (!window.confirm(`Delete crop "${crop.name}"?`)) return;
    try {
      await cropsApi.remove(crop.id);
      refresh();
    } catch (err) {
      window.alert(`Failed to delete: ${err instanceof Error ? err.message : err}`);
    }
  };

  return (
    <div className="admin-grid">
      {error ? (
        <div className="admin-error">
          Failed to load crops: {error}.{" "}
          <button type="button" onClick={refresh} className="admin-field__hint">
            Retry
          </button>
        </div>
      ) : null}

      <div className="admin-page-head">
        <div className="admin-page-head__filters">
          <select
            className="admin-field__select"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as CropStatus | "")
            }
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="admin-field__select"
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as CropCategory | "")
            }
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <SearchInput
            placeholder="Search crops…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={openCreate}>+ New crop</Button>
      </div>

      <Card>
        {loading && !data ? (
          <div className="admin-center">
            <Spinner label="Loading crops" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="🌱"
            title="No crops found"
            description="Adjust the filters or add a new crop to get started."
            action={<Button onClick={openCreate}>+ New crop</Button>}
          />
        ) : (
          <DataTable
            rows={rows}
            rowKey={(c) => c.id}
            columns={[
              { key: "name", header: "Name", render: (c) => <strong>{c.name}</strong> },
              { key: "variety", header: "Variety" },
              { key: "category", header: "Category", render: (c) => <Tag>{c.category}</Tag> },
              {
                key: "status",
                header: "Status",
                render: (c) => <Tag>{c.status}</Tag>,
              },
              {
                key: "daysToMaturity",
                header: "Days",
                render: (c) => (c.daysToMaturity ? String(c.daysToMaturity) : "—"),
              },
              {
                key: "actions",
                header: "",
                width: "8rem",
                render: (c) => (
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Button variant="ghost" onClick={() => openEdit(c)}>
                      Edit
                    </Button>
                    <Button variant="secondary" onClick={() => remove(c)}>
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
        title={editing ? `Edit ${editing.name}` : "New crop"}
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
          <div className="admin-form__row">
            <label className="admin-field">
              <span className="admin-field__label">Name</span>
              <input
                className="admin-field__input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label className="admin-field">
              <span className="admin-field__label">Variety</span>
              <input
                className="admin-field__input"
                value={form.variety}
                onChange={(e) => setForm({ ...form, variety: e.target.value })}
                required
              />
            </label>
          </div>
          <div className="admin-form__row">
            <label className="admin-field">
              <span className="admin-field__label">Category</span>
              <select
                className="admin-field__select"
                value={form.category ?? ""}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as CropCategory })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              <span className="admin-field__label">Status</span>
              <select
                className="admin-field__select"
                value={form.status ?? ""}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as CropStatus })
                }
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              <span className="admin-field__label">Days to maturity</span>
              <input
                className="admin-field__input"
                type="number"
                min="1"
                value={form.daysToMaturity ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    daysToMaturity: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              />
            </label>
          </div>
          <div className="admin-form__row">
            <label className="admin-field">
              <span className="admin-field__label">Planted on</span>
              <input
                className="admin-field__input"
                type="date"
                value={form.plantedOn ?? ""}
                onChange={(e) =>
                  setForm({ ...form, plantedOn: e.target.value || undefined })
                }
              />
            </label>
            <label className="admin-field">
              <span className="admin-field__label">Harvested on</span>
              <input
                className="admin-field__input"
                type="date"
                value={form.harvestedOn ?? ""}
                onChange={(e) =>
                  setForm({ ...form, harvestedOn: e.target.value || undefined })
                }
              />
            </label>
          </div>
          <label className="admin-field">
            <span className="admin-field__label">Notes</span>
            <textarea
              className="admin-field__textarea"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
