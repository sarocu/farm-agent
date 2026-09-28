/**
 * @farm/customer — calendar page.
 *
 * A month grid (via @farm/ui CalendarGrid) of public + members events, a
 * kind filter, and a chronological list of upcoming events. Customers can
 * see what's happening on the farm but cannot edit events from here.
 */

import { useMemo, useState } from "react";
import {
  Card,
  CalendarGrid,
  EmptyState,
  SearchInput,
  Spinner,
  Tag,
} from "@farm/ui";
import { eventsApi } from "../api.js";
import { useAsync, formatDate } from "../hooks.js";
import type { EventKind, FarmEvent } from "@farm/types";

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

const KIND_EMOJI: Record<EventKind, string> = {
  market: "🛒",
  volunteer: "🤝",
  tour: "🚶",
  workshop: "🧑‍🌾",
  harvest: "🌾",
  planting: "🌱",
  maintenance: "🔧",
  other: "📌",
};

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function CalendarPage(): JSX.Element {
  const [kindFilter, setKindFilter] = useState<EventKind | "">("");
  const [search, setSearch] = useState("");

  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);

  const { data, loading, error, refresh } = useAsync<FarmEvent[]>(() =>
    // `members` events are visible to logged-in members; `public` to all.
    // We fetch both and filter client-side by visibility on the public site.
    eventsApi.list({
      kind: kindFilter || undefined,
      from: new Date(viewYear, viewMonth - 1, 1).toISOString(),
      to: new Date(viewYear, viewMonth, 0, 23, 59, 59).toISOString(),
    }),
  );

  const visible = useMemo(() => {
    const all = (data ?? []).filter(
      (e) => e.visibility === "public" || e.visibility === "members",
    );
    const q = search.trim().toLowerCase();
    return q
      ? all.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            (e.description ?? "").toLowerCase().includes(q) ||
            (e.location ?? "").toLowerCase().includes(q),
        )
      : all;
  }, [data, search]);

  const calendarEvents = useMemo(
    () =>
      visible.map((e) => ({
        date: toDateKey(e.startsAt),
        label: `${KIND_EMOJI[e.kind]} ${e.title}`,
      })),
    [visible],
  );

  const upcoming = useMemo(() => {
    const now = new Date().toISOString();
    return [...visible]
      .filter((e) => e.startsAt >= now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [visible]);

  const goPrev = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };
  const goNext = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <div className="customer-page">
      <h1 className="customer-page__title">Farm calendar</h1>

      {error ? (
        <div className="customer-error">
          Couldn't load events: {error}.{" "}
          <button
            type="button"
            className="customer-error__retry"
            onClick={refresh}
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="customer-page__filters">
        <select
          className="customer-select"
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as EventKind | "")}
          aria-label="Filter by kind"
        >
          <option value="">All kinds</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_EMOJI[k]} {k}
            </option>
          ))}
        </select>
        <SearchInput
          placeholder="Search events…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card
        title={monthLabel(viewYear, viewMonth)}
        actions={
          <div className="customer-monthnav">
            <button
              type="button"
              className="customer-monthnav__btn"
              onClick={goPrev}
              aria-label="Previous month"
            >
              ‹
            </button>
            <button
              type="button"
              className="customer-monthnav__btn"
              onClick={goNext}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        }
      >
        {loading && !data ? (
          <div className="customer-center">
            <Spinner label="Loading calendar" />
          </div>
        ) : (
          <CalendarGrid
            year={viewYear}
            month={viewMonth}
            events={calendarEvents}
            today={today}
          />
        )}
      </Card>

      <Card title="Upcoming events">
        {loading && !data ? (
          <div className="customer-center">
            <Spinner label="Loading events" />
          </div>
        ) : upcoming.length === 0 ? (
          <EmptyState
            icon="📅"
            title="No upcoming events"
            description="Try a different kind filter or month."
          />
        ) : (
          <ul className="customer-event-list">
            {upcoming.map((event) => (
              <li key={event.id} className="customer-event-list__item">
                <div className="customer-event-list__when">
                  <span className="customer-event-list__date">
                    {formatDate(event.startsAt)}
                  </span>
                </div>
                <div className="customer-event-list__body">
                  <span className="customer-event-list__title">
                    {KIND_EMOJI[event.kind]} {event.title}
                  </span>
                  <span className="customer-event-list__meta">
                    <Tag>{event.kind}</Tag>{" "}
                    {event.visibility === "members" ? (
                      <Tag>members</Tag>
                    ) : null}{" "}
                    {event.location ? `📍 ${event.location}` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
