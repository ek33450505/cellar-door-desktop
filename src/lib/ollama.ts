import { invoke } from '@tauri-apps/api/core'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface MemoryFact {
  name: string
  content: string
  memoryType: string
  agent: string
}

// Tauri invoke wrappers — snake_case keys match Rust handler param names
export const sendChat = (
  model: string,
  messages: ChatMessage[],
  topK = 5,
): Promise<void> =>
  invoke('send_chat', { model, messages, top_k: topK })

export const listModels = (): Promise<string[]> =>
  invoke<string[]>('list_models')

export const getMemoryContext = (
  prompt: string,
  topN: number,
  agent: string,
): Promise<MemoryFact[]> =>
  invoke<MemoryFact[]>('get_memory_context', { prompt, top_n: topN, agent })

export const spawnOllama = (): Promise<void> =>
  invoke('spawn_ollama')
