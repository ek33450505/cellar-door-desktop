import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useMemoryStore } from '@/store/memoryStore'
import SupersessionChain from './SupersessionChain'
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
const makeVersion = (overrides?: Partial<MemoryRow>): MemoryRow => ({
  id: 1,
  agent: 'planner',
  name: 'fact1',
  memoryType: 'project',
  content: 'version content',
  sourceType: 'hook',
  validFrom: '2026-01-01T00:00:00Z',
  validTo: '2026-02-01T00:00:00Z',
  superseded: true,
  ...overrides,
})

const VERSIONS: MemoryRow[] = [
  makeVersion({ id: 1, validFrom: '2026-01-01T00:00:00Z', validTo: '2026-02-01T00:00:00Z', superseded: true, content: 'v1 content' }),
  makeVersion({ id: 2, validFrom: '2026-02-01T00:00:00Z', validTo: '2026-03-01T00:00:00Z', superseded: true, content: 'v2 content' }),
  makeVersion({ id: 3, validFrom: '2026-03-01T00:00:00Z', validTo: undefined, superseded: false, content: 'v3 content (current)' }),
]

const BASE_STATE = {
  memories: VERSIONS,
  injections: [],
  filters: {},
  temporalTs: null,
  ftsQuery: '',
  activeView: 'chain' as const,
  chainName: 'fact1',
  chainAgent: 'planner',
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
describe('SupersessionChain', () => {
  it('renders the dialog when activeView is "chain" and chainName is set', () => {
    render(<SupersessionChain />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders the version history ordered list', () => {
    render(<SupersessionChain />)
    expect(screen.getByRole('list', { name: 'Version history' })).toBeInTheDocument()
  })

  it('renders exactly 3 list items for 3 versions', () => {
    render(<SupersessionChain />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
  })

  it('dialog title contains chainName and chainAgent', () => {
    render(<SupersessionChain />)
    const title = screen.getByText(/Version history: fact1 \(planner\)/)
    expect(title).toBeInTheDocument()
  })

  it('shows fact count in description', () => {
    render(<SupersessionChain />)
    expect(screen.getByText(/3 versions/)).toBeInTheDocument()
  })

  it('shows "current" badge for non-superseded version', () => {
    render(<SupersessionChain />)
    const currentBadges = screen.getAllByText('current')
    expect(currentBadges.length).toBeGreaterThan(0)
  })

  it('shows "superseded" badge for superseded versions', () => {
    render(<SupersessionChain />)
    const badges = screen.getAllByText('superseded')
    expect(badges).toHaveLength(2)
  })

  it('close button has accessible aria-label', () => {
    render(<SupersessionChain />)
    expect(screen.getByRole('button', { name: 'Close version history' })).toBeInTheDocument()
  })

  it('does not render dialog when activeView is not "chain"', () => {
    useMemoryStore.setState({ activeView: 'table' })
    render(<SupersessionChain />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not render dialog when chainName is null', () => {
    useMemoryStore.setState({ activeView: 'chain', chainName: null })
    render(<SupersessionChain />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows empty state when memories is empty and not loading', () => {
    useMemoryStore.setState({ memories: [], loading: false })
    render(<SupersessionChain />)
    expect(screen.getByText('No version history available.')).toBeInTheDocument()
  })

  it('empty state does not render a list', () => {
    useMemoryStore.setState({ memories: [], loading: false })
    render(<SupersessionChain />)
    expect(screen.queryByRole('list', { name: 'Version history' })).not.toBeInTheDocument()
  })
})
