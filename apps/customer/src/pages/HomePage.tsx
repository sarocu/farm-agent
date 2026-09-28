/**
 * @farm/customer — home / landing page.
 *
 * Shows a welcome hero, at-a-glance farm stats (from the dashboard
 * summary), the next few upcoming public events, and a peek at what's
 * ready to harvest this week.
 */

import { useMemo } from "react";
import { Card, StatTile, Tag, EmptyState, Spinner, Button } from "@farm/ui";
import {
  dashboardApi,
  eventsApi,
  cropsApi,
  type DashboardSummary,
} from "../api.js";
import { useAsync, formatDate, formatDateShort } from "../hooks.js";
import type { Crop, CropStatus, FarmEvent } from "@farm/types";

const STATUS_LABELS: Record<CropStatus, string> = {
  planned: "Planned",
  seeded: "Seeded",
  growing: "Growing",
  ready: "Ready",
  harvested: "Harvested",
  failed: "Failed",
};

export function HomePage(): JSX.Element {
  const dashboard = useAsync<DashboardSummary>(() =>
    dashboardApi.summary({ upcomingLimit: 4 }),
  );

  // Only public events belong on the public landing page.
  const events = useAsync<FarmEvent[]>(() =>
    eventsApi.list({ visibility: "public" }),
  );

  // "What's ready now" — crops in the `ready` status.
  const readyCrops = useAsync<Crop[]>(() => cropsApi.list({ status: "ready" }));

  const upcomingPublic = useMemo(() => {
    const all = events.data ?? [];
    const now = new Date().toISOString();
    return all
      .filter((e) => e.startsAt >= now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 4);
  }, [events.data]);

  return (
    <div className="customer-page">
      <section className="customer-hero">
        <h1 className="customer-hero__title">Welcome to the Farm</h1>
        <p className="customer-hero__subtitle">
          Fresh, locally grown produce delivered through our Community
          Supported Agriculture program. Browse what's growing, find a
          pickup event, and manage your subscription.
        </p>
        <div className="customer-hero__actions">
          <Button onClick={() => (window.location.hash = "/calendar")}>
            View calendar
          </Button>
          <Button
            variant="secondary"
            onClick={() => (window.location.hash = "/pickup")}
          >
            Find a pickup
          </Button>
        </div>
      </section>

      {dashboard.error ? (
        <div className="customer-error">
          Couldn't load farm highlights: {dashboard.error}.{" "}
          <button
            type="button"
            className="customer-error__retry"
            onClick={dashboard.refresh}
          >
            Retry
          </button>
        </div>
      ) : null}

      {dashboard.loading && !dashboard.data ? (
        <div className="customer-center">
          <Spinner label="Loading farm highlights" />
        </div>
      ) : null}

      {dashboard.data ? (
        <section className="customer-stats">
          <StatTile
            label="Crops growing"
            value={dashboard.data.crops.total}
            hint="tracked on the farm"
          />
          <StatTile
            label="Members"
            value={dashboard.data.customers.members}
            hint={`of ${dashboard.data.customers.total} customers`}
          />
          <StatTile
            label="Upcoming events"
            value={dashboard.data.events.upcoming}
            hint={`of ${dashboard.data.events.total} total`}
          />
          <StatTile
            label="Planting areas"
            value={dashboard.data.plantingAreas.total}
            hint="in cultivation"
          />
        </section>
      ) : null}

      <div className="customer-grid customer-grid--2">
        <Card title="Upcoming events" actions={<Tag>Public</Tag>}>
          {events.loading && !events.data ? (
            <div className="customer-center">
              <Spinner label="Loading events" />
            </div>
          ) : upcomingPublic.length === 0 ? (
            <EmptyState
              icon="📅"
              title="No upcoming public events"
              description="Check back soon — new farm events are added regularly."
            />
          ) : (
            <ul className="customer-event-list">
              {upcomingPublic.map((event) => (
                <li key={event.id} className="customer-event-list__item">
                  <div className="customer-event-list__when">
                    <span className="customer-event-list__date">
                      {formatDateShort(event.startsAt)}
                    </span>
                    <span className="customer-event-list__time">
                      {formatTime(event.startsAt)}
                    </span>
                  </div>
                  <div className="customer-event-list__body">
                    <span className="customer-event-list__title">
                      {event.title}
                    </span>
                    {event.location ? (
                      <span className="customer-event-list__meta">
                        📍 {event.location}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Ready to harvest" actions={<Tag>Now</Tag>}>
          {readyCrops.loading && !readyCrops.data ? (
            <div className="customer-center">
              <Spinner label="Loading crops" />
            </div>
          ) : !readyCrops.data || readyCrops.data.length === 0 ? (
            <EmptyState
              icon="🌱"
              title="Nothing ready yet"
              description="Crops marked ready for harvest will show up here."
            />
          ) : (
            <ul className="customer-crop-list">
              {readyCrops.data.map((crop) => (
                <li key={crop.id} className="customer-crop-list__item">
                  <span className="customer-crop-list__name">
                    {crop.name}{" "}
                    <span className="customer-crop-list__variety">
                      {crop.variety}
                    </span>
                  </span>
                  <Tag>{STATUS_LABELS[crop.status]}</Tag>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Format an ISO date-time as a short local time string. */
function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Re-export so other pages can share these formatters if desired.
export { formatDate, formatDateShort };
