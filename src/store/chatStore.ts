import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
}

export interface PersistedChat {
  id: string
  title: string
  createdAt: number  // epoch ms
  updatedAt: number  // epoch ms
  workspacePath: string | null
  messages: AssistantMessage[]
}

export interface ChatStore {
  // Persisted multi-chat state
  chats: PersistedChat[]
  activeChatId: string | null

  // Derived convenience field — mirrors the active chat's messages.
  // Updated in every action that modifies the active chat.
  // Backward-compatible with callers that read useChatStore(s => s.messages).
  messages: AssistantMessage[]

  // Non-persisted UI state
  isStreaming: boolean
  model: string
  availableModels: string[]
  ollamaStatus: 'ready' | 'error' | 'dead' | 'unknown'
  agentMode: boolean
  agentSessionId: string | null

  // Multi-chat actions
  createChat: (title?: string) => string
  selectChat: (id: string) => void
  setWorkspacePath: (chatId: string, path: string | null) => void
  setWorkspace: (chatId: string, path: string | null) => void

  // Single-chat actions (operate on activeChatId)
  addUserMessage: (content: string) => void
  appendToken: (token: string) => void
  finalizeAssistant: () => void
  clearChat: () => void

  // Non-chat actions
  setModel: (model: string) => void
  setAvailableModels: (models: string[]) => void
  setOllamaStatus: (status: ChatStore['ollamaStatus']) => void
  setAgentMode: (enabled: boolean) => void
}

function makeChat(title = 'New Chat'): PersistedChat {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    workspacePath: null,
    messages: [],
  }
}

/** Extract messages for the active chat — used to keep the `messages` field in sync. */
function activeMessages(chats: PersistedChat[], activeChatId: string | null): AssistantMessage[] {
  return chats.find(c => c.id === activeChatId)?.messages ?? []
}

const initialChat = makeChat()

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      // Persisted
      chats: [initialChat],
      activeChatId: initialChat.id,
      messages: [],  // starts empty; hydrated from persist or kept in sync by actions

      // Non-persisted (excluded via partialize below)
      isStreaming: false,
      model: 'mistral',
      availableModels: [],
      ollamaStatus: 'unknown',
      agentMode: false,
      agentSessionId: null,

      createChat(title = 'New Chat') {
        const chat = makeChat(title)
        set(() => ({
          chats: [...get().chats, chat],
          activeChatId: chat.id,
          messages: [],  // new chat starts with no messages
        }))
        return chat.id
      },

      selectChat(id) {
        const chats = get().chats
        set({
          activeChatId: id,
          messages: activeMessages(chats, id),
        })
      },

      setWorkspacePath(chatId, path) {
        set(state => {
          const chats = state.chats.map(c =>
            c.id === chatId
              ? { ...c, workspacePath: path, updatedAt: Date.now() }
              : c,
          )
          return {
            chats,
            messages: activeMessages(chats, state.activeChatId),
          }
        })
      },

      // Alias kept for WorkspacePicker compatibility
      setWorkspace(chatId, path) {
        get().setWorkspacePath(chatId, path)
      },

      addUserMessage(content) {
        set(state => {
          const { chats, activeChatId } = state
          const now = Date.now()
          const updatedChats = chats.map(c =>
            c.id === activeChatId
              ? {
                  ...c,
                  messages: [...c.messages, { role: 'user' as const, content }],
                  updatedAt: now,
                  title:
                    c.title === 'New Chat' && c.messages.length === 0
                      ? content.slice(0, 40)
                      : c.title,
                }
              : c,
          )
          return {
            chats: updatedChats,
            messages: activeMessages(updatedChats, activeChatId),
            isStreaming: true,
          }
        })
      },

      appendToken(token) {
        set(state => {
          const { chats, activeChatId } = state
          const updatedChats = chats.map(c => {
            if (c.id !== activeChatId) return c
            const msgs = [...c.messages]
            const last = msgs[msgs.length - 1]
            if (last && last.role === 'assistant') {
              msgs[msgs.length - 1] = { ...last, content: last.content + token }
            } else {
              msgs.push({ role: 'assistant', content: token, pending: true })
            }
            return { ...c, messages: msgs, updatedAt: Date.now() }
          })
          return {
            chats: updatedChats,
            messages: activeMessages(updatedChats, activeChatId),
          }
        })
      },

      finalizeAssistant() {
        set(state => {
          const { chats, activeChatId } = state
          const updatedChats = chats.map(c => {
            if (c.id !== activeChatId) return c
            const msgs = [...c.messages]
            const last = msgs[msgs.length - 1]
            if (last && last.role === 'assistant' && last.pending) {
              msgs[msgs.length - 1] = { ...last, pending: false }
            }
            return { ...c, messages: msgs }
          })
          return {
            chats: updatedChats,
            messages: activeMessages(updatedChats, activeChatId),
            isStreaming: false,
          }
        })
      },

      clearChat() {
        set(state => {
          const updatedChats = state.chats.map(c =>
            c.id === state.activeChatId
              ? { ...c, messages: [], updatedAt: Date.now() }
              : c,
          )
          return {
            chats: updatedChats,
            messages: [],
            isStreaming: false,
          }
        })
      },

      setModel: (model) => set({ model }),

      setAvailableModels: (models) => set({ availableModels: models }),

      setOllamaStatus: (ollamaStatus) => set({ ollamaStatus }),

      setAgentMode: (enabled) =>
        set(enabled
          ? { agentMode: true, agentSessionId: crypto.randomUUID() }
          : { agentMode: false }),
    }),
    {
      name: 'cellar-door-chats',
      storage: createJSONStorage(() => localStorage),
      // Only persist chat-related state; exclude derived messages field and UI state
      partialize: (state) => ({
        chats: state.chats,
        activeChatId: state.activeChatId,
      }),
      // After hydrating from localStorage, recompute the messages field
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.messages = activeMessages(state.chats, state.activeChatId)
        }
      },
    },
  ),
)
