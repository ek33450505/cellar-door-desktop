import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useMemoryStore } from '@/store/memoryStore'
import { MemoryTableRow } from './FactTable'
import type { MemoryRow } from '@/lib/tauri'

const DEBOUNCE_MS = 300

export default function FtsSearch() {
  const ftsQuery = useMemoryStore((s) => s.ftsQuery)
  const memories = useMemoryStore((s) => s.memories)
  const loading = useMemoryStore((s) => s.loading)
  const error = useMemoryStore((s) => s.error)
  const setFtsQuery = useMemoryStore((s) => s.setFtsQuery)
  const setActiveView = useMemoryStore((s) => s.setActiveView)
  const setChain = useMemoryStore((s) => s.setChain)
  const fetchFts = useMemoryStore((s) => s.fetchFts)
  const fetchChain = useMemoryStore((s) => s.fetchChain)
  const clearError = useMemoryStore((s) => s.clearError)

  // Show toast on error then clear it
  useEffect(() => {
    if (error) {
      toast.error(error)
      clearError()
    }
  }, [error, clearError])

  // Debounce the FTS fetch
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (ftsQuery.trim() === '') {
      // Empty query — let the memories list go stale (simplest behavior per spec)
      return
    }

    debounceRef.current = setTimeout(() => {
      fetchFts()
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [ftsQuery, fetchFts])

  function handleRowClick(row: MemoryRow) {
    setActiveView('chain')
    setChain(row.name, row.agent)
    fetchChain()
  }

  return (
    <div className="flex h-full flex-col">
      {/* Search input */}
      <div className="border-b border-zinc-800 p-3">
        <input
          type="search"
          aria-label="Full-text memory search"
          placeholder="Search memories..."
          value={ftsQuery}
          onChange={(e) => setFtsQuery(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        />
        {ftsQuery.trim() !== '' && (
          <p className="mt-1 text-xs text-zinc-500" aria-live="polite">
            {loading ? 'Searching…' : `${memories.length} result${memories.length !== 1 ? 's' : ''} for '${ftsQuery}'`}
          </p>
        )}
      </div>

      {/* Results table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-zinc-900">
            <tr>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Agent</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Name</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Type</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Source</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Valid From</th>
              <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">Superseded?</th>
            </tr>
          </thead>
          <tbody>
            {ftsQuery.trim() === '' ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500">
                  Enter a query to search memories.
                </td>
              </tr>
            ) : memories.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500">
                  No results.
                </td>
              </tr>
            ) : (
              memories.map((row) => (
                <MemoryTableRow key={row.id} row={row} onClick={handleRowClick} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
