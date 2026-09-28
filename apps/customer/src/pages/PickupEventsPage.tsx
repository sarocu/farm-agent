/**
 * @farm/customer — pickup events page.
 *
 * Lists farm events that double as CSA pickup opportunities (market and
 * harvest kinds), shows capacity and current RSVP count, and lets a
 * customer RSVP / cancel by entering their customer id.
 *
 * The customer id is the "login" for the public site — it's remembered in
 * `localStorage` so the customer doesn't re-enter it on every visit.
 */

import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Spinner, Tag, Badge } from "@farm/ui";
import { eventsApi, ApiError } from "../api.js";
import { useAsync, formatDate } from "../hooks.js";
import type { EventKind, FarmEvent } from "@farm/types";

const PICKUP_KINDS: EventKind[] = ["market", "harvest"];

const STORAGE_KEY = "farm.customer.pickup.customerId";

function loadCustomerId(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveCustomerId(id: string): void {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore storage failures */
  }
}

export function PickupEventsPage(): JSX.Element {
  const { data, loading, error, refresh } = useAsync<FarmEvent[]>(() =>
    eventsApi.list(),
  );

  // Pickups are future market/harvest events.
  const pickups = useMemo(() => {
    const now = new Date().toISOString();
    return (data ?? [])
      .filter(
        (e) =>
          PICKUP_KINDS.includes(e.kind) &&
          e.visibility !== "private" &&
          e.startsAt >= now,
      )
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [data]);

  return (
    <div className="customer-page">
      <h1 className="customer-page__title">Pickup events</h1>
      <p className="customer-page__lede">
        Reserve a spot at one of our market or harvest pickup events. Enter
        your customer id once and we'll remember it on this device.
      </p>

      {error ? (
        <div className="customer-error">
          Couldn't load pickup events: {error}.{" "}
          <button
            type="button"
            className="customer-error__retry"
            onClick={refresh}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="customer-center">
          <Spinner label="Loading pickup events" />
        </div>
      ) : pickups.length === 0 ? (
        <EmptyState
          icon="🧺"
          title="No pickup events scheduled"
          description="New market and harvest pickup events will appear here."
        />
      ) : (
        <div className="customer-pickup-grid">
          {pickups.map((event) => (
            <PickupCard key={event.id} event={event} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function PickupCard({
  event,
  onChanged,
}: {
  event: FarmEvent;
  onChanged: () => void;
}): JSX.Element {
  const [customerId, setCustomerId] = useState<string>(() => loadCustomerId());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | undefined>(undefined);
  const [errMsg, setErrMsg] = useState<string | undefined>(undefined);

  // Persist the customer id whenever it changes.
  useEffect(() => {
    saveCustomerId(customerId);
  }, [customerId]);

  const attendeeIds = event.attendeeIds ?? [];
  const isRsvped = customerId
    ? attendeeIds.includes(customerId)
    : false;
  const capacity = event.capacity;
  const spotsLeft =
    capacity !== undefined ? Math.max(0, capacity - attendeeIds.length) : undefined;
  const isFull = spotsLeft !== undefined && spotsLeft <= 0 && !isRsvped;

  const rsvp = async () => {
    if (!customerId.trim()) {
      setErrMsg("Enter your customer id first.");
      return;
    }
    setBusy(true);
    setMsg(undefined);
    setErrMsg(undefined);
    try {
      await eventsApi.rsvp(event.id, customerId.trim());
      setMsg("You're signed up! See you at the pickup.");
      onChanged();
    } catch (err) {
      setErrMsg(
        err instanceof ApiError
          ? `Couldn't sign up: ${err.message}`
          : "Couldn't sign up. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setMsg(undefined);
    setErrMsg(undefined);
    try {
      await eventsApi.cancelRsvp(event.id, customerId.trim());
      setMsg("Your spot has been released.");
      onChanged();
    } catch (err) {
      setErrMsg(
        err instanceof ApiError
          ? `Couldn't cancel: ${err.message}`
          : "Couldn't cancel. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={event.title}>
      <div className="customer-pickup-card__meta">
        <Tag>{event.kind}</Tag>
        {event.visibility === "members" ? <Tag>members</Tag> : null}
        {capacity !== undefined ? (
          isFull ? (
            <Badge variant="danger">Full</Badge>
          ) : (
            <Tag>
              {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left
            </Tag>
          )
        ) : null}
      </div>
      <dl className="customer-pickup-card__details">
        <div>
          <dt>When</dt>
          <dd>{formatDate(event.startsAt)}</dd>
        </div>
        {event.location ? (
          <div>
            <dt>Where</dt>
            <dd>{event.location}</dd>
          </div>
        ) : null}
        <div>
          <dt>Attending</dt>
          <dd>
            {attendeeIds.length}
            {capacity !== undefined ? ` / ${capacity}` : ""} reserved
          </dd>
        </div>
      </dl>
      {event.description ? (
        <p className="customer-pickup-card__desc">{event.description}</p>
      ) : null}

      <label className="customer-field">
        <span className="customer-field__label">Your customer id</span>
        <input
          className="customer-field__input"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          placeholder="e.g. cust_abc123"
          disabled={busy}
        />
      </label>

      {msg ? <p className="customer-success">{msg}</p> : null}
      {errMsg ? <p className="customer-error">{errMsg}</p> : null}

      <div className="customer-pickup-card__actions">
        {isRsvped ? (
          <Button variant="secondary" onClick={cancel} disabled={busy}>
            {busy ? "Cancelling…" : "Cancel my spot"}
          </Button>
        ) : (
          <Button onClick={rsvp} disabled={busy || isFull}>
            {busy ? "Saving…" : isFull ? "Event full" : "Reserve a spot"}
          </Button>
        )}
      </div>
    </Card>
  );
}
