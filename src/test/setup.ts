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

// Polyfill scrollIntoView — not implemented in jsdom
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = () => {}
}

// Polyfill matchMedia — required by ChatView prefers-reduced-motion check
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
