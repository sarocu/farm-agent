/**
 * @farm/admin — main application shell.
 *
 * Renders the sidebar navigation and swaps the active page based on the
 * URL hash (`#/crops`, `#/customers`, etc.). A small header shows the
 * backend health status.
 */

import { useEffect, useState } from "react";
import { Button } from "@farm/ui";
import { healthApi, ApiError } from "./api.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { CropsPage } from "./pages/CropsPage.js";
import { CustomersPage } from "./pages/CustomersPage.js";
import { EventsPage } from "./pages/EventsPage.js";
import { AerialMapsPage } from "./pages/AerialMapsPage.js";
import { AerialEditor } from "./pages/AerialEditor.js";
import { ImageUpload } from "./pages/ImageUpload.js";

type PageId =
  | "dashboard"
  | "crops"
  | "customers"
  | "events"
  | "aerial"
  | "editor"
  | "upload";

interface NavItem {
  id: PageId;
  label: string;
  icon: string;
}

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "crops", label: "Crops", icon: "🌱" },
  { id: "customers", label: "Customers", icon: "👥" },
  { id: "events", label: "Events", icon: "📅" },
  { id: "aerial", label: "Aerial Maps", icon: "🛰️" },
  { id: "editor", label: "Aerial Editor", icon: "✏️" },
  { id: "upload", label: "Image Upload", icon: "📤" },
];

function parseHash(): PageId {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return (NAV.find((n) => n.id === hash) ?? NAV[0]!).id;
}

export function App(): JSX.Element {
  const [page, setPage] = useState<PageId>(() => parseHash());

  useEffect(() => {
    const onHashChange = () => setPage(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = (id: PageId) => {
    window.location.hash = `/${id}`;
    setPage(id);
  };

  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <span className="admin-sidebar__logo">🌾</span>
          <span className="admin-sidebar__title">Farm Admin</span>
        </div>
        <nav className="admin-sidebar__nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={[
                "admin-nav-item",
                page === item.id ? "admin-nav-item--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => navigate(item.id)}
            >
              <span className="admin-nav-item__icon">{item.icon}</span>
              <span className="admin-nav-item__label">{item.label}</span>
            </button>
          ))}
        </nav>
        <HealthBadge />
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <h1 className="admin-topbar__title">
            {NAV.find((n) => n.id === page)?.label ?? "Dashboard"}
          </h1>
        </header>
        <div className="admin-content">
          {page === "dashboard" && <DashboardPage />}
          {page === "crops" && <CropsPage />}
          {page === "customers" && <CustomersPage />}
          {page === "events" && <EventsPage />}
          {page === "aerial" && <AerialMapsPage />}
          {page === "editor" && <AerialEditor />}
          {page === "upload" && <ImageUpload />}
        </div>
      </main>
    </div>
  );
}

/** Polls the backend `/health` endpoint and shows a status dot. */
function HealthBadge(): JSX.Element {
  const [status, setStatus] = useState<"ok" | "down" | "checking">("checking");

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const result = await healthApi.check();
        if (!cancelled) setStatus(result.status === "ok" ? "ok" : "down");
      } catch (err) {
        if (!cancelled) setStatus(err instanceof ApiError ? "down" : "down");
      }
    };
    poll();
    const interval = window.setInterval(poll, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="admin-health">
      <span
        className={`admin-health__dot admin-health__dot--${status}`}
        aria-hidden="true"
      />
      <span className="admin-health__label">
        {status === "ok"
          ? "Backend online"
          : status === "down"
            ? "Backend offline"
            : "Checking…"}
      </span>
    </div>
  );
}

// Re-export Button so pages can import a single action style if desired.
export { Button };
