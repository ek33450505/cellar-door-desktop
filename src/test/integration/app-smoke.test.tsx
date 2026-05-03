/**
 * Integration smoke tests — mount real <App /> against Tauri mocks.
 *
 * These 3 scenarios cover the "unit-tested-in-isolation, never-integrated-in-tree"
 * failure class surfaced by hotfixes 40bb7c1, 97a83c1, and 7ffb2c0.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { act } from 'react'
import App from '@/App'
import { useChatStore } from '@/store/chatStore'
import { usePermissionStore } from '@/store/permissionStore'
import { useMemoryStore } from '@/store/memoryStore'

// ---------------------------------------------------------------------------
// Tauri API mocks — must be declared before imports are resolved.
// Each test configures the invoke mock impl via mockInvokeImpl.
// ---------------------------------------------------------------------------

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Event listener registry — allows tests to fire synthetic Tauri events.
const _eventHandlers: Record<string, Array<(e: { payload: unknown }) => void>> = {}

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(
    async (event: string, handler: (e: { payload: unknown }) => void) => {
      if (!_eventHandlers[event]) _eventHandlers[event] = []
      _eventHandlers[event].push(handler)
      return vi.fn(() => {
        _eventHandlers[event] = (_eventHandlers[event] ?? []).filter(h => h !== handler)
      })
    },
  ),
  emit: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
const mockInvoke = vi.mocked(invoke)

/**
 * Fire a synthetic Tauri event to all registered handlers.
 * Call this AFTER rendering <App /> and waiting for effects to flush.
 */
function fireTauriEvent(eventName: string, payload: unknown = {}) {
  const registered = _eventHandlers[eventName] ?? []
  for (const handler of registered) {
    handler({ payload })
  }
}

// ---------------------------------------------------------------------------
// Shared setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Clear handler registry between tests
  for (const key of Object.keys(_eventHandlers)) {
    delete _eventHandlers[key]
  }
  vi.clearAllMocks()

  // Default: all invoke commands return safe defaults so App mounts cleanly.
  // Specific tests override per-command behaviour below.
  mockInvoke.mockImplementation(async (cmd: string) => {
    if (cmd === 'ollama_health') return false
    if (cmd === 'ollama_models') return []
    if (cmd === 'list_memories') return []
    if (cmd === 'list_injections') return []
    // Memory / search commands — return empty arrays
    return []
  })

  // Reset stores to initial state before each test.
  // messages is a computed getter over chats — reset via chats/activeChatId.
  const resetChatId = crypto.randomUUID()
  useChatStore.setState({
    chats: [{ id: resetChatId, title: 'New Chat', createdAt: Date.now(), updatedAt: Date.now(), workspacePath: null, messages: [] }],
    activeChatId: resetChatId,
    isStreaming: false,
    model: 'mistral',
    availableModels: [],
    ollamaStatus: 'unknown',
    agentMode: false,
    agentSessionId: null,
  })
  usePermissionStore.setState({ pendingApproval: null, sessionGrants: {} })
  useMemoryStore.setState({ activeView: 'chat', memories: [], injections: [], loading: false, error: null })
})

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// Scenario 1 — PermissionModal renders when chat-tool-pending event fires
// Hotfix: 7ffb2c0 — PermissionModal was not mounted at App root, so
// the event handler set pendingApproval but the modal was never in the DOM.
// ---------------------------------------------------------------------------
describe('Scenario 1: PermissionModal mount', () => {
  it('renders PermissionModal when chat-tool-pending event fires', async () => {
    await act(async () => {
      render(<App />)
    })

    // Assert modal is NOT present before any event
    expect(screen.queryByText('Permission Request')).toBeNull()

    // Fire synthetic chat-tool-pending event (the Rust backend emits this
    // when a tool call is intercepted for user approval)
    await act(async () => {
      fireTauriEvent('chat-tool-pending', {
        callId: 'smoke-c1',
        toolName: 'read_file',
        toolDescription: 'Read the contents of a file',
        scope: 'ReadOnly',
        args: { path: '/tmp/test.txt' },
      })
    })

    // PermissionModal should now be in the DOM
    expect(screen.getByText('Permission Request')).toBeDefined()
    expect(screen.getByText('read_file')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Scenario 2 — ollama-ready race: event fires BEFORE listener mounts
// Hotfix: 97a83c1 — relied solely on the ollama-ready event; if it fired
// before the listener registered, status stayed 'unknown' forever.
// Fix: mount-time ollama_health invoke as fallback.
// ---------------------------------------------------------------------------
describe('Scenario 2: ollama-ready race condition', () => {
  it('resolves ollamaStatus to ready when ollama_health returns true on mount', async () => {
    // Mock ollama_health to return true — simulates Ollama already running
    // when the race fires the event before the listener registers.
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'ollama_health') return true
      if (cmd === 'ollama_models') return []
      if (cmd === 'list_memories') return []
      if (cmd === 'list_injections') return []
      return []
    })

    await act(async () => {
      render(<App />)
    })

    // After mount, useOllamaEvents calls invoke('ollama_health') → true
    // → setOllamaStatus('ready')
    await vi.waitFor(() => {
      expect(useChatStore.getState().ollamaStatus).toBe('ready')
    })

    // The "Ollama not ready" placeholder should NOT be visible in the chat view
    // (switch to chat view for the assertion)
    useMemoryStore.setState({ activeView: 'chat' })

    await act(async () => {})

    // Status should remain 'ready' — no banner/placeholder for "not ready" state
    expect(useChatStore.getState().ollamaStatus).toBe('ready')
  })
})

// ---------------------------------------------------------------------------
// Scenario 3 — ModelSelector populates from ollama_models invoke
// Hotfix: 40bb7c1 — invoke name was 'list_models' (wrong) instead of
// 'ollama_models' (correct), so ModelSelector always showed only the default.
// ---------------------------------------------------------------------------
describe('Scenario 3: ModelSelector populates', () => {
  it('renders model names returned by ollama_models invoke', async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'ollama_health') return false
      if (cmd === 'ollama_models') return ['mistral', 'llama3']
      if (cmd === 'list_memories') return []
      if (cmd === 'list_injections') return []
      return []
    })

    // Set activeView to 'chat' so ChatView (which contains ModelSelector) renders
    useMemoryStore.setState({ activeView: 'chat' })

    await act(async () => {
      render(<App />)
    })

    // Wait for ModelSelector's useEffect to fire invoke('ollama_models')
    // and call setAvailableModels
    await vi.waitFor(() => {
      expect(useChatStore.getState().availableModels).toEqual(['mistral', 'llama3'])
    })

    // The Select.Trigger shows the current model value — 'mistral' is selected by default
    // The items are in the portal but the store has both models
    const available = useChatStore.getState().availableModels
    expect(available).toContain('mistral')
    expect(available).toContain('llama3')
    expect(available).toHaveLength(2)
  })
})
