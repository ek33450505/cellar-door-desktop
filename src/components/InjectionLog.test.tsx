import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useMemoryStore } from '@/store/memoryStore'
import InjectionLog from './InjectionLog'
import type { InjectionRow } from '@/lib/tauri'

// Mock Tauri at module level — no invoke calls allowed in test files
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock Sonner to avoid rendering toast UI
vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeInjection = (overrides?: Partial<InjectionRow>): InjectionRow => ({
  id: 1,
  sessionId: 'session-abc-123',
  agent: 'code-writer',
  injectedAt: '2026-01-01T10:00:00Z',
  memoryId: 1,
  memoryName: 'test-memory',
  memoryContent: 'This is some test content for the injection row.',
  ...overrides,
})

const LONG_CONTENT =
  'This content is intentionally very long and should be truncated at exactly eighty characters when displayed in the table cell for readability purposes.'
// Must be > 80 chars
if (LONG_CONTENT.length <= 80) throw new Error('LONG_CONTENT test fixture must be > 80 chars')

const INJECTIONS: InjectionRow[] = [
  makeInjection({ id: 1, sessionId: 'session-aaa', memoryName: 'mem-1' }),
  makeInjection({ id: 2, sessionId: 'session-bbb', memoryName: 'mem-2', memoryContent: LONG_CONTENT }),
]

beforeEach(() => {
  vi.clearAllMocks()
  // Override fetchInjections with a no-op so mount effect doesn't overwrite the fixture
  const noOpFetch = vi.fn().mockResolvedValue(undefined)
  useMemoryStore.setState({
    memories: [],
    injections: INJECTIONS,
    filters: {},
    temporalTs: null,
    ftsQuery: '',
    activeView: 'injections',
    chainName: null,
    chainAgent: null,
    loading: false,
    error: null,
    lastRefreshed: null,
  })
  useMemoryStore.setState({
    fetchInjections: noOpFetch,
  } as Partial<ReturnType<typeof useMemoryStore.getState>>)
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('InjectionLog', () => {
  it('renders 2 data rows for 2 injections in store', () => {
    render(<InjectionLog />)
    // Rows are plain <tr> elements — we look for cell content instead
    expect(screen.getByText('session-aaa')).toBeInTheDocument()
    expect(screen.getByText('session-bbb')).toBeInTheDocument()
  })

  it('renders 5 column headers', () => {
    render(<InjectionLog />)
    const headers = screen.getAllByRole('columnheader')
    expect(headers).toHaveLength(5)
  })

  it('filter input is present with correct aria-label', () => {
    render(<InjectionLog />)
    expect(
      screen.getByRole('textbox', { name: 'Filter by session ID' })
    ).toBeInTheDocument()
  })

  it('memory content longer than 80 chars is truncated with ellipsis', () => {
    render(<InjectionLog />)
    // The displayed text must be <= 82 chars (80 + the ellipsis char '…')
    const cells = screen.getAllByTitle(LONG_CONTENT)
    expect(cells.length).toBeGreaterThan(0)
    const displayed = cells[0].textContent ?? ''
    // Truncated text length: 80 chars + 1 ellipsis = 81 display chars
    expect(displayed.length).toBeLessThanOrEqual(81)
    expect(displayed.endsWith('…')).toBe(true)
  })

  it('full content is available in the title attribute of the cell', () => {
    render(<InjectionLog />)
    const cell = screen.getByTitle(LONG_CONTENT)
    expect(cell).toBeInTheDocument()
  })

  it('shows empty state when injections array is empty and not loading', () => {
    useMemoryStore.setState({ injections: [], loading: false })
    render(<InjectionLog />)
    expect(screen.getByText('No injection records found.')).toBeInTheDocument()
  })

  it('calls fetchInjections on mount', () => {
    const fetchInjections = vi.fn().mockResolvedValue(undefined)
    // Set the mock fetchInjections — beforeEach already set injections to INJECTIONS
    useMemoryStore.setState({
      fetchInjections,
    } as Partial<ReturnType<typeof useMemoryStore.getState>>)

    render(<InjectionLog />)
    expect(fetchInjections).toHaveBeenCalledTimes(1)
  })

  it('memory name column shows correct value', () => {
    render(<InjectionLog />)
    expect(screen.getByText('mem-1')).toBeInTheDocument()
    expect(screen.getByText('mem-2')).toBeInTheDocument()
  })

  it('renders table with accessible aria-label', () => {
    render(<InjectionLog />)
    expect(screen.getByRole('table', { name: 'Injection log' })).toBeInTheDocument()
  })
})
