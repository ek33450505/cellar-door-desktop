import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useMemoryStore } from '@/store/memoryStore'
import type { MemoryRow } from '@/lib/tauri'

// ---------------------------------------------------------------------------
// Version item
// ---------------------------------------------------------------------------
interface ChainItemProps {
  row: MemoryRow
  isNewest: boolean
}

function ChainItem({ row, isNewest }: ChainItemProps) {
  return (
    <li className="relative pl-6 pb-6 last:pb-0">
      {/* timeline connector */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-1.5 h-full w-px bg-zinc-700 last:hidden"
      />
      {/* dot */}
      <span
        aria-hidden="true"
        className={`absolute left-[-4px] top-1.5 h-2.5 w-2.5 rounded-full border-2 ${
          isNewest ? 'border-green-500 bg-green-900' : 'border-zinc-600 bg-zinc-800'
        }`}
      />

      <div className="rounded border border-zinc-800 bg-zinc-900 p-3 text-sm">
        {/* dates */}
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-zinc-400">
            {row.validFrom}
          </span>
          <span className="text-xs text-zinc-600">→</span>
          <span className="font-mono text-xs text-zinc-400">
            {row.validTo ?? 'current'}
          </span>
          {/* badge */}
          {row.superseded ? (
            <span className="ml-auto inline-block rounded px-2 py-0.5 text-xs font-medium bg-zinc-700 text-zinc-300">
              superseded
            </span>
          ) : (
            <span className="ml-auto inline-block rounded px-2 py-0.5 text-xs font-medium bg-green-900 text-green-300">
              current
            </span>
          )}
        </div>

        {/* content */}
        <p className="whitespace-pre-wrap text-zinc-200">{row.content}</p>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// SupersessionChain dialog
// ---------------------------------------------------------------------------
export default function SupersessionChain() {
  const activeView = useMemoryStore((s) => s.activeView)
  const chainName = useMemoryStore((s) => s.chainName)
  const chainAgent = useMemoryStore((s) => s.chainAgent)
  const memories = useMemoryStore((s) => s.memories)
  const loading = useMemoryStore((s) => s.loading)
  const setActiveView = useMemoryStore((s) => s.setActiveView)
  const setChain = useMemoryStore((s) => s.setChain)

  const isOpen = activeView === 'chain' && chainName !== null

  // Sort newest first (descending validFrom)
  const sorted = [...memories].sort(
    (a, b) => new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime()
  )

  function handleClose() {
    setChain(chainName ?? '', chainAgent ?? '')
    setActiveView('table')
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-700 bg-zinc-950 p-6 shadow-2xl focus:outline-none"
          aria-describedby="chain-description"
        >
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-zinc-100">
                Version history: {chainName} ({chainAgent})
              </Dialog.Title>
              <Dialog.Description id="chain-description" className="mt-0.5 text-xs text-zinc-500">
                {sorted.length} version{sorted.length !== 1 ? 's' : ''}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close version history"
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              <X size={16} aria-hidden="true" />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="max-h-[60vh] overflow-y-auto">
            {sorted.length === 0 && !loading ? (
              <p className="py-6 text-center text-sm text-zinc-500">
                No version history available.
              </p>
            ) : (
              <ol aria-label="Version history" className="pl-4">
                {sorted.map((row, idx) => (
                  <ChainItem key={row.id} row={row} isNewest={idx === 0} />
                ))}
              </ol>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
