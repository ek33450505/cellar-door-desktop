import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { AgentModeToggle } from './AgentModeToggle'
import { useChatStore } from '@/store/chatStore'

beforeEach(() => {
  useChatStore.setState({
    agentMode: false,
    agentSessionId: null,
  })
})

describe('AgentModeToggle', () => {
  it('renders the toggle in off state initially', () => {
    render(<AgentModeToggle />)
    const toggle = screen.getByRole('switch', { name: /agent mode/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('disclaimer is not shown when agent mode is off', () => {
    render(<AgentModeToggle />)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('enables agent mode and shows disclaimer on click', async () => {
    const user = userEvent.setup()
    render(<AgentModeToggle />)
    const toggle = screen.getByRole('switch', { name: /agent mode/i })
    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(useChatStore.getState().agentMode).toBe(true)
    expect(screen.getByRole('note')).toBeInTheDocument()
    expect(screen.getByText(/approve each tool call/i)).toBeInTheDocument()
  })

  it('generates a new agentSessionId when enabled', async () => {
    const user = userEvent.setup()
    render(<AgentModeToggle />)
    expect(useChatStore.getState().agentSessionId).toBeNull()

    await user.click(screen.getByRole('switch', { name: /agent mode/i }))

    const sessionId = useChatStore.getState().agentSessionId
    expect(sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('disables agent mode on second click', async () => {
    const user = userEvent.setup()
    useChatStore.setState({ agentMode: true, agentSessionId: 'existing-id' })
    render(<AgentModeToggle />)

    const toggle = screen.getByRole('switch', { name: /agent mode/i })
    await user.click(toggle)

    expect(useChatStore.getState().agentMode).toBe(false)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })
})
