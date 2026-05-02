import { vi } from 'vitest'

/**
 * Reusable Tauri mock factories for integration tests.
 *
 * Usage:
 *   vi.mock('@tauri-apps/api/core', () => ({ invoke: createTauriMock({ ollama_health: true }) }))
 *   vi.mock('@tauri-apps/api/event', () => createListenMock())
 */

/**
 * Returns a vitest mock for @tauri-apps/api/core `invoke`.
 * Handlers map command name → return value (or a function returning a value).
 * Unregistered commands throw to surface wiring bugs early.
 */
export function createTauriMock(
  handlers: Record<string, unknown | ((_args?: unknown) => unknown)> = {},
) {
  return vi.fn(async (cmd: string, _args?: unknown) => {
    if (cmd in handlers) {
      const h = handlers[cmd]
      return typeof h === 'function' ? (h as (_args?: unknown) => unknown)(_args) : h
    }
    throw new Error(`Unhandled invoke: ${cmd}`)
  })
}

/**
 * Mock for @tauri-apps/api/event.
 *
 * Returns:
 *   - `listen`: vitest mock that stores handlers by event name and returns a no-op unlisten fn
 *   - `emit`: vitest mock (no-op)
 *   - `fireEvent(name, payload)`: test helper that synchronously calls all registered
 *     handlers for the given event name with a Tauri-shaped event object { payload }
 *
 * Export shape matches what `vi.mock('@tauri-apps/api/event', () => createListenMock())`
 * expects — keys are the module-level named exports.
 */
export function createListenMock() {
  const handlers: Record<string, Array<(e: { payload: unknown }) => void>> = {}

  const listen = vi.fn(
    async (event: string, handler: (e: { payload: unknown }) => void) => {
      if (!handlers[event]) handlers[event] = []
      handlers[event].push(handler)
      // Return unlisten fn
      return vi.fn(() => {
        handlers[event] = handlers[event].filter(h => h !== handler)
      })
    },
  )

  const emit = vi.fn()

  function fireEvent(eventName: string, payload: unknown = {}) {
    const registered = handlers[eventName] ?? []
    for (const handler of registered) {
      handler({ payload })
    }
  }

  return { listen, emit, fireEvent }
}
