import { useState } from 'react'
import type { PermissionScope, GrantDecision } from '@/store/permissionStore'

export interface ToolLogEntry {
  callId: string
  toolName: string
  scope: PermissionScope
  args: Record<string, unknown>
  decision: GrantDecision | null
  result: string | null
  error: string | null
  durationMs: number | null
  startedAt: number // Date.now()
  status: 'pending' | 'resolved' | 'error'
}

interface Props {
  entries: ToolLogEntry[]
}

const SCOPE_BADGE: Record<PermissionScope, { label: string; className: string }> = {
  ReadOnly:    { label: 'Read Only',    className: 'bg-green-800 text-green-200' },
  MemoryWrite: { label: 'Memory Write', className: 'bg-yellow-800 text-yellow-200' },
  ShellExec:   { label: 'Shell Exec',   className: 'bg-red-800 text-red-200' },
  Network:     { label: 'Network',      className: 'bg-blue-800 text-blue-200' },
}

const DECISION_BADGE: Record<NonNullable<GrantDecision>, { label: string; className: string }> = {
  deny:    { label: 'DENIED',          className: 'bg-red-900 text-red-200' },
  once:    { label: 'ALLOWED-ONCE',    className: 'bg-zinc-700 text-zinc-200' },
  session: { label: 'ALLOWED-SESSION', className: 'bg-blue-900 text-blue-200' },
  always:  { label: 'ALLOWED-ALWAYS',  className: 'bg-green-900 text-green-200' },
}

function relativeTime(startedAt: number): string {
  const diffMs = Date.now() - startedAt
  if (diffMs < 1000) return 'just now'
  if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)}s ago`
  return `${Math.floor(diffMs / 60_000)}m ago`
}

function EntryRow({ entry }: { entry: ToolLogEntry }) {
  const [argsExpanded, setArgsExpanded] = useState(false)
  const [resultExpanded, setResultExpanded] = useState(false)

  const scopeBadge = SCOPE_BADGE[entry.scope]
  const decisionBadge = entry.decision ? DECISION_BADGE[entry.decision] : null

  return (
    <li className="border border-zinc-700 rounded-md p-3 text-sm space-y-1.5">
      {/* Top row: timestamp, tool name, scope badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-zinc-500 text-xs tabular-nums">{relativeTime(entry.startedAt)}</span>
        <span className="font-mono text-zinc-200 font-medium">{entry.toolName}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${scopeBadge.className}`}
          aria-label={`Scope: ${scopeBadge.label}`}
        >
          {scopeBadge.label}
        </span>
        {entry.status === 'pending' && (
          <span className="text-xs text-zinc-400 animate-pulse">pending…</span>
        )}
        {decisionBadge && (
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${decisionBadge.className}`}
            aria-label={`Decision: ${decisionBadge.label}`}
          >
            {decisionBadge.label}
          </span>
        )}
        {entry.durationMs !== null && (
          <span className="ml-auto text-xs text-zinc-500">{entry.durationMs}ms</span>
        )}
      </div>

      {/* Args (collapsed JSON) */}
      {Object.keys(entry.args).length > 0 && (
        <div>
          <button
            onClick={() => setArgsExpanded(v => !v)}
            className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500"
            aria-expanded={argsExpanded}
          >
            {argsExpanded ? 'Hide args' : 'Show args'}
          </button>
          {argsExpanded && (
            <pre className="mt-1 rounded bg-zinc-800 p-2 text-xs text-zinc-300 overflow-auto max-h-24">
              {JSON.stringify(entry.args, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Result preview */}
      {entry.result !== null && (
        <div>
          <button
            onClick={() => setResultExpanded(v => !v)}
            className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500"
            aria-expanded={resultExpanded}
          >
            {resultExpanded ? 'Hide result' : 'Show result'}
          </button>
          {resultExpanded && (
            <pre className="mt-1 rounded bg-zinc-800 p-2 text-xs text-zinc-300 overflow-auto max-h-24">
              {entry.result}
            </pre>
          )}
        </div>
      )}

      {/* Error message */}
      {entry.error !== null && (
        <p className="text-xs text-red-400" role="alert">{entry.error}</p>
      )}
    </li>
  )
}

export function PermissionConsole({ entries }: Props) {
  const sorted = [...entries].sort((a, b) => b.startedAt - a.startedAt)

  return (
    <section
      aria-label="Tool call log"
      className="flex flex-col h-full border-t border-zinc-800 bg-zinc-950"
    >
      <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
          Tool Calls
        </span>
        {entries.length > 0 && (
          <span className="text-xs text-zinc-500">{entries.length} call{entries.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
          No tool calls yet
        </div>
      ) : (
        <ul
          role="list"
          aria-label="Tool call entries"
          className="flex-1 overflow-y-auto px-3 py-2 space-y-2"
        >
          {sorted.map(entry => (
            <EntryRow key={entry.callId} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  )
}
