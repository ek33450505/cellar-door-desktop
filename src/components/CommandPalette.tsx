import { useEffect, useState, useCallback } from 'react'
import { Command } from 'cmdk'
import * as Dialog from '@radix-ui/react-dialog'
import { useMemoryStore } from '@/store/memoryStore'
import type { ActiveView } from '@/store/memoryStore'

interface PaletteItem {
  id: string
  label: string
  onSelect: () => void
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const setActiveView = useMemoryStore(s => s.setActiveView)
  const refresh = useMemoryStore(s => s.refresh)

  const close = useCallback(() => setOpen(false), [])

  const navigate = useCallback((view: ActiveView) => {
    setActiveView(view)
    close()
  }, [setActiveView, close])

  const triggerRefresh = useCallback(() => {
    refresh()
    close()
  }, [refresh, close])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const items: PaletteItem[] = [
    { id: 'table', label: 'Go to Fact Table', onSelect: () => navigate('table') },
    { id: 'fts', label: 'Go to FTS Search', onSelect: () => navigate('fts') },
    { id: 'temporal', label: 'Go to Time Travel', onSelect: () => navigate('temporal') },
    { id: 'injections', label: 'Go to Injections', onSelect: () => navigate('injections') },
    { id: 'refresh', label: 'Refresh data', onSelect: triggerRefresh },
  ]

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content
          aria-label="Command palette"
          className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg"
        >
          <Command
            className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden"
          >
            <Command.Input
              placeholder="Type a command..."
              className="w-full px-4 py-3 bg-transparent text-zinc-100 placeholder:text-zinc-500 outline-none border-b border-zinc-700 text-sm"
            />
            <Command.List className="max-h-64 overflow-y-auto p-2">
              <Command.Empty className="py-6 text-center text-sm text-zinc-500">
                No results found.
              </Command.Empty>
              {items.map(item => (
                <Command.Item
                  key={item.id}
                  onSelect={item.onSelect}
                  className="flex items-center px-3 py-2 rounded text-sm text-zinc-200 cursor-pointer
                    data-[selected=true]:bg-zinc-700 data-[selected=true]:text-zinc-100
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                >
                  {item.label}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
