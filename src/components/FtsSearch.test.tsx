import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from '@testing-library/react'
import { useMemoryStore } from '@/store/memoryStore'
import FtsSearch from './FtsSearch'
import type { MemoryRow } from '@/lib/tauri'

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
const makeRow = (overrides?: Partial<MemoryRow>): MemoryRow => ({
  id: 1,
  agent: 'code-writer',
  name: 'test-memory',
  memoryType: 'feedback',
  content: 'test content',
  sourceType: 'manual',
  validFrom: '2026-01-01T00:00:00Z',
  superseded: false,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  useMemoryStore.setState({
    memories: [],
    injections: [],
    filters: {},
    temporalTs: null,
    ftsQuery: '',
    activeView: 'fts',
    chainName: null,
    chainAgent: null,
    loading: false,
    error: null,
    lastRefreshed: null,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('FtsSearch', () => {
  it('renders a search input with correct aria-label', () => {
    render(<FtsSearch />)
    expect(
      screen.getByRole('searchbox', { name: 'Full-text memory search' })
    ).toBeInTheDocument()
  })

  it('shows placeholder text', () => {
    render(<FtsSearch />)
    expect(screen.getByPlaceholderText('Search memories...')).toBeInTheDocument()
  })

  it('shows prompt text when query is empty', () => {
    render(<FtsSearch />)
    expect(screen.getByText('Enter a query to search memories.')).toBeInTheDocument()
  })

  it('calls fetchFts after 300ms debounce when input changes', async () => {
    const fetchFts = vi.fn().mockResolvedValue(undefined)
    useMemoryStore.setState({ fetchFts })

    render(<FtsSearch />)
    const input = screen.getByRole('searchbox')

    fireEvent.change(input, { target: { value: 'type:feedback' } })
    // Also update the store's ftsQuery to reflect the change (setFtsQuery is real, but fetchFts is mocked)
    useMemoryStore.setState({ ftsQuery: 'type:feedback' })

    // Before debounce fires — fetchFts should NOT have been called yet
    expect(fetchFts).not.toHaveBeenCalled()

    // Advance fake timers past the 300ms debounce
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(fetchFts).toHaveBeenCalled()
  })

  it('does NOT call fetchFts if query is cleared before debounce fires', async () => {
    const fetchFts = vi.fn().mockResolvedValue(undefined)
    useMemoryStore.setState({ fetchFts })

    render(<FtsSearch />)

    // Set non-empty query
    useMemoryStore.setState({ ftsQuery: 'hello' })

    // Clear query before debounce fires
    useMemoryStore.setState({ ftsQuery: '' })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(fetchFts).not.toHaveBeenCalled()
  })

  it('shows result count when results are loaded and query is non-empty', () => {
    const results = [makeRow({ id: 1 }), makeRow({ id: 2 })]
    useMemoryStore.setState({ memories: results, ftsQuery: 'feedback' })

    render(<FtsSearch />)
    expect(screen.getByText(/2 results for 'feedback'/)).toBeInTheDocument()
  })

  it('shows singular "result" for 1 result', () => {
    useMemoryStore.setState({ memories: [makeRow()], ftsQuery: 'one' })
    render(<FtsSearch />)
    expect(screen.getByText(/1 result for 'one'/)).toBeInTheDocument()
  })

  it('shows data rows matching FactTable column format when memories exist', () => {
    const results = [makeRow({ id: 1, agent: 'planner', name: 'found-memory' })]
    useMemoryStore.setState({ memories: results, ftsQuery: 'planner' })

    render(<FtsSearch />)
    expect(screen.getByText('planner')).toBeInTheDocument()
    expect(screen.getByText('found-memory')).toBeInTheDocument()
  })

  it('shows "No results." message when query is non-empty but memories is empty', () => {
    useMemoryStore.setState({ memories: [], ftsQuery: 'nothing', loading: false })
    render(<FtsSearch />)
    expect(screen.getByText('No results.')).toBeInTheDocument()
  })

  it('shows "Searching…" when loading is true', () => {
    useMemoryStore.setState({ ftsQuery: 'test', loading: true })
    render(<FtsSearch />)
    expect(screen.getByText('Searching…')).toBeInTheDocument()
  })
})
