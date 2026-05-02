import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToolEvents } from './useToolEvents'
import { usePermissionStore } from '@/store/permissionStore'

// Mock Tauri APIs — factories are literal (hoisted)
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))
vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'

const mockListen = vi.mocked(listen)
const mockInvoke = vi.mocked(invoke)
const mockToast = vi.mocked(toast)

beforeEach(() => {
  vi.clearAllMocks()
  const mockUnlisten = vi.fn()
  mockListen.mockResolvedValue(mockUnlisten)
  mockInvoke.mockResolvedValue(undefined)
  usePermissionStore.setState({ pendingApproval: null, sessionGrants: {} })
})

describe('useToolEvents', () => {
  it('registers four listeners on mount', async () => {
    const onUpdate = vi.fn()
    renderHook(() => useToolEvents(onUpdate))
    await vi.waitFor(() => expect(mockListen).toHaveBeenCalledTimes(4))

    const events = mockListen.mock.calls.map(c => c[0])
    expect(events).toContain('chat-tool-pending')
    expect(events).toContain('chat-tool-result')
    expect(events).toContain('chat-tool-error')
    expect(events).toContain('chat-tool-timeout')
  })

  it('calls unlisten for all four listeners on unmount', async () => {
    const mockUnlisten = vi.fn()
    mockListen.mockResolvedValue(mockUnlisten)
    const onUpdate = vi.fn()

    const { unmount } = renderHook(() => useToolEvents(onUpdate))
    await vi.waitFor(() => expect(mockListen).toHaveBeenCalledTimes(4))
    unmount()
    await vi.waitFor(() => expect(mockUnlisten).toHaveBeenCalledTimes(4))
  })

  it('adds a pending entry when chat-tool-pending fires', async () => {
    const onUpdate = vi.fn()
    renderHook(() => useToolEvents(onUpdate))
    await vi.waitFor(() => expect(mockListen).toHaveBeenCalledTimes(4))

    const pendingCall = mockListen.mock.calls.find(c => c[0] === 'chat-tool-pending')
    const callback = pendingCall![1] as (e: { payload: unknown }) => void

    act(() => {
      callback({
        payload: {
          callId: 'c1',
          toolName: 'read_file',
          toolDescription: 'Reads a file',
          scope: 'ReadOnly',
          args: { path: '/tmp/test.txt' },
        },
      })
    })

    expect(onUpdate).toHaveBeenCalledTimes(1)
    // Verify it was called with a function (updater pattern)
    const updater = onUpdate.mock.calls[0][0]
    expect(typeof updater).toBe('function')
    const result = updater([])
    expect(result).toHaveLength(1)
    expect(result[0].callId).toBe('c1')
    expect(result[0].status).toBe('pending')
  })

  it('sets pendingApproval on permissionStore when chat-tool-pending fires', async () => {
    const onUpdate = vi.fn()
    renderHook(() => useToolEvents(onUpdate))
    await vi.waitFor(() => expect(mockListen).toHaveBeenCalledTimes(4))

    const pendingCall = mockListen.mock.calls.find(c => c[0] === 'chat-tool-pending')
    const callback = pendingCall![1] as (e: { payload: unknown }) => void

    act(() => {
      callback({
        payload: {
          callId: 'c1',
          toolName: 'read_file',
          toolDescription: 'Reads a file',
          scope: 'ReadOnly',
          args: {},
        },
      })
    })

    const pending = usePermissionStore.getState().pendingApproval
    expect(pending).not.toBeNull()
    expect(pending?.callId).toBe('c1')
    expect(pending?.toolName).toBe('read_file')
  })

  it('invokes resolve_tool_decision when permission is resolved', async () => {
    const onUpdate = vi.fn()
    renderHook(() => useToolEvents(onUpdate))
    await vi.waitFor(() => expect(mockListen).toHaveBeenCalledTimes(4))

    const pendingCall = mockListen.mock.calls.find(c => c[0] === 'chat-tool-pending')
    const callback = pendingCall![1] as (e: { payload: unknown }) => void

    act(() => {
      callback({
        payload: {
          callId: 'c1',
          toolName: 'read_file',
          toolDescription: 'Reads a file',
          scope: 'ReadOnly',
          args: {},
        },
      })
    })

    const pending = usePermissionStore.getState().pendingApproval!
    await act(async () => {
      pending.resolve('once')
    })

    expect(mockInvoke).toHaveBeenCalledWith('resolve_tool_decision', { callId: 'c1', decision: 'once' })
  })

  it('updates entry on chat-tool-result', async () => {
    const onUpdate = vi.fn()
    renderHook(() => useToolEvents(onUpdate))
    await vi.waitFor(() => expect(mockListen).toHaveBeenCalledTimes(4))

    const resultCall = mockListen.mock.calls.find(c => c[0] === 'chat-tool-result')
    const callback = resultCall![1] as (e: { payload: unknown }) => void

    act(() => {
      callback({ payload: { callId: 'c1', result: 'file contents', durationMs: 100 } })
    })

    expect(onUpdate).toHaveBeenCalledTimes(1)
    const updater = onUpdate.mock.calls[0][0]
    const existing = [{ callId: 'c1', status: 'pending', result: null, durationMs: null } as never]
    const updated = updater(existing)
    expect(updated[0].result).toBe('file contents')
    expect(updated[0].durationMs).toBe(100)
    expect(updated[0].status).toBe('resolved')
  })

  it('updates entry on chat-tool-error', async () => {
    const onUpdate = vi.fn()
    renderHook(() => useToolEvents(onUpdate))
    await vi.waitFor(() => expect(mockListen).toHaveBeenCalledTimes(4))

    const errorCall = mockListen.mock.calls.find(c => c[0] === 'chat-tool-error')
    const callback = errorCall![1] as (e: { payload: unknown }) => void

    act(() => {
      callback({ payload: { callId: 'c1', error: 'Permission denied', durationMs: 50 } })
    })

    const updater = onUpdate.mock.calls[0][0]
    const existing = [{ callId: 'c1', status: 'pending', error: null } as never]
    const updated = updater(existing)
    expect(updated[0].error).toBe('Permission denied')
    expect(updated[0].status).toBe('error')
  })

  it('shows a toast on chat-tool-timeout', async () => {
    const onUpdate = vi.fn()
    renderHook(() => useToolEvents(onUpdate))
    await vi.waitFor(() => expect(mockListen).toHaveBeenCalledTimes(4))

    const timeoutCall = mockListen.mock.calls.find(c => c[0] === 'chat-tool-timeout')
    const callback = timeoutCall![1] as (e: { payload: unknown }) => void

    act(() => {
      callback({ payload: { callId: 'c1' } })
    })

    expect(mockToast.error).toHaveBeenCalledWith('Tool call timed out — agent paused')
  })
})
