import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from './chatStore'

beforeEach(() => {
  useChatStore.setState({
    messages: [],
    isStreaming: false,
    model: 'mistral',
    availableModels: [],
    ollamaStatus: 'unknown',
  })
})

describe('chatStore', () => {
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
})
