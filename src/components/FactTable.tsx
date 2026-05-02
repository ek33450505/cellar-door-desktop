import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import * as Select from '@radix-ui/react-select'
import { ChevronDown } from 'lucide-react'
import { useMemoryStore } from '@/store/memoryStore'
import type { MemoryRow } from '@/lib/tauri'

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
function SupersededBadge({ superseded }: { superseded: boolean }) {
  return superseded ? (
    <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-zinc-700 text-zinc-300">
      superseded
    </span>
  ) : (
    <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-green-900 text-green-300">
      current
    </span>
  )
}

// ---------------------------------------------------------------------------
// Filter dropdown
// ---------------------------------------------------------------------------
interface FilterSelectProps {
  label: string
  value: string
  options: string[]
  onChange: (val: string) => void
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        aria-label={label}
        className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        <Select.Value placeholder={label} />
        <Select.Icon>
          <ChevronDown size={14} aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="z-50 rounded border border-zinc-700 bg-zinc-900 shadow-lg"
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport className="p-1">
            <Select.Item
              value="__all__"
              className="flex cursor-pointer select-none items-center rounded px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 focus:bg-zinc-800 focus:outline-none"
            >
              <Select.ItemText>All</Select.ItemText>
            </Select.Item>
            {options.filter((opt) => opt !== '').map((opt) => (
              <Select.Item
                key={opt}
                value={opt}
                className="flex cursor-pointer select-none items-center rounded px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 focus:bg-zinc-800 focus:outline-none"
              >
                <Select.ItemText>{opt}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

// ---------------------------------------------------------------------------
// Shared memory table row
// ---------------------------------------------------------------------------
interface MemoryTableRowProps {
  row: MemoryRow
  onClick: (row: MemoryRow) => void
}

export function MemoryTableRow({ row, onClick }: MemoryTableRowProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(row)
    }
  }

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={() => onClick(row)}
      onKeyDown={handleKeyDown}
      className="cursor-pointer border-b border-zinc-800 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-500"
    >
      <td className="px-4 py-2 text-sm text-zinc-300">{row.agent}</td>
      <td className="px-4 py-2 text-sm text-zinc-300">{row.name}</td>
      <td className="px-4 py-2 text-sm text-zinc-300">{row.memoryType}</td>
      <td className="px-4 py-2 text-sm text-zinc-300">{row.sourceType}</td>
      <td className="px-4 py-2 text-sm text-zinc-400">{row.validFrom}</td>
      <td className="px-4 py-2">
        <SupersededBadge superseded={row.superseded} />
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// FactTable
// ---------------------------------------------------------------------------
export default function FactTable() {
  const memories = useMemoryStore((s) => s.memories)
  const filters = useMemoryStore((s) => s.filters)
  const loading = useMemoryStore((s) => s.loading)
  const error = useMemoryStore((s) => s.error)
  const setFilter = useMemoryStore((s) => s.setFilter)
  const setActiveView = useMemoryStore((s) => s.setActiveView)
  const setChain = useMemoryStore((s) => s.setChain)
  const fetchMemories = useMemoryStore((s) => s.fetchMemories)
  const fetchChain = useMemoryStore((s) => s.fetchChain)
  const clearError = useMemoryStore((s) => s.clearError)

  // Show toast on error then clear it
  useEffect(() => {
    if (error) {
      toast.error(error)
      clearError()
    }
  }, [error, clearError])

  // Fetch on mount if empty
  useEffect(() => {
    if (memories.length === 0 && !loading) {
      fetchMemories()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Compute unique filter option values from loaded memories
  const agentOptions = useMemo(
    () => [...new Set(memories.map((m) => m.agent))].sort(),
    [memories]
  )
  const typeOptions = useMemo(
    () => [...new Set(memories.map((m) => m.memoryType))].sort(),
    [memories]
  )
  const sourceOptions = useMemo(
    () => [...new Set(memories.map((m) => m.sourceType))].sort(),
    [memories]
  )

  // Client-side filter (mirrors server-side as a progressive enhancement)
  const filtered = useMemo(
    () =>
      memories.filter((m) => {
        if (filters.agent && m.agent !== filters.agent) return false
        if (filters.memoryType && m.memoryType !== filters.memoryType) return false
        if (filters.sourceType && m.sourceType !== filters.sourceType) return false
        return true
      }),
    [memories, filters]
  )

  function handleRowClick(row: MemoryRow) {
    setActiveView('chain')
    setChain(row.name, row.agent)
    fetchChain()
  }

  return (
    <div className="flex h-full flex-col">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 p-3">
        <FilterSelect
          label="Agent"
          value={filters.agent ?? '__all__'}
          options={agentOptions}
          onChange={(val) => setFilter({ agent: val === '__all__' ? undefined : val })}
        />
        <FilterSelect
          label="Memory Type"
          value={filters.memoryType ?? '__all__'}
          options={typeOptions}
          onChange={(val) => setFilter({ memoryType: val === '__all__' ? undefined : val })}
        />
        <FilterSelect
          label="Source Type"
          value={filters.sourceType ?? '__all__'}
          options={sourceOptions}
          onChange={(val) => setFilter({ sourceType: val === '__all__' ? undefined : val })}
        />
        {loading && (
          <span className="self-center text-xs text-zinc-500" aria-live="polite">
            Loading…
          </span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table aria-label="Memory facts table" className="w-full border-collapse">
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
            {filtered.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500">
                  No memories found.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <MemoryTableRow key={row.id} row={row} onClick={handleRowClick} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
