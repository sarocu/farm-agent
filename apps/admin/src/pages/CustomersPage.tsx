/**
 * @farm/admin — customers page.
 *
 * Lists customers with a member filter and search, supports creating and
 * editing customers (including their address) through a modal form.
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
  customersApi,
  type CustomerInput,
  type CustomerUpdate,
} from "../api.js";
import { useAsync, formatDate } from "../hooks.js";
import type { Customer } from "@farm/types";

type MemberFilter = "" | "true" | "false";

/** Form-local address: every field is always a string (empty when blank). */
interface AddressForm {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface CustomerForm {
  name: string;
  email: string;
  phone: string;
  isMember: boolean;
  address: AddressForm;
  notes: string;
}

const EMPTY_ADDRESS: AddressForm = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

const EMPTY_FORM: CustomerForm = {
  name: "",
  email: "",
  phone: "",
  isMember: false,
  address: { ...EMPTY_ADDRESS },
  notes: "",
};

export function CustomersPage(): JSX.Element {
  const [memberFilter, setMemberFilter] = useState<MemberFilter>("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const { data, loading, error, refresh } = useAsync<Customer[]>(() =>
    customersApi.list({
      isMember:
        memberFilter === "true" ? true : memberFilter === "false" ? false : undefined,
      search: search.trim() || undefined,
    }),
  );

  const rows = useMemo(() => data ?? [], [data]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(undefined);
    setCreating(true);
  };

  const openEdit = (customer: Customer) => {
    const addr = customer.address;
    setForm({
      name: customer.name,
      email: customer.email,
      phone: customer.phone ?? "",
      isMember: customer.isMember,
      address: {
        line1: addr?.line1 ?? "",
        line2: addr?.line2 ?? "",
        city: addr?.city ?? "",
        state: addr?.state ?? "",
        postalCode: addr?.postalCode ?? "",
        country: addr?.country ?? "",
      },
      notes: customer.notes ?? "",
    });
    setFormError(undefined);
    setEditing(customer);
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
      const cleaned: CustomerInput = {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        isMember: form.isMember,
        notes: form.notes || undefined,
        address: form.address.line1
          ? {
              line1: form.address.line1,
              line2: form.address.line2 || undefined,
              city: form.address.city,
              state: form.address.state,
              postalCode: form.address.postalCode,
              country: form.address.country,
            }
          : undefined,
      };
      if (editing) {
        const update: CustomerUpdate = cleaned;
        await customersApi.update(editing.id, update);
      } else {
        await customersApi.create(cleaned);
      }
      closeForm();
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (customer: Customer) => {
    if (!window.confirm(`Delete customer "${customer.name}"?`)) return;
    try {
      await customersApi.remove(customer.id);
      refresh();
    } catch (err) {
      window.alert(`Failed to delete: ${err instanceof Error ? err.message : err}`);
    }
  };

  return (
    <div className="admin-grid">
      {error ? (
        <div className="admin-error">
          Failed to load customers: {error}.{" "}
          <button type="button" onClick={refresh} className="admin-field__hint">
            Retry
          </button>
        </div>
      ) : null}

      <div className="admin-page-head">
        <div className="admin-page-head__filters">
          <select
            className="admin-field__select"
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value as MemberFilter)}
            aria-label="Filter by membership"
          >
            <option value="">All customers</option>
            <option value="true">Members only</option>
            <option value="false">Non-members</option>
          </select>
          <SearchInput
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={openCreate}>+ New customer</Button>
      </div>

      <Card>
        {loading && !data ? (
          <div className="admin-center">
            <Spinner label="Loading customers" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No customers found"
            description="Try a different search or add a new customer."
            action={<Button onClick={openCreate}>+ New customer</Button>}
          />
        ) : (
          <DataTable
            rows={rows}
            rowKey={(c) => c.id}
            columns={[
              { key: "name", header: "Name", render: (c) => <strong>{c.name}</strong> },
              { key: "email", header: "Email" },
              { key: "phone", header: "Phone", render: (c) => c.phone ?? "—" },
              {
                key: "isMember",
                header: "Member",
                render: (c) => (c.isMember ? <Tag>member</Tag> : "—"),
              },
              {
                key: "createdAt",
                header: "Joined",
                render: (c) => formatDate(c.createdAt),
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
        title={editing ? `Edit ${editing.name}` : "New customer"}
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
              <span className="admin-field__label">Email</span>
              <input
                className="admin-field__input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>
            <label className="admin-field">
              <span className="admin-field__label">Phone</span>
              <input
                className="admin-field__input"
                value={form.phone ?? ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
          </div>

          <fieldset className="admin-field" style={{ border: "none", padding: 0 }}>
            <legend className="admin-field__label" style={{ marginBottom: "0.3rem" }}>
              Address
            </legend>
            <div className="admin-form">
              <label className="admin-field">
                <span className="admin-field__label">Street</span>
                <input
                  className="admin-field__input"
                  value={form.address?.line1 ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      address: { ...form.address!, line1: e.target.value },
                    })
                  }
                />
              </label>
              <div className="admin-form__row">
                <label className="admin-field">
                  <span className="admin-field__label">City</span>
                  <input
                    className="admin-field__input"
                    value={form.address?.city ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        address: { ...form.address!, city: e.target.value },
                      })
                    }
                  />
                </label>
                <label className="admin-field">
                  <span className="admin-field__label">State</span>
                  <input
                    className="admin-field__input"
                    value={form.address?.state ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        address: { ...form.address!, state: e.target.value },
                      })
                    }
                  />
                </label>
              </div>
              <div className="admin-form__row">
                <label className="admin-field">
                  <span className="admin-field__label">Postal code</span>
                  <input
                    className="admin-field__input"
                    value={form.address?.postalCode ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        address: { ...form.address!, postalCode: e.target.value },
                      })
                    }
                  />
                </label>
                <label className="admin-field">
                  <span className="admin-field__label">Country</span>
                  <input
                    className="admin-field__input"
                    value={form.address?.country ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        address: { ...form.address!, country: e.target.value },
                      })
                    }
                  />
                </label>
              </div>
            </div>
          </fieldset>

          <label className="admin-field" style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={form.isMember ?? false}
              onChange={(e) => setForm({ ...form, isMember: e.target.checked })}
            />
            <span className="admin-field__label">CSA member</span>
          </label>

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
