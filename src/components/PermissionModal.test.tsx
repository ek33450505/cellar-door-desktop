import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { usePermissionStore } from '@/store/permissionStore'
import type { PendingApproval } from '@/store/permissionStore'
import { PermissionModal } from './PermissionModal'

function makePending(overrides?: Partial<PendingApproval>): PendingApproval {
  return {
    toolName: 'test_tool',
    toolDescription: 'A test tool description',
    scope: 'ReadOnly',
    args: { query: 'hello' },
    callId: 'call-001',
    resolve: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  usePermissionStore.setState({
    sessionGrants: {},
    pendingApproval: null,
  })
})

describe('PermissionModal', () => {
  it('does not render when pendingApproval is null', () => {
    render(<PermissionModal />)
    expect(screen.queryByText('Permission Request')).not.toBeInTheDocument()
  })

  it('renders modal with tool name and description when pendingApproval is set', () => {
    const pending = makePending()
    usePermissionStore.setState({ pendingApproval: pending })
    render(<PermissionModal />)

    expect(screen.getByText('Permission Request')).toBeInTheDocument()
    expect(screen.getByText('test_tool')).toBeInTheDocument()
    expect(screen.getByText('A test tool description')).toBeInTheDocument()
  })

  it('renders scope badge', () => {
    usePermissionStore.setState({ pendingApproval: makePending({ scope: 'ReadOnly' }) })
    render(<PermissionModal />)
    expect(screen.getByLabelText('Scope: Read Only')).toBeInTheDocument()
  })

  it('"Deny" button calls resolveApproval with "deny"', async () => {
    const pending = makePending()
    usePermissionStore.setState({ pendingApproval: pending })
    render(<PermissionModal />)

    await userEvent.click(screen.getByRole('button', { name: 'Deny' }))

    expect(pending.resolve).toHaveBeenCalledWith('deny')
    expect(usePermissionStore.getState().pendingApproval).toBeNull()
  })

  it('"Allow once" button calls resolveApproval with "once"', async () => {
    const pending = makePending()
    usePermissionStore.setState({ pendingApproval: pending })
    render(<PermissionModal />)

    await userEvent.click(screen.getByRole('button', { name: 'Allow once' }))

    expect(pending.resolve).toHaveBeenCalledWith('once')
    expect(usePermissionStore.getState().pendingApproval).toBeNull()
  })

  it('"Allow session" button calls resolveApproval with "session"', async () => {
    const pending = makePending()
    usePermissionStore.setState({ pendingApproval: pending })
    render(<PermissionModal />)

    await userEvent.click(screen.getByRole('button', { name: 'Allow session' }))

    expect(pending.resolve).toHaveBeenCalledWith('session')
    expect(usePermissionStore.getState().pendingApproval).toBeNull()
  })

  it('"Allow always" renders for ReadOnly scope and calls resolveApproval with "always"', async () => {
    const pending = makePending({ scope: 'ReadOnly' })
    usePermissionStore.setState({ pendingApproval: pending })
    render(<PermissionModal />)

    const alwaysBtn = screen.getByRole('button', { name: 'Allow always' })
    expect(alwaysBtn).toBeInTheDocument()

    await userEvent.click(alwaysBtn)

    expect(pending.resolve).toHaveBeenCalledWith('always')
    expect(usePermissionStore.getState().pendingApproval).toBeNull()
  })

  it('"Allow always" does NOT render for non-ReadOnly scope', () => {
    usePermissionStore.setState({ pendingApproval: makePending({ scope: 'ShellExec' }) })
    render(<PermissionModal />)

    expect(screen.queryByRole('button', { name: 'Allow always' })).not.toBeInTheDocument()
  })

  it('"Allow always" does NOT render for MemoryWrite scope', () => {
    usePermissionStore.setState({ pendingApproval: makePending({ scope: 'MemoryWrite' }) })
    render(<PermissionModal />)

    expect(screen.queryByRole('button', { name: 'Allow always' })).not.toBeInTheDocument()
  })

  it('"Allow always" does NOT render for Network scope', () => {
    usePermissionStore.setState({ pendingApproval: makePending({ scope: 'Network' }) })
    render(<PermissionModal />)

    expect(screen.queryByRole('button', { name: 'Allow always' })).not.toBeInTheDocument()
  })
})
