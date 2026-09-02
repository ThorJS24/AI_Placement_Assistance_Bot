import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { applyPreferences, getLocalPreferences } from "./lib/preferences.js";

// Apply all saved appearance preferences (dark/light, color theme, font
// size, density) before the first paint, so switching pages/reloading never
// flashes the defaults first. Falls back to the OS-level preference for
// dark/light when the student hasn't picked one yet. This is the
// localStorage-only, instant path - App.jsx additionally reconciles against
// the student's server-saved preferences once identity is known (see
// lib/preferences.js's module docstring).
applyPreferences(getLocalPreferences());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
