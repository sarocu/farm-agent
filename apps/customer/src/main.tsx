/**
 * @farm/customer — React root entry.
 *
 * Mounts the customer-facing <App /> into the `#root` element and imports the
 * global styles (the @farm/ui base styles plus the customer site's own
 * styles).
 */

import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "@farm/ui/styles.css";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
