import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { PermissionConsole } from './PermissionConsole'
import type { ToolLogEntry } from './PermissionConsole'

function makeEntry(overrides?: Partial<ToolLogEntry>): ToolLogEntry {
  return {
    callId: 'call-1',
    toolName: 'read_file',
    scope: 'ReadOnly',
    args: { path: '/tmp/test.txt' },
    decision: null,
    result: null,
    error: null,
    durationMs: null,
    startedAt: Date.now() - 2000,
    status: 'pending',
    ...overrides,
  }
}

describe('PermissionConsole', () => {
  it('renders empty state when no entries', () => {
    render(<PermissionConsole entries={[]} />)
    expect(screen.getByText(/no tool calls yet/i)).toBeInTheDocument()
  })

  it('renders a pending entry with tool name and scope badge', () => {
    const entry = makeEntry()
    render(<PermissionConsole entries={[entry]} />)
    expect(screen.getByText('read_file')).toBeInTheDocument()
    expect(screen.getByLabelText(/scope: read only/i)).toBeInTheDocument()
    expect(screen.getByText(/pending/i)).toBeInTheDocument()
  })

  it('renders resolved entry with decision badge after result', () => {
    const entry = makeEntry({
      status: 'resolved',
      decision: 'once',
      result: 'file contents here',
      durationMs: 120,
    })
    render(<PermissionConsole entries={[entry]} />)
    expect(screen.getByLabelText(/decision: allowed-once/i)).toBeInTheDocument()
    expect(screen.getByText('120ms')).toBeInTheDocument()
  })

  it('shows error message on error state', () => {
    const entry = makeEntry({
      status: 'error',
      error: 'Permission denied',
      durationMs: 50,
    })
    render(<PermissionConsole entries={[entry]} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Permission denied')
  })

  it('entries are sorted newest-first (descending startedAt)', () => {
    const older = makeEntry({ callId: 'old', toolName: 'write_file', startedAt: Date.now() - 10000 })
    const newer = makeEntry({ callId: 'new', toolName: 'read_file', startedAt: Date.now() - 1000 })
    render(<PermissionConsole entries={[older, newer]} />)
    const items = screen.getAllByRole('listitem')
    // Newest first → read_file appears before write_file
    expect(items[0]).toHaveTextContent('read_file')
    expect(items[1]).toHaveTextContent('write_file')
  })

  it('expands args when Show args button clicked', async () => {
    const user = userEvent.setup()
    const entry = makeEntry({ args: { path: '/tmp/test.txt' } })
    render(<PermissionConsole entries={[entry]} />)
    const btn = screen.getByRole('button', { name: /show args/i })
    await user.click(btn)
    expect(screen.getByText(/\/tmp\/test\.txt/)).toBeInTheDocument()
  })

  it('shows entry count badge when entries exist', () => {
    const entries = [
      makeEntry({ callId: 'c1' }),
      makeEntry({ callId: 'c2', toolName: 'write_file', scope: 'MemoryWrite' }),
    ]
    render(<PermissionConsole entries={entries} />)
    expect(screen.getByText('2 calls')).toBeInTheDocument()
  })
})
