import { useCallback, useMemo, useRef } from 'react'
import * as Slider from '@radix-ui/react-slider'
import { useMemoryStore } from '@/store/memoryStore'
import { MemoryTableRow } from './FactTable'
import type { MemoryRow } from '@/lib/tauri'

// ---------------------------------------------------------------------------
// Debounce utility (no lodash dependency)
// ---------------------------------------------------------------------------
function useDebounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  return useCallback(
    (...args: Parameters<T>) => {
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = setTimeout(() => fnRef.current(...args), delay)
    },
    [delay]
  )
}

// ---------------------------------------------------------------------------
// TemporalSlider
// ---------------------------------------------------------------------------
export default function TemporalSlider() {
  const memories = useMemoryStore((s) => s.memories)
  const temporalTs = useMemoryStore((s) => s.temporalTs)
  const loading = useMemoryStore((s) => s.loading)
  const setTemporalTs = useMemoryStore((s) => s.setTemporalTs)
  const fetchAt = useMemoryStore((s) => s.fetchAt)

  // Epoch bounds from validFrom values in loaded memories.
  // Filter NaN epochs first — rows with validFrom='' produce NaN via new Date('').getTime().
  // Returns null when no valid epochs exist so the caller can show the empty state.
  const epochBounds = useMemo(() => {
    if (memories.length === 0) return null
    const epochs = memories
      .map((m) => new Date(m.validFrom).getTime())
      .filter((ms) => !isNaN(ms))
    if (epochs.length === 0) return null
    const minMs = Math.min(...epochs)
    const maxMs = Math.max(...epochs)
    // Single unique timestamp — slider needs a non-zero range to function correctly.
    if (minMs === maxMs) return null
    return { minMs, maxMs }
  }, [memories])

  // Current slider value — default to maxMs (most recent)
  const currentMs = temporalTs
    ? new Date(temporalTs).getTime()
    : (epochBounds?.maxMs ?? 0)

  // Debounced handler: updates store then fetches
  const debouncedFetch = useDebounce(
    useCallback(
      (isoTs: string) => {
        setTemporalTs(isoTs)
        fetchAt()
      },
      [setTemporalTs, fetchAt]
    ),
    200
  )

  function handleValueChange([value]: number[]) {
    const iso = new Date(value).toISOString()
    debouncedFetch(iso)
  }

  // No memories loaded, or all validFrom values are invalid — instruct user to load first
  if (!epochBounds) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <p className="text-sm text-zinc-500">
          No memories loaded — switch to Fact Table first to populate the time range.
        </p>
      </div>
    )
  }

  const { minMs, maxMs } = epochBounds
  const selectedDate = new Date(currentMs).toLocaleString()

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Slider */}
      <div className="flex flex-col gap-3">
        <label
          htmlFor="temporal-slider"
          className="text-sm font-medium text-zinc-300"
        >
          Time travel to date
        </label>
        <Slider.Root
          id="temporal-slider"
          aria-label="Time travel to date"
          min={minMs}
          max={maxMs}
          step={1}
          value={[currentMs]}
          onValueChange={handleValueChange}
          className="relative flex w-full touch-none select-none items-center"
        >
          <Slider.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-zinc-700">
            <Slider.Range className="absolute h-full bg-blue-500" />
          </Slider.Track>
          <Slider.Thumb
            className="block h-4 w-4 rounded-full border-2 border-blue-500 bg-zinc-950 shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            aria-label="Time travel to date"
          />
        </Slider.Root>

        {/* Date label */}
        <p className="text-sm text-zinc-400">
          {selectedDate}
        </p>
      </div>

      {/* Fact count */}
      <p className="text-xs text-zinc-500" aria-live="polite">
        {loading ? 'Loading…' : `${memories.length} facts at this point`}
      </p>

      {/* Results table */}
      <div className="flex-1 overflow-auto rounded border border-zinc-800">
        <table aria-label="Facts at selected time" className="w-full border-collapse">
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
            {memories.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500">
                  No facts at this point in time.
                </td>
              </tr>
            ) : (
              memories.map((row: MemoryRow) => (
                <MemoryTableRow key={row.id} row={row} onClick={() => {}} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
