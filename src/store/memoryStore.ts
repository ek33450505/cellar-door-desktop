import { create } from 'zustand'
import {
  listMemories,
  supersessionChain,
  memoriesAt,
  ftsSearch,
  listInjections,
} from '@/lib/tauri'
import type { MemoryRow, InjectionRow } from '@/lib/tauri'

export type ActiveView = 'table' | 'chain' | 'temporal' | 'fts' | 'injections' | 'chat' | 'tool-log'

export interface MemoryFilters {
  agent?: string
  memoryType?: string
  sourceType?: string
}

export interface MemoryState {
  memories: MemoryRow[]
  injections: InjectionRow[]
  filters: MemoryFilters
  temporalTs: string | null
  ftsQuery: string
  activeView: ActiveView
  chainName: string | null
  chainAgent: string | null
  loading: boolean
  error: string | null
  lastRefreshed: string | null
}

export interface MemoryActions {
  setFilter: (partial: Partial<MemoryFilters>) => void
  setTemporalTs: (ts: string | null) => void
  setFtsQuery: (q: string) => void
  setActiveView: (view: ActiveView) => void
  setChain: (name: string, agent: string) => void
  fetchMemories: () => Promise<void>
  fetchChain: () => Promise<void>
  fetchAt: () => Promise<void>
  fetchFts: () => Promise<void>
  fetchInjections: (sessionId?: string) => Promise<void>
  refresh: () => Promise<void>
  clearError: () => void
}

export type MemoryStore = MemoryState & MemoryActions

export const useMemoryStore = create<MemoryStore>((set, get) => ({
  // --- Initial state ---
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

  // --- Actions ---
  setFilter: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),

  setTemporalTs: (ts) => set({ temporalTs: ts }),

  setFtsQuery: (q) => set({ ftsQuery: q }),

  setActiveView: (view) => set({ activeView: view }),

  setChain: (name, agent) => set({ chainName: name, chainAgent: agent }),

  fetchMemories: async () => {
    set({ loading: true, error: null })
    try {
      const { filters } = get()
      const memories = await listMemories(filters)
      set({ memories, loading: false, lastRefreshed: new Date().toISOString() })
    } catch (err) {
      set({ loading: false, error: String(err) })
    }
  },

  fetchChain: async () => {
    const { chainName, chainAgent } = get()
    if (!chainName || !chainAgent) {
      set({ error: 'No chain target set — call setChain first' })
      return
    }
    set({ loading: true, error: null })
    try {
      const memories = await supersessionChain(chainName, chainAgent)
      set({ memories, loading: false, lastRefreshed: new Date().toISOString() })
    } catch (err) {
      set({ loading: false, error: String(err) })
    }
  },

  fetchAt: async () => {
    const { temporalTs, filters } = get()
    if (!temporalTs) {
      set({ error: 'No timestamp set — call setTemporalTs first' })
      return
    }
    set({ loading: true, error: null })
    try {
      const memories = await memoriesAt(temporalTs, filters.agent)
      set({ memories, loading: false, lastRefreshed: new Date().toISOString() })
    } catch (err) {
      set({ loading: false, error: String(err) })
    }
  },

  fetchFts: async () => {
    const { ftsQuery } = get()
    set({ loading: true, error: null })
    try {
      const memories = await ftsSearch(ftsQuery)
      set({ memories, loading: false, lastRefreshed: new Date().toISOString() })
    } catch (err) {
      set({ loading: false, error: String(err) })
    }
  },

  fetchInjections: async (sessionId?: string) => {
    set({ loading: true, error: null })
    try {
      const injections = await listInjections(sessionId)
      set({ injections, loading: false, lastRefreshed: new Date().toISOString() })
    } catch (err) {
      set({ loading: false, error: String(err) })
    }
  },

  refresh: async () => {
    const { activeView } = get()
    switch (activeView) {
      case 'table':
        return get().fetchMemories()
      case 'chain':
        return get().fetchChain()
      case 'temporal':
        return get().fetchAt()
      case 'fts':
        return get().fetchFts()
      case 'injections':
        return get().fetchInjections()
      case 'tool-log':
        // tool-log manages its own refresh via local state; no-op here
        return
    }
  },

  clearError: () => set({ error: null }),
}))
