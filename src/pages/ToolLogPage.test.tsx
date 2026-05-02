import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ToolLogPage from './ToolLogPage'
import type { ToolInvocationRow } from '@/lib/tauri'

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
const mockInvoke = vi.mocked(invoke)

function makeRow(overrides?: Partial<ToolInvocationRow>): ToolInvocationRow {
  return {
    id: 1,
    sessionId: 'sess-abc',
    callId: 'call-001',
    toolName: 'read_memory',
    scope: 'ReadOnly',
    arguments: '{}',
    decision: 'allow',
    result: null,
    error: null,
    durationMs: 42,
    invokedAt: 1746000000,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockInvoke.mockResolvedValue([])
})

describe('ToolLogPage', () => {
  it('shows empty state when no rows returned', async () => {
    mockInvoke.mockResolvedValue([])
    render(<ToolLogPage />)
    await waitFor(() => {
      expect(screen.getByText('No tool invocations recorded yet.')).toBeInTheDocument()
    })
  })

  it('renders row data when rows are returned', async () => {
    const row = makeRow({ toolName: 'write_memory', scope: 'MemoryWrite', decision: 'once' })
    mockInvoke.mockResolvedValue([row])
    render(<ToolLogPage />)
    await waitFor(() => {
      expect(screen.getByText('write_memory')).toBeInTheDocument()
      expect(screen.getByLabelText('Scope: Memory Write')).toBeInTheDocument()
      expect(screen.getByText('once')).toBeInTheDocument()
    })
  })

  it('renders duration column', async () => {
    mockInvoke.mockResolvedValue([makeRow({ durationMs: 123 })])
    render(<ToolLogPage />)
    await waitFor(() => {
      expect(screen.getByText('123ms')).toBeInTheDocument()
    })
  })

  it('shows — for null duration', async () => {
    mockInvoke.mockResolvedValue([makeRow({ durationMs: null })])
    render(<ToolLogPage />)
    // The dash appears in the duration cell
    await waitFor(() => {
      const cells = screen.getAllByText('—')
      expect(cells.length).toBeGreaterThan(0)
    })
  })

  it('shows error text in red when error is set', async () => {
    mockInvoke.mockResolvedValue([makeRow({ error: 'something went wrong' })])
    render(<ToolLogPage />)
    await waitFor(() => {
      const errCell = screen.getByText('something went wrong')
      expect(errCell).toHaveClass('text-red-400')
    })
  })

  it('Refresh button re-invokes list_tool_invocations', async () => {
    mockInvoke.mockResolvedValue([])
    render(<ToolLogPage />)
    await waitFor(() => screen.getByRole('button', { name: 'Refresh tool log' }))

    mockInvoke.mockResolvedValue([makeRow()])
    await userEvent.click(screen.getByRole('button', { name: 'Refresh tool log' }))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledTimes(2)
      expect(mockInvoke).toHaveBeenLastCalledWith('list_tool_invocations', expect.anything())
    })
  })

  it('pagination Prev is disabled on first page', async () => {
    mockInvoke.mockResolvedValue([])
    render(<ToolLogPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    })
  })

  it('pagination Next is disabled when fewer rows than page size', async () => {
    mockInvoke.mockResolvedValue([makeRow()])
    render(<ToolLogPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    })
  })

  it('pagination Next enables when more rows than page size (51 rows)', async () => {
    const manyRows = Array.from({ length: 51 }, (_, i) => makeRow({ id: i + 1 }))
    mockInvoke.mockResolvedValue(manyRows)
    render(<ToolLogPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next page' })).not.toBeDisabled()
    })
  })

  it('clicking Next advances page and Prev becomes enabled', async () => {
    const manyRows = Array.from({ length: 51 }, (_, i) => makeRow({ id: i + 1 }))
    mockInvoke.mockResolvedValue(manyRows)
    render(<ToolLogPage />)
    await waitFor(() => screen.getByRole('button', { name: 'Next page' }))

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Previous page' })).not.toBeDisabled()
      expect(screen.getByText('Page 2')).toBeInTheDocument()
    })
  })
})
