import { describe, it, expect, vi, beforeEach } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { useMemoryStore } from './memoryStore'
import type { MemoryRow, InjectionRow } from '@/lib/tauri'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

const mockedInvoke = vi.mocked(invoke)

const makeMemoryRow = (overrides?: Partial<MemoryRow>): MemoryRow => ({
  id: 1,
  agent: 'test-agent',
  name: 'test-memory',
  memoryType: 'feedback',
  content: 'test content',
  sourceType: 'manual',
  validFrom: '2026-01-01T00:00:00Z',
  superseded: false,
  ...overrides,
})

const makeInjectionRow = (overrides?: Partial<InjectionRow>): InjectionRow => ({
  id: 1,
  sessionId: 'session-abc',
  agent: 'code-writer',
  injectedAt: '2026-01-01T00:00:00Z',
  memoryId: 1,
  memoryName: 'test-memory',
  memoryContent: 'test content',
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  // Reset store to initial state between tests
  useMemoryStore.setState({
    memories: [],
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

describe('initial state', () => {
  it('has correct initial values', () => {
    const state = useMemoryStore.getState()
    expect(state.activeView).toBe('table')
    expect(state.filters).toEqual({})
    expect(state.loading).toBe(false)
    expect(state.memories).toEqual([])
    expect(state.injections).toEqual([])
    expect(state.error).toBeNull()
    expect(state.lastRefreshed).toBeNull()
    expect(state.temporalTs).toBeNull()
    expect(state.ftsQuery).toBe('')
  })
})

describe('setFilter', () => {
  it('merges partial filter into state.filters', () => {
    useMemoryStore.getState().setFilter({ agent: 'planner' })
    expect(useMemoryStore.getState().filters).toEqual({ agent: 'planner' })
  })

  it('merges multiple filter keys while preserving existing', () => {
    useMemoryStore.getState().setFilter({ agent: 'planner' })
    useMemoryStore.getState().setFilter({ memoryType: 'feedback' })
    expect(useMemoryStore.getState().filters).toEqual({
      agent: 'planner',
      memoryType: 'feedback',
    })
  })

  it('overwrites existing filter key', () => {
    useMemoryStore.getState().setFilter({ agent: 'planner' })
    useMemoryStore.getState().setFilter({ agent: 'researcher' })
    expect(useMemoryStore.getState().filters.agent).toBe('researcher')
  })
})

describe('setActiveView', () => {
  it('updates activeView', () => {
    useMemoryStore.getState().setActiveView('chain')
    expect(useMemoryStore.getState().activeView).toBe('chain')
  })

  it('can set all valid view values', () => {
    const views = ['table', 'chain', 'temporal', 'fts', 'injections'] as const
    for (const view of views) {
      useMemoryStore.getState().setActiveView(view)
      expect(useMemoryStore.getState().activeView).toBe(view)
    }
  })
})

describe('fetchMemories', () => {
  it('calls invoke with command list_memories', async () => {
    const rows = [makeMemoryRow()]
    mockedInvoke.mockResolvedValueOnce(rows)

    await useMemoryStore.getState().fetchMemories()

    expect(mockedInvoke).toHaveBeenCalledWith('list_memories', expect.any(Object))
  })

  it('sets memories on successful resolve', async () => {
    const rows = [makeMemoryRow(), makeMemoryRow({ id: 2, name: 'second' })]
    mockedInvoke.mockResolvedValueOnce(rows)

    await useMemoryStore.getState().fetchMemories()

    expect(useMemoryStore.getState().memories).toEqual(rows)
    expect(useMemoryStore.getState().loading).toBe(false)
    expect(useMemoryStore.getState().lastRefreshed).not.toBeNull()
  })

  it('sets error on reject', async () => {
    mockedInvoke.mockRejectedValueOnce(new Error('DB connection failed'))

    await useMemoryStore.getState().fetchMemories()

    expect(useMemoryStore.getState().error).toContain('DB connection failed')
    expect(useMemoryStore.getState().loading).toBe(false)
    expect(useMemoryStore.getState().memories).toEqual([])
  })

  it('passes filters to invoke as snake_case params', async () => {
    mockedInvoke.mockResolvedValueOnce([])
    useMemoryStore.getState().setFilter({ agent: 'planner', memoryType: 'feedback' })

    await useMemoryStore.getState().fetchMemories()

    expect(mockedInvoke).toHaveBeenCalledWith('list_memories', {
      agent: 'planner',
      memory_type: 'feedback',
      source_type: undefined,
      limit: undefined,
    })
  })
})

describe('fetchFts', () => {
  it('passes ftsQuery state to invoke', async () => {
    mockedInvoke.mockResolvedValueOnce([])
    useMemoryStore.setState({ ftsQuery: 'type:feedback agent:planner' })

    await useMemoryStore.getState().fetchFts()

    expect(mockedInvoke).toHaveBeenCalledWith('fts_search', {
      query: 'type:feedback agent:planner',
      limit: undefined,
    })
  })

  it('sets memories from fts results', async () => {
    const rows = [makeMemoryRow({ name: 'fts-result' })]
    mockedInvoke.mockResolvedValueOnce(rows)
    useMemoryStore.setState({ ftsQuery: 'test' })

    await useMemoryStore.getState().fetchFts()

    expect(useMemoryStore.getState().memories).toEqual(rows)
  })
})

describe('fetchInjections', () => {
  it('sets injections on successful resolve', async () => {
    const rows = [makeInjectionRow()]
    mockedInvoke.mockResolvedValueOnce(rows)

    await useMemoryStore.getState().fetchInjections()

    expect(useMemoryStore.getState().injections).toEqual(rows)
    expect(useMemoryStore.getState().lastRefreshed).not.toBeNull()
  })
})

describe('refresh', () => {
  it('calls fetchFts when activeView is fts', async () => {
    mockedInvoke.mockResolvedValueOnce([])
    useMemoryStore.setState({ activeView: 'fts', ftsQuery: 'hello' })

    await useMemoryStore.getState().refresh()

    expect(mockedInvoke).toHaveBeenCalledWith('fts_search', expect.any(Object))
    expect(mockedInvoke).not.toHaveBeenCalledWith('list_memories', expect.any(Object))
  })

  it('calls fetchMemories when activeView is table', async () => {
    mockedInvoke.mockResolvedValueOnce([])
    useMemoryStore.setState({ activeView: 'table' })

    await useMemoryStore.getState().refresh()

    expect(mockedInvoke).toHaveBeenCalledWith('list_memories', expect.any(Object))
  })

  it('calls fetchInjections when activeView is injections', async () => {
    mockedInvoke.mockResolvedValueOnce([])
    useMemoryStore.setState({ activeView: 'injections' })

    await useMemoryStore.getState().refresh()

    expect(mockedInvoke).toHaveBeenCalledWith('list_injections', expect.any(Object))
  })
})

describe('clearError', () => {
  it('clears the error field', () => {
    useMemoryStore.setState({ error: 'some error' })
    useMemoryStore.getState().clearError()
    expect(useMemoryStore.getState().error).toBeNull()
  })
})
