/**
 * @farm/backend — Customers service.
 *
 * CRUD for the `customers` table. The nested {@link Address} is serialised to
 * a JSON text column and reconstructed on read.
 */

import type { Database } from "../db/index.js";
import type { Address, Customer } from "@farm/types";
import { fromBool, generateId, nowIso, parseJsonColumn, toBool, toJsonColumn } from "./_shared.js";

interface CustomerRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  is_member: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerInput {
  name: string;
  email: string;
  phone?: string;
  address?: Address;
  isMember?: boolean;
  notes?: string;
}

export interface UpdateCustomerInput {
  name?: string;
  email?: string;
  phone?: string | null;
  address?: Address | null;
  isMember?: boolean;
  notes?: string | null;
}

export interface CustomerFilters {
  isMember?: boolean;
  search?: string;
}

function rowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    address: parseJsonColumn<Address>(row.address),
    isMember: toBool(row.is_member),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createCustomersService(db: Database) {
  const stmtAll = db.prepare<[], CustomerRow>(`SELECT * FROM customers ORDER BY created_at DESC`);
  const stmtById = db.prepare<[string], CustomerRow>(`SELECT * FROM customers WHERE id = ?`);
  const stmtMembers = db.prepare<[number], CustomerRow>(
    `SELECT * FROM customers WHERE is_member = ? ORDER BY created_at DESC`,
  );
  const stmtSearch = db.prepare<{ search: string }, CustomerRow>(
    `SELECT * FROM customers
       WHERE name LIKE @search OR email LIKE @search OR phone LIKE @search
       ORDER BY created_at DESC`,
  );

  function list(filters: CustomerFilters = {}): Customer[] {
    if (filters.search) {
      const like = `%${filters.search}%`;
      return stmtSearch.all({ search: like }).map(rowToCustomer);
    }
    if (filters.isMember !== undefined) {
      return stmtMembers.all(fromBool(filters.isMember)).map(rowToCustomer);
    }
    return stmtAll.all().map(rowToCustomer);
  }

  function getById(id: string): Customer | undefined {
    const row = stmtById.get(id);
    return row ? rowToCustomer(row) : undefined;
  }

  function create(input: CreateCustomerInput): Customer {
    const id = generateId();
    const ts = nowIso();
    db.prepare(
      `INSERT INTO customers
        (id, name, email, phone, address, is_member, notes, created_at, updated_at)
       VALUES (@id, @name, @email, @phone, @address, @is_member, @notes, @created_at, @updated_at)`,
    ).run({
      id,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      address: toJsonColumn(input.address),
      is_member: fromBool(input.isMember),
      notes: input.notes ?? null,
      created_at: ts,
      updated_at: ts,
    });
    const created = getById(id);
    if (!created) throw new Error(`Failed to read back customer ${id}`);
    return created;
  }

  function update(id: string, input: UpdateCustomerInput): Customer | undefined {
    const existing = stmtById.get(id);
    if (!existing) return undefined;
    const ts = nowIso();
    const merged: CustomerRow = {
      ...existing,
      name: input.name ?? existing.name,
      email: input.email ?? existing.email,
      phone: input.phone === null ? null : input.phone ?? existing.phone,
      address:
        input.address === null ? null : toJsonColumn(input.address) ?? existing.address,
      is_member:
        input.isMember === undefined ? existing.is_member : fromBool(input.isMember),
      notes: input.notes === null ? null : input.notes ?? existing.notes,
      updated_at: ts,
    };
    db.prepare(
      `UPDATE customers SET
        name = @name, email = @email, phone = @phone, address = @address,
        is_member = @is_member, notes = @notes, updated_at = @updated_at
       WHERE id = @id`,
    ).run(merged);
    return getById(id);
  }

  function remove(id: string): boolean {
    const result = db.prepare(`DELETE FROM customers WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  function all(): Customer[] {
    return stmtAll.all().map(rowToCustomer);
  }

  return { list, getById, create, update, remove, all };
}

export type CustomersService = ReturnType<typeof createCustomersService>;
