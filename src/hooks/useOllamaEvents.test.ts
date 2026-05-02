import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useChatStore } from '@/store/chatStore'
import { useOllamaEvents } from './useOllamaEvents'

// Mock Tauri event API — factory must be literal (hoisted, no outer vars)
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

// Mock Tauri core API for invoke calls
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Import mocked versions after vi.mock resolves
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
const mockListen = vi.mocked(listen)
const mockInvoke = vi.mocked(invoke)

beforeEach(() => {
  const mockUnlisten = vi.fn()
  vi.clearAllMocks()
  mockListen.mockResolvedValue(mockUnlisten)
  // Default: health check returns false (unhealthy) unless overridden per test
  mockInvoke.mockResolvedValue(false)
  useChatStore.setState({
    messages: [],
    isStreaming: false,
    model: 'mistral',
    availableModels: [],
    ollamaStatus: 'unknown',
  })
})

describe('useOllamaEvents', () => {
  it('registers listeners for all four events on mount', async () => {
    renderHook(() => useOllamaEvents())
    await vi.waitFor(() => expect(mockListen).toHaveBeenCalledTimes(4))
    const registeredEvents = mockListen.mock.calls.map(c => c[0])
    expect(registeredEvents).toContain('ollama-status')
    expect(registeredEvents).toContain('ollama-ready')
    expect(registeredEvents).toContain('ollama-failed')
    expect(registeredEvents).toContain('chat-token')
  })

  it('calls unlisten for all listeners on unmount', async () => {
    const mockUnlisten = vi.fn()
    mockListen.mockResolvedValue(mockUnlisten)

    const { unmount } = renderHook(() => useOllamaEvents())
    await vi.waitFor(() => expect(mockListen).toHaveBeenCalledTimes(4))
    unmount()
    await vi.waitFor(() => expect(mockUnlisten).toHaveBeenCalledTimes(4))
  })

  it('ollama-ready event sets ollamaStatus to ready', async () => {
    renderHook(() => useOllamaEvents())
    await vi.waitFor(() => expect(mockListen).toHaveBeenCalledTimes(4))

    const readyCall = mockListen.mock.calls.find(c => c[0] === 'ollama-ready')
    expect(readyCall).toBeDefined()
    const callback = readyCall![1] as () => void
    callback()

    expect(useChatStore.getState().ollamaStatus).toBe('ready')
  })

  it('ollama-failed event sets ollamaStatus to error', async () => {
    renderHook(() => useOllamaEvents())
    await vi.waitFor(() => expect(mockListen).toHaveBeenCalledTimes(4))

    const failedCall = mockListen.mock.calls.find(c => c[0] === 'ollama-failed')
    const callback = failedCall![1] as () => void
    callback()

    expect(useChatStore.getState().ollamaStatus).toBe('error')
  })

  it('chat-token event appends token to store', async () => {
    renderHook(() => useOllamaEvents())
    await vi.waitFor(() => expect(mockListen).toHaveBeenCalledTimes(4))

    const tokenCall = mockListen.mock.calls.find(c => c[0] === 'chat-token')
    const callback = tokenCall![1] as (e: { payload: { token: string; done: boolean } }) => void
    callback({ payload: { token: 'Hello', done: false } })

    expect(useChatStore.getState().messages).toHaveLength(1)
    expect(useChatStore.getState().messages[0].content).toBe('Hello')
  })

  it('chat-token with done:true calls finalizeAssistant', async () => {
    useChatStore.getState().appendToken('Hello')
    useChatStore.setState({ isStreaming: true })

    renderHook(() => useOllamaEvents())
    await vi.waitFor(() => expect(mockListen).toHaveBeenCalledTimes(4))

    const tokenCall = mockListen.mock.calls.find(c => c[0] === 'chat-token')
    const callback = tokenCall![1] as (e: { payload: { token: string; done: boolean } }) => void
    callback({ payload: { token: '', done: true } })

    expect(useChatStore.getState().isStreaming).toBe(false)
    expect(useChatStore.getState().messages[0].pending).toBe(false)
  })

  it('on mount, queries ollama_health and sets status to ready when healthy', async () => {
    mockInvoke.mockResolvedValue(true)

    renderHook(() => useOllamaEvents())
    await vi.waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('ollama_health'))

    expect(useChatStore.getState().ollamaStatus).toBe('ready')
  })

  it('on mount, leaves status at unknown when ollama_health returns false', async () => {
    mockInvoke.mockResolvedValue(false)

    renderHook(() => useOllamaEvents())
    await vi.waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('ollama_health'))

    expect(useChatStore.getState().ollamaStatus).toBe('unknown')
  })

  it('on mount, leaves status at unknown when ollama_health rejects', async () => {
    mockInvoke.mockRejectedValue(new Error('invoke failed'))

    renderHook(() => useOllamaEvents())
    await vi.waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('ollama_health'))

    expect(useChatStore.getState().ollamaStatus).toBe('unknown')
  })
})
