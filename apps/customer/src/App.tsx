/**
 * @farm/customer — main application shell.
 *
 * Renders a top navigation bar and swaps the active page based on the URL
 * hash (`#/`, `#/calendar`, `#/pickup`, `#/portal`). A small footer shows
 * the backend health status.
 */

import { useEffect, useState } from "react";
import { healthApi, ApiError } from "./api.js";
import { HomePage } from "./pages/HomePage.js";
import { CalendarPage } from "./pages/CalendarPage.js";
import { PickupEventsPage } from "./pages/PickupEventsPage.js";
import { CustomerPortalPage } from "./pages/CustomerPortalPage.js";

type PageId = "home" | "calendar" | "pickup" | "portal";

interface NavItem {
  id: PageId;
  label: string;
  icon: string;
}

const NAV: NavItem[] = [
  { id: "home", label: "Home", icon: "🌾" },
  { id: "calendar", label: "Calendar", icon: "📅" },
  { id: "pickup", label: "Pickup Events", icon: "🧺" },
  { id: "portal", label: "Customer Portal", icon: "👤" },
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
    window.location.hash = id === "home" ? "/" : `/${id}`;
    setPage(id);
  };

  return (
    <div className="customer-app">
      <header className="customer-header">
        <button
          type="button"
          className="customer-header__brand"
          onClick={() => navigate("home")}
        >
          <span className="customer-header__logo">🌾</span>
          <span className="customer-header__title">Farm CSA</span>
        </button>
        <nav className="customer-header__nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={[
                "customer-nav-item",
                page === item.id ? "customer-nav-item--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => navigate(item.id)}
            >
              <span className="customer-nav-item__icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="customer-nav-item__label">{item.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="customer-main">
        {page === "home" && <HomePage />}
        {page === "calendar" && <CalendarPage />}
        {page === "pickup" && <PickupEventsPage />}
        {page === "portal" && <CustomerPortalPage />}
      </main>

      <footer className="customer-footer">
        <span className="customer-footer__copy">
          © {new Date().getFullYear()} Farm CSA
        </span>
        <HealthBadge />
      </footer>
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
    <span className="customer-health">
      <span
        className={`customer-health__dot customer-health__dot--${status}`}
        aria-hidden="true"
      />
      <span className="customer-health__label">
        {status === "ok"
          ? "Online"
          : status === "down"
            ? "Offline"
            : "Checking…"}
      </span>
    </span>
  );
}
