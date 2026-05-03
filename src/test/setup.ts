import "@testing-library/jest-dom";

// Polyfill localStorage — jsdom disables it for opaque origins; zustand persist middleware requires it.
if (typeof window !== 'undefined') {
  const _storage: Record<string, string> = {}
  const localStorageMock: Storage = {
    getItem: (key: string) => _storage[key] ?? null,
    setItem: (key: string, value: string) => { _storage[key] = value },
    removeItem: (key: string) => { delete _storage[key] },
    clear: () => { for (const k in _storage) delete _storage[k] },
    key: (index: number) => Object.keys(_storage)[index] ?? null,
    get length() { return Object.keys(_storage).length },
  }
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  })
}

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
