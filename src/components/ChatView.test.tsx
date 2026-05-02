import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useChatStore } from '@/store/chatStore'
import ChatView from './ChatView'

// Mock Tauri APIs — no real invoke calls in tests
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

// Mock child components that have side effects to keep tests focused
vi.mock('./ModelSelector', () => ({
  ModelSelector: () => <div data-testid="model-selector" />,
}))

beforeEach(() => {
  vi.clearAllMocks()
  useChatStore.setState({
    messages: [],
    isStreaming: false,
    model: 'mistral',
    availableModels: [],
    ollamaStatus: 'unknown',
  })
})

describe('ChatView', () => {
  it('shows error banner and disables input when ollamaStatus is error', () => {
    useChatStore.setState({ ollamaStatus: 'error' })
    render(<ChatView />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    const textarea = screen.getByRole('textbox', { name: /chat message/i })
    expect(textarea).toBeDisabled()
  })

  it('renders a user message bubble when ollamaStatus is ready', () => {
    useChatStore.setState({
      ollamaStatus: 'ready',
      messages: [{ role: 'user', content: 'hello there' }],
    })
    render(<ChatView />)

    expect(screen.getByText('hello there')).toBeInTheDocument()
  })

  it('disables send button when isStreaming is true', () => {
    useChatStore.setState({ ollamaStatus: 'ready', isStreaming: true })
    render(<ChatView />)

    const sendBtn = screen.getByRole('button', { name: /send message/i })
    expect(sendBtn).toBeDisabled()
  })
})
