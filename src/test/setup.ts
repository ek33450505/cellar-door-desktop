import "@testing-library/jest-dom";

// Polyfill ResizeObserver — required by Radix UI Slider in jsdom
if (typeof ResizeObserver === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
