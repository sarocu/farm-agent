/**
 * @farm/admin — dashboard page.
 *
 * Shows summary stat tiles (crops, customers, events, aerial images,
 * planting areas), a crop-status breakdown, and a list of upcoming events.
 */

import { useMemo } from "react";
import { Card, StatTile, Tag, EmptyState, Spinner, Badge } from "@farm/ui";
import { dashboardApi, type DashboardSummary } from "../api.js";
import { useAsync, formatDate } from "../hooks.js";
import type { CropStatus } from "@farm/types";

const STATUS_LABELS: Record<CropStatus, string> = {
  planned: "Planned",
  seeded: "Seeded",
  growing: "Growing",
  ready: "Ready",
  harvested: "Harvested",
  failed: "Failed",
};

const STATUS_VARIANT: Record<CropStatus, "success" | "info" | "warn" | "danger"> =
  {
    planned: "info",
    seeded: "info",
    growing: "warn",
    ready: "success",
    harvested: "success",
    failed: "danger",
  };

export function DashboardPage(): JSX.Element {
  const { data, loading, error, refresh } = useAsync<DashboardSummary>(() =>
    dashboardApi.summary({ upcomingLimit: 6 }),
  );

  const statusEntries = useMemo(() => {
    if (!data) return [] as { status: CropStatus; count: number }[];
    return (Object.keys(STATUS_LABELS) as CropStatus[]).map((status) => ({
      status,
      count: data.crops.byStatus[status] ?? 0,
    }));
  }, [data]);

  return (
    <div className="admin-grid">
      {error ? (
        <div className="admin-error">
          Failed to load dashboard: {error}.{" "}
          <button type="button" className="admin-field__hint" onClick={refresh}>
            Retry
          </button>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="admin-center">
          <Spinner label="Loading dashboard" />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="admin-grid admin-grid--stats">
            <StatTile label="Crops" value={data.crops.total} hint="total tracked" />
            <StatTile
              label="Customers"
              value={data.customers.total}
              hint={`${data.customers.members} members`}
            />
            <StatTile
              label="Events"
              value={data.events.total}
              hint={`${data.events.upcoming} upcoming`}
            />
            <StatTile
              label="Aerial Images"
              value={data.aerialImages.total}
              hint="captured"
            />
            <StatTile
              label="Planting Areas"
              value={data.plantingAreas.total}
              hint="defined"
            />
          </div>

          <div className="admin-grid admin-grid--2">
            <Card title="Crops by status">
              {statusEntries.every((s) => s.count === 0) ? (
                <EmptyState
                  icon="🌱"
                  title="No crops yet"
                  description="Crop status breakdown will appear here once crops are added."
                />
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {statusEntries.map((entry) => (
                    <Badge key={entry.status} variant={STATUS_VARIANT[entry.status]}>
                      {STATUS_LABELS[entry.status]}: {entry.count}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Upcoming events">
              {data.upcomingEvents.length === 0 ? (
                <EmptyState
                  icon="📅"
                  title="No upcoming events"
                  description="Scheduled events will show up here."
                />
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.5rem" }}>
                  {data.upcomingEvents.map((event) => (
                    <li
                      key={event.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        alignItems: "baseline",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{event.title}</span>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--farm-color-muted)",
                        }}
                      >
                        {formatDate(event.startsAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ marginTop: "0.5rem" }}>
                <Tag>Generated {formatDate(data.generatedAt)}</Tag>
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
