import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useMemoryStore } from '@/store/memoryStore'

const CONTENT_MAX_LEN = 80

function truncate(str: string): string {
  return str.length > CONTENT_MAX_LEN ? str.slice(0, CONTENT_MAX_LEN) + '…' : str
}

export default function InjectionLog() {
  const injections = useMemoryStore((s) => s.injections)
  const loading = useMemoryStore((s) => s.loading)
  const error = useMemoryStore((s) => s.error)
  const fetchInjections = useMemoryStore((s) => s.fetchInjections)
  const clearError = useMemoryStore((s) => s.clearError)

  const [sessionFilter, setSessionFilter] = useState('')

  // Show toast on error then clear it
  useEffect(() => {
    if (error) {
      toast.error(error)
      clearError()
    }
  }, [error, clearError])

  // Fetch all injections on mount
  useEffect(() => {
    fetchInjections()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Filter by session ID (live, client-side)
  const safeInjections = injections ?? []
  const filtered = sessionFilter.trim()
    ? safeInjections.filter((i) => i.sessionId.toLowerCase().includes(sessionFilter.trim().toLowerCase()))
    : safeInjections

  function handleFilterKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      // Re-fetch from server with sessionId filter on Enter
      fetchInjections(sessionFilter.trim() || undefined)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Session ID filter */}
      <div className="flex items-center gap-2 border-b border-zinc-800 p-3">
        <input
          type="text"
          aria-label="Filter by session ID"
          placeholder="Filter by session ID (Enter to fetch)..."
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
          onKeyDown={handleFilterKeyDown}
          className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        />
        {loading && (
          <span className="text-xs text-zinc-500" aria-live="polite">
            Loading…
          </span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table aria-label="Injection log" className="w-full border-collapse">
          <thead className="sticky top-0 bg-zinc-900">
            <tr>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Session ID</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Agent</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Injected At</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Memory Name</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Memory Content</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && !loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500">
                  No injection records found.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="border-b border-zinc-800 hover:bg-zinc-800">
                  <td className="px-4 py-2 font-mono text-xs text-zinc-300">{row.sessionId}</td>
                  <td className="px-4 py-2 text-sm text-zinc-300">{row.agent}</td>
                  <td className="px-4 py-2 text-sm text-zinc-400">{row.injectedAt}</td>
                  <td className="px-4 py-2 text-sm text-zinc-300">{row.memoryName}</td>
                  <td
                    className="px-4 py-2 text-sm text-zinc-400"
                    title={row.memoryContent}
                  >
                    {truncate(row.memoryContent)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
