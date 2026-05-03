import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from './chatStore'

// Helper: reset store to a known clean state with a single empty chat.
function resetStore() {
  const chatId = crypto.randomUUID()
  useChatStore.setState({
    chats: [
      {
        id: chatId,
        title: 'New Chat',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        workspacePath: null,
        messages: [],
      },
    ],
    activeChatId: chatId,
    isStreaming: false,
    model: 'mistral',
    availableModels: [],
    ollamaStatus: 'unknown',
    agentMode: false,
    agentSessionId: null,
  })
  return chatId
}

beforeEach(() => {
  resetStore()
})

describe('chatStore', () => {
  // -------------------------------------------------------------------------
  // Existing single-chat action tests — backward compat
  // -------------------------------------------------------------------------

  it('addUserMessage appends a user turn and sets isStreaming', () => {
    useChatStore.getState().addUserMessage('hello')
    const { messages, isStreaming } = useChatStore.getState()
    expect(messages).toHaveLength(1)
    expect(messages[0]).toEqual({ role: 'user', content: 'hello' })
    expect(isStreaming).toBe(true)
  })

  it('appendToken creates a pending assistant message when none exists', () => {
    useChatStore.getState().appendToken('Hi')
    const { messages } = useChatStore.getState()
    expect(messages).toHaveLength(1)
    expect(messages[0]).toEqual({ role: 'assistant', content: 'Hi', pending: true })
  })

  it('appendToken appends to the last assistant message', () => {
    useChatStore.getState().appendToken('Hi')
    useChatStore.getState().appendToken(' there')
    const { messages } = useChatStore.getState()
    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('Hi there')
  })

  it('appendToken does not create a new assistant message when last is already assistant', () => {
    useChatStore.getState().appendToken('A')
    useChatStore.getState().appendToken('B')
    expect(useChatStore.getState().messages).toHaveLength(1)
  })

  it('finalizeAssistant sets pending to false and isStreaming to false', () => {
    useChatStore.getState().appendToken('token')
    useChatStore.setState({ isStreaming: true })
    useChatStore.getState().finalizeAssistant()
    const { messages, isStreaming } = useChatStore.getState()
    expect(messages[0].pending).toBe(false)
    expect(isStreaming).toBe(false)
  })

  it('setOllamaStatus updates ollamaStatus', () => {
    useChatStore.getState().setOllamaStatus('ready')
    expect(useChatStore.getState().ollamaStatus).toBe('ready')
    useChatStore.getState().setOllamaStatus('error')
    expect(useChatStore.getState().ollamaStatus).toBe('error')
  })

  it('setModel updates the model', () => {
    useChatStore.getState().setModel('llama3')
    expect(useChatStore.getState().model).toBe('llama3')
  })

  it('setAvailableModels updates the list', () => {
    useChatStore.getState().setAvailableModels(['mistral', 'llama3'])
    expect(useChatStore.getState().availableModels).toEqual(['mistral', 'llama3'])
  })

  it('clearChat resets messages and isStreaming', () => {
    useChatStore.getState().addUserMessage('hello')
    useChatStore.getState().clearChat()
    const { messages, isStreaming } = useChatStore.getState()
    expect(messages).toHaveLength(0)
    expect(isStreaming).toBe(false)
  })

  // -------------------------------------------------------------------------
  // New multi-chat tests — E-12
  // -------------------------------------------------------------------------

  it('createChat returns a new id and adds to chats', () => {
    const initialCount = useChatStore.getState().chats.length
    const newId = useChatStore.getState().createChat('My Chat')
    const state = useChatStore.getState()
    expect(state.chats).toHaveLength(initialCount + 1)
    expect(state.activeChatId).toBe(newId)
    const created = state.chats.find(c => c.id === newId)
    expect(created).toBeDefined()
    expect(created!.title).toBe('My Chat')
    expect(created!.messages).toHaveLength(0)
    expect(created!.workspacePath).toBeNull()
  })

  it('createChat uses "New Chat" as default title', () => {
    const newId = useChatStore.getState().createChat()
    const chat = useChatStore.getState().chats.find(c => c.id === newId)
    expect(chat!.title).toBe('New Chat')
  })

  it('addUserMessage operates on the active chat only', () => {
    const id1 = useChatStore.getState().activeChatId!
    const id2 = useChatStore.getState().createChat('Second')
    useChatStore.getState().addUserMessage('hello')
    const state = useChatStore.getState()
    const chat1 = state.chats.find(c => c.id === id1)!
    const chat2 = state.chats.find(c => c.id === id2)!
    expect(chat2.messages).toHaveLength(1)
    expect(chat1.messages).toHaveLength(0)
  })

  it('clearChat empties the active chat messages without deleting the chat', () => {
    useChatStore.getState().addUserMessage('hello')
    expect(useChatStore.getState().messages).toHaveLength(1)
    useChatStore.getState().clearChat()
    const state = useChatStore.getState()
    expect(state.messages).toHaveLength(0)
    // Chat still exists
    expect(state.chats.find(c => c.id === state.activeChatId)).toBeDefined()
  })

  it('setWorkspacePath updates workspacePath on the specified chat', () => {
    const chatId = useChatStore.getState().activeChatId!
    useChatStore.getState().setWorkspacePath(chatId, '/Users/ed/Projects/myapp')
    const chat = useChatStore.getState().chats.find(c => c.id === chatId)!
    expect(chat.workspacePath).toBe('/Users/ed/Projects/myapp')
  })

  it('setWorkspacePath can clear workspacePath to null', () => {
    const chatId = useChatStore.getState().activeChatId!
    useChatStore.getState().setWorkspacePath(chatId, '/tmp/foo')
    useChatStore.getState().setWorkspacePath(chatId, null)
    const chat = useChatStore.getState().chats.find(c => c.id === chatId)!
    expect(chat.workspacePath).toBeNull()
  })

  it('setWorkspace is an alias for setWorkspacePath', () => {
    const chatId = useChatStore.getState().activeChatId!
    useChatStore.getState().setWorkspace(chatId, '/tmp/alias-test')
    const chat = useChatStore.getState().chats.find(c => c.id === chatId)!
    expect(chat.workspacePath).toBe('/tmp/alias-test')
  })

  // -------------------------------------------------------------------------
  // Persistence round-trip — localStorage mock
  // -------------------------------------------------------------------------

  it('persisted data is written to localStorage under cellar-door-chats key', () => {
    useChatStore.getState().addUserMessage('persisted message')
    // zustand persist writes synchronously to localStorage
    const raw = localStorage.getItem('cellar-door-chats')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    // The persist middleware stores state under { state: {...}, version: N }
    const persistedChats: { messages: { content: string }[] }[] = parsed.state?.chats ?? parsed.chats ?? []
    const hasMessage = persistedChats.some(chat =>
      chat.messages.some((m: { content: string }) => m.content === 'persisted message'),
    )
    expect(hasMessage).toBe(true)
  })
})
