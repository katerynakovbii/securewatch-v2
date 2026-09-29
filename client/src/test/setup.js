import '@testing-library/jest-dom';

// Node's built-in (experimental) global `localStorage`/`sessionStorage` can shadow
// jsdom's real implementation in this Node version: vitest's jsdom environment skips
// installing its own proxy for a global that already exists on `globalThis`, so the
// broken native stub (no backing file configured) wins instead of jsdom's working
// Storage. Force jsdom's real implementation (exposed via `globalThis.jsdom.window`)
// to win unconditionally.
const realWindow = globalThis.jsdom?.window;
if (realWindow) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: realWindow.localStorage,
    configurable: true,
    writable: true,
    enumerable: true,
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: realWindow.sessionStorage,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}
