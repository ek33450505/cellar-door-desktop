import { create } from 'zustand'

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
}

export interface ChatStore {
  messages: AssistantMessage[]
  isStreaming: boolean
  model: string
  availableModels: string[]
  ollamaStatus: 'ready' | 'error' | 'dead' | 'unknown'
  agentMode: boolean
  agentSessionId: string | null
  addUserMessage: (content: string) => void
  appendToken: (token: string) => void
  finalizeAssistant: () => void
  setModel: (model: string) => void
  setAvailableModels: (models: string[]) => void
  setOllamaStatus: (status: ChatStore['ollamaStatus']) => void
  clearChat: () => void
  setAgentMode: (enabled: boolean) => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isStreaming: false,
  model: 'mistral',
  availableModels: [],
  ollamaStatus: 'unknown',
  agentMode: false,
  agentSessionId: null,

  addUserMessage: (content) =>
    set((state) => ({
      messages: [...state.messages, { role: 'user', content }],
      isStreaming: true,
    })),

  appendToken: (token) =>
    set((state) => {
      const messages = [...state.messages]
      const last = messages[messages.length - 1]
      if (last && last.role === 'assistant') {
        messages[messages.length - 1] = {
          ...last,
          content: last.content + token,
        }
      } else {
        messages.push({ role: 'assistant', content: token, pending: true })
      }
      return { messages }
    }),

  finalizeAssistant: () =>
    set((state) => {
      const messages = [...state.messages]
      const last = messages[messages.length - 1]
      if (last && last.role === 'assistant' && last.pending) {
        messages[messages.length - 1] = { ...last, pending: false }
      }
      return { messages, isStreaming: false }
    }),

  setModel: (model) => set({ model }),

  setAvailableModels: (models) => set({ availableModels: models }),

  setOllamaStatus: (ollamaStatus) => set({ ollamaStatus }),

  clearChat: () => set({ messages: [], isStreaming: false }),

  setAgentMode: (enabled) =>
    set(enabled
      ? { agentMode: true, agentSessionId: crypto.randomUUID() }
      : { agentMode: false }),
}))
