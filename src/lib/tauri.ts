import { invoke } from '@tauri-apps/api/core'

// Wire format from Rust (after #[serde(rename_all = "camelCase")] on MemoryRow)
export type MemoryRow = {
  id: number
  agent: string
  name: string
  memoryType: string
  content: string
  sourceType: string
  validFrom: string
  validTo?: string
  superseded: boolean
}

// Wire format from Rust (after #[serde(rename_all = "camelCase")] on InjectionRow)
export type InjectionRow = {
  id: number
  sessionId: string
  agent: string
  injectedAt: string
  memoryId: number
  memoryName: string
  memoryContent: string
}

// Tauri 2 does NOT auto-convert camelCase → snake_case for command parameters.
// The Rust handler parameter names are snake_case, so we must pass snake_case keys.

export type ListMemoriesFilters = {
  agent?: string
  memoryType?: string
  sourceType?: string
  limit?: number
}

export const listMemories = (filters?: ListMemoriesFilters) =>
  invoke<MemoryRow[]>('list_memories', {
    agent: filters?.agent,
    memory_type: filters?.memoryType,
    source_type: filters?.sourceType,
    limit: filters?.limit,
  })

export const supersessionChain = (name: string, agent: string) =>
  invoke<MemoryRow[]>('supersession_chain', { name, agent })

export const memoriesAt = (timestamp: string, agent?: string) =>
  invoke<MemoryRow[]>('memories_at', { timestamp, agent })

export const ftsSearch = (query: string, limit?: number) =>
  invoke<MemoryRow[]>('fts_search', { query, limit })

export const listInjections = (sessionId?: string, limit?: number) =>
  invoke<InjectionRow[]>('list_injections', { session_id: sessionId, limit })

// Wire format from Rust ToolInvocationRow (serde rename_all = "camelCase")
export type ToolInvocationRow = {
  id: number
  sessionId: string
  callId: string
  toolName: string
  scope: string
  arguments: string
  decision: string
  result: string | null
  error: string | null
  durationMs: number | null
  invokedAt: number
}

export const listToolInvocations = (sessionId?: string, limit?: number) =>
  invoke<ToolInvocationRow[]>('list_tool_invocations', {
    session_id: sessionId,
    limit,
  })
