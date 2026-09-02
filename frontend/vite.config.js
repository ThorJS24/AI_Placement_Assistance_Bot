import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Only used when running `npm run dev` directly against the Vite dev
    // server during frontend development — forwards API calls to the
    // FastAPI backend so the two can run side by side on different ports.
    // In production the backend serves the built frontend itself, so this
    // proxy is never involved.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        ws: true, // needed for the Live AI Interview's WebSocket endpoint (routers/live_interview.py) during `npm run dev`
      },
    },
  },
  build: {
    outDir: "dist",
  },
  // Vitest reads this same config file (it looks for vitest.config.* first,
  // then falls back to vite.config.*'s `test` block) -- kept in one file so
  // the React plugin/build settings above don't drift out of sync with what
  // tests run against. Only pure-logic modules are covered for now
  // (lib/preferences.js, api/client.js); component tests can build on the
  // same jsdom + testing-library setup later.
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        // jsdom requires a concrete origin URL before it will attach a
        // working localStorage/sessionStorage to `window`.
        url: "http://localhost:3000/",
      },
    },
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    // Node 22+/26 ships an experimental global `localStorage`/`sessionStorage`
    // (the --webstorage flag) that gets installed on globalThis *before*
    // jsdom's own Storage objects, and because vitest's jsdom pool runs
    // tests with `window === globalThis`, Node's stub silently shadows
    // jsdom's real implementation -- leaving window.localStorage undefined
    // (Node prints "ExperimentalWarning: localStorage is not available
    // because --localstorage-file was not provided" when this happens).
    // Disabling the flag in the worker/fork processes' execArgv lets jsdom's
    // own localStorage/sessionStorage win instead.
    poolOptions: {
      threads: { execArgv: ["--no-experimental-webstorage"] },
      forks: { execArgv: ["--no-experimental-webstorage"] },
    },
  },
});
