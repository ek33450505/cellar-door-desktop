import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { listToolInvocations } from '@/lib/tauri'
import type { ToolInvocationRow } from '@/lib/tauri'

const PAGE_SIZE = 50

// Scope badge colors match PermissionConsole (Architectural Decision 3)
const SCOPE_BADGE: Record<string, { label: string; className: string }> = {
  ReadOnly:    { label: 'Read Only',    className: 'bg-green-800 text-green-200' },
  MemoryWrite: { label: 'Memory Write', className: 'bg-yellow-800 text-yellow-200' },
  ShellExec:   { label: 'Shell Exec',   className: 'bg-red-800 text-red-200' },
  Network:     { label: 'Network',      className: 'bg-blue-800 text-blue-200' },
}

const DECISION_BADGE: Record<string, string> = {
  allow:   'bg-green-800 text-green-100',
  once:    'bg-green-800 text-green-100',
  session: 'bg-blue-800 text-blue-100',
  always:  'bg-blue-800 text-blue-100',
  deny:    'bg-red-800 text-red-100',
  timeout: 'bg-zinc-700 text-zinc-300',
}

const PREVIEW_MAX = 60

function truncate(str: string): string {
  return str.length > PREVIEW_MAX ? str.slice(0, PREVIEW_MAX) + '…' : str
}

function formatTimestamp(epochSecs: number): string {
  return new Date(epochSecs * 1000).toLocaleString()
}

export default function ToolLogPage() {
  const [rows, setRows] = useState<ToolInvocationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch page_size + 1 more rows so we know if there's a next page
      const fetched = await listToolInvocations(undefined, (page + 1) * PAGE_SIZE + 1)
      setRows(fetched)
    } catch (err) {
      toast.error(String(err))
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  // Slice current page from fetched rows
  const pageStart = page * PAGE_SIZE
  const pageEnd = pageStart + PAGE_SIZE
  const pageRows = rows.slice(pageStart, pageEnd)
  const hasNext = rows.length > pageEnd
  const hasPrev = page > 0

  function handlePrev() {
    setPage(p => Math.max(0, p - 1))
  }

  function handleNext() {
    if (hasNext) setPage(p => p + 1)
  }

  function handleRefresh() {
    fetchRows()
  }

  const scopeBadge = (scope: string) =>
    SCOPE_BADGE[scope] ?? { label: scope, className: 'bg-zinc-700 text-zinc-300' }

  const decisionClass = (decision: string) =>
    DECISION_BADGE[decision.toLowerCase()] ?? 'bg-zinc-700 text-zinc-300'

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-200">Tool Invocation Log</h1>
        <button
          onClick={handleRefresh}
          aria-label="Refresh tool log"
          disabled={loading}
          className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table aria-label="Tool invocation log" className="w-full border-collapse">
          <thead className="sticky top-0 bg-zinc-900">
            <tr>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Timestamp</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Tool Name</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Scope</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Decision</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Duration</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Result / Error</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500">
                  No tool invocations recorded yet.
                </td>
              </tr>
            ) : (
              pageRows.map(row => {
                const badge = scopeBadge(row.scope)
                const preview = row.error
                  ? truncate(row.error)
                  : row.result
                  ? truncate(row.result)
                  : '—'
                return (
                  <tr key={row.id} className="border-b border-zinc-800 hover:bg-zinc-800">
                    <td className="px-4 py-2 text-xs text-zinc-400 whitespace-nowrap">
                      {formatTimestamp(row.invokedAt)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-zinc-200">
                      {row.toolName}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        aria-label={`Scope: ${badge.label}`}
                        className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${decisionClass(row.decision)}`}>
                        {row.decision}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-400 whitespace-nowrap">
                      {row.durationMs != null ? `${row.durationMs}ms` : '—'}
                    </td>
                    <td
                      className="px-4 py-2 text-xs text-zinc-400 max-w-xs truncate"
                      title={row.error ?? row.result ?? undefined}
                    >
                      {row.error ? (
                        <span className="text-red-400">{preview}</span>
                      ) : (
                        preview
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-2">
        <span className="text-xs text-zinc-500" aria-live="polite">
          Page {page + 1}
        </span>
        <div className="flex gap-2">
          <button
            onClick={handlePrev}
            disabled={!hasPrev}
            aria-label="Previous page"
            className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <button
            onClick={handleNext}
            disabled={!hasNext}
            aria-label="Next page"
            className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
