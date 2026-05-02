import { useCallback } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { Toaster } from 'sonner'
import { useMemoryStore } from '@/store/memoryStore'
import { useDbWatcher } from '@/hooks/useDbWatcher'
import { useOllamaEvents } from '@/hooks/useOllamaEvents'
import { Sidebar } from '@/components/Sidebar'
import { CommandPalette } from '@/components/CommandPalette'
import FactTable from '@/components/FactTable'
import FtsSearch from '@/components/FtsSearch'
import TemporalSlider from '@/components/TemporalSlider'
import InjectionLog from '@/components/InjectionLog'
import SupersessionChain from '@/components/SupersessionChain'
import ChatView from '@/components/ChatView'

function App() {
  const activeView = useMemoryStore(s => s.activeView)
  const refresh = useMemoryStore(s => s.refresh)

  const stableRefresh = useCallback(() => { refresh() }, [refresh])
  useDbWatcher(stableRefresh)
  useOllamaEvents()

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-200">
      <Group orientation="horizontal" className="h-full w-full">
        <Panel defaultSize={18} minSize={14} maxSize={28}>
          <Sidebar />
        </Panel>
        <Separator className="w-px bg-zinc-800 hover:bg-zinc-600 transition-colors cursor-col-resize" />
        <Panel>
          <main className="h-full overflow-auto p-4">
            {activeView === 'table' && <FactTable />}
            {activeView === 'fts' && <FtsSearch />}
            {activeView === 'temporal' && <TemporalSlider />}
            {activeView === 'injections' && <InjectionLog />}
            {activeView === 'chat' && <ChatView />}
          </main>
        </Panel>
      </Group>

      {/* SupersessionChain is a Dialog — rendered globally regardless of activeView */}
      <SupersessionChain />

      <CommandPalette />
      <Toaster richColors position="bottom-right" />
    </div>
  )
}

export default App
