// Global vitest setup, loaded once per test file via vite.config.js's
// test.setupFiles. Registers the jest-dom matchers (toBeInTheDocument, etc.)
// and stubs a couple of browser APIs jsdom doesn't implement, so plain
// modules that call them (lib/preferences.js reads matchMedia; nothing here
// yet uses ResizeObserver/IntersectionObserver, but they're cheap to stub
// up front since component tests tend to need them sooner or later).
import "@testing-library/jest-dom/vitest";

if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    media: "",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom's localStorage/sessionStorage persist across tests in the same file
// unless cleared -- most test files below clear both in beforeEach, but
// clear here too as a safety net for any test file that forgets to.
afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
