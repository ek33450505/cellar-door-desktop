import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useMemoryStore } from '@/store/memoryStore'
import FactTable from './FactTable'
import type { MemoryRow } from '@/lib/tauri'

// Mock Tauri at module level — no invoke calls allowed in test files
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

const ROWS: MemoryRow[] = [
  makeRow({ id: 1, agent: 'code-writer', name: 'mem-1', memoryType: 'feedback', sourceType: 'manual' }),
  makeRow({ id: 2, agent: 'planner', name: 'mem-2', memoryType: 'project', sourceType: 'hook', superseded: true }),
  makeRow({ id: 3, agent: 'researcher', name: 'mem-3', memoryType: 'reference', sourceType: 'manual' }),
]

beforeEach(() => {
  vi.clearAllMocks()
  useMemoryStore.setState({
    memories: ROWS,
    injections: [],
    filters: {},
    temporalTs: null,
    ftsQuery: '',
    activeView: 'table',
    chainName: null,
    chainAgent: null,
    loading: false,
    error: null,
    lastRefreshed: null,
  })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('FactTable', () => {
  it('renders 3 data rows for 3 memories in store', () => {
    render(<FactTable />)
    // Each row has role="button" — 3 rows means 3 buttons
    const rows = screen.getAllByRole('button')
    expect(rows).toHaveLength(3)
  })

  it('renders all 3 filter dropdowns', () => {
    render(<FactTable />)
    // Radix Select.Trigger has role="combobox"
    const combos = screen.getAllByRole('combobox')
    expect(combos).toHaveLength(3)
  })

  it('filter dropdowns have accessible labels', () => {
    render(<FactTable />)
    expect(screen.getByRole('combobox', { name: /agent/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /memory type/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /source type/i })).toBeInTheDocument()
  })

  it('table has aria-label "Memory facts table"', () => {
    render(<FactTable />)
    expect(screen.getByRole('table', { name: 'Memory facts table' })).toBeInTheDocument()
  })

  it('column headers use th scope="col"', () => {
    render(<FactTable />)
    const headers = screen.getAllByRole('columnheader')
    expect(headers.length).toBeGreaterThanOrEqual(6)
  })

  it('clicking a row calls setActiveView("chain") and setChain with row name and agent', () => {
    const setActiveView = vi.fn()
    const setChain = vi.fn()
    const fetchChain = vi.fn().mockResolvedValue(undefined)

    useMemoryStore.setState({
      setActiveView,
      setChain,
      fetchChain,
    } as Partial<ReturnType<typeof useMemoryStore.getState>>)

    render(<FactTable />)
    const rows = screen.getAllByRole('button')
    fireEvent.click(rows[0])

    expect(setActiveView).toHaveBeenCalledWith('chain')
    expect(setChain).toHaveBeenCalledWith(ROWS[0].name, ROWS[0].agent)
    expect(fetchChain).toHaveBeenCalled()
  })

  it('pressing Enter on a row triggers the same actions', () => {
    const setActiveView = vi.fn()
    const setChain = vi.fn()
    const fetchChain = vi.fn().mockResolvedValue(undefined)

    useMemoryStore.setState({
      setActiveView,
      setChain,
      fetchChain,
    } as Partial<ReturnType<typeof useMemoryStore.getState>>)

    render(<FactTable />)
    const rows = screen.getAllByRole('button')
    fireEvent.keyDown(rows[1], { key: 'Enter' })

    expect(setActiveView).toHaveBeenCalledWith('chain')
    expect(setChain).toHaveBeenCalledWith(ROWS[1].name, ROWS[1].agent)
  })

  it('superseded row shows "superseded" badge', () => {
    render(<FactTable />)
    expect(screen.getAllByText('superseded').length).toBeGreaterThan(0)
  })

  it('non-superseded rows show "current" badge', () => {
    render(<FactTable />)
    expect(screen.getAllByText('current').length).toBeGreaterThan(0)
  })

  it('shows empty state when memories array is empty and not loading', () => {
    const fetchMemories = vi.fn().mockResolvedValue(undefined)
    useMemoryStore.setState({
      memories: [],
      loading: false,
      fetchMemories,
    } as unknown as Partial<ReturnType<typeof useMemoryStore.getState>>)
    render(<FactTable />)
    expect(screen.getByText('No memories found.')).toBeInTheDocument()
  })
})
