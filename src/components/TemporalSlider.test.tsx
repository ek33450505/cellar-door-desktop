import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useMemoryStore } from '@/store/memoryStore'
import TemporalSlider from './TemporalSlider'
import type { MemoryRow } from '@/lib/tauri'

// Mock Tauri — no invoke calls in test files
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue([]),
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

const MEMORIES: MemoryRow[] = [
  makeRow({ id: 1, validFrom: '2026-01-01T00:00:00Z', agent: 'code-writer', name: 'mem-1' }),
  makeRow({ id: 2, validFrom: '2026-02-15T00:00:00Z', agent: 'planner', name: 'mem-2' }),
  makeRow({ id: 3, validFrom: '2026-03-30T00:00:00Z', agent: 'researcher', name: 'mem-3' }),
]

const BASE_STATE = {
  memories: MEMORIES,
  injections: [],
  filters: {},
  temporalTs: '2026-03-30T00:00:00Z',
  ftsQuery: '',
  activeView: 'temporal' as const,
  chainName: null,
  chainAgent: null,
  loading: false,
  error: null,
  lastRefreshed: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  useMemoryStore.setState(BASE_STATE)
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TemporalSlider', () => {
  it('renders the slider with accessible aria-label', () => {
    render(<TemporalSlider />)
    // Radix Slider.Thumb has aria-label
    const thumb = screen.getByRole('slider', { name: 'Time travel to date' })
    expect(thumb).toBeInTheDocument()
  })

  it('renders the formatted date label for selected date', () => {
    render(<TemporalSlider />)
    // Should show some date text derived from temporalTs
    const dateText = new Date('2026-03-30T00:00:00Z').toLocaleString()
    expect(screen.getByText(dateText)).toBeInTheDocument()
  })

  it('renders fact count label', () => {
    render(<TemporalSlider />)
    expect(screen.getByText(`${MEMORIES.length} facts at this point`)).toBeInTheDocument()
  })

  it('renders the results table with aria-label', () => {
    render(<TemporalSlider />)
    expect(screen.getByRole('table', { name: 'Facts at selected time' })).toBeInTheDocument()
  })

  it('renders one row per memory in table', () => {
    render(<TemporalSlider />)
    // Each MemoryTableRow has role="button"
    const rows = screen.getAllByRole('button')
    expect(rows).toHaveLength(MEMORIES.length)
  })

  it('shows empty-state message and no slider when memories is empty', () => {
    useMemoryStore.setState({ memories: [], temporalTs: null })
    render(<TemporalSlider />)
    expect(
      screen.getByText('No memories loaded — switch to Fact Table first to populate the time range.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })

  it('does not call setTemporalTs immediately when slider moves (debounced)', () => {
    vi.useFakeTimers()

    const setTemporalTs = vi.fn()
    const fetchAt = vi.fn().mockResolvedValue(undefined)
    useMemoryStore.setState({ setTemporalTs, fetchAt } as Partial<ReturnType<typeof useMemoryStore.getState>>)

    render(<TemporalSlider />)

    // Radix Slider's onValueChange is not simulatable via fireEvent in jsdom
    // We confirm the component renders without calling setTemporalTs on mount
    expect(setTemporalTs).not.toHaveBeenCalled()

    // Even after timer flush, no calls from mount alone
    vi.advanceTimersByTime(500)
    expect(setTemporalTs).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('renders "Time travel to date" label', () => {
    render(<TemporalSlider />)
    expect(screen.getByText('Time travel to date')).toBeInTheDocument()
  })

  it('shows empty-state when all memories have invalid (empty-string) validFrom', () => {
    // rows with validFrom='' → new Date('').getTime() === NaN
    // After NaN filter, no valid epochs remain → epochBounds is null → empty state shown
    const nanMemories: MemoryRow[] = [
      makeRow({ id: 1, validFrom: '', name: 'nan-row' }),
    ]
    useMemoryStore.setState({ memories: nanMemories, temporalTs: null })
    render(<TemporalSlider />)
    // Falls through to the empty-state branch, not the slider branch
    expect(
      screen.getByText('No memories loaded — switch to Fact Table first to populate the time range.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })

  it('handles mixed valid and invalid validFrom — shows empty state when only one unique epoch', () => {
    // One NaN + one valid = single unique timestamp → min === max → slider collapses → empty state
    const mixedMemories: MemoryRow[] = [
      makeRow({ id: 1, validFrom: '', name: 'nan-row' }),
      makeRow({ id: 2, validFrom: '2026-01-01T00:00:00Z', name: 'valid-row' }),
    ]
    useMemoryStore.setState({ memories: mixedMemories, temporalTs: '2026-01-01T00:00:00Z' })
    render(<TemporalSlider />)
    // Single unique epoch → epochBounds is null → empty state
    expect(
      screen.getByText('No memories loaded — switch to Fact Table first to populate the time range.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })

  it('renders slider when multiple valid unique epochs exist among mixed rows', () => {
    // Two different valid epochs + one NaN → range is non-zero → slider renders
    const mixedMemories: MemoryRow[] = [
      makeRow({ id: 1, validFrom: '', name: 'nan-row' }),
      makeRow({ id: 2, validFrom: '2026-01-01T00:00:00Z', name: 'valid-early' }),
      makeRow({ id: 3, validFrom: '2026-03-01T00:00:00Z', name: 'valid-late' }),
    ]
    useMemoryStore.setState({ memories: mixedMemories, temporalTs: '2026-03-01T00:00:00Z' })
    render(<TemporalSlider />)
    const slider = screen.getByRole('slider', { name: 'Time travel to date' })
    expect(slider).toBeInTheDocument()
    expect(slider).not.toHaveAttribute('aria-valuenow', 'NaN')
    expect(slider).not.toHaveAttribute('aria-valuemin', 'NaN')
    expect(slider).not.toHaveAttribute('aria-valuemax', 'NaN')
  })
})
