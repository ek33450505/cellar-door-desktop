import { useCallback } from 'react'
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
import ToolLogPage from '@/pages/ToolLogPage'
import { PermissionModal } from '@/components/PermissionModal'

function App() {
  const activeView = useMemoryStore(s => s.activeView)
  const refresh = useMemoryStore(s => s.refresh)

  const stableRefresh = useCallback(() => { refresh() }, [refresh])
  useDbWatcher(stableRefresh)
  useOllamaEvents()

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-200">
      <aside className="flex-shrink-0 border-r border-zinc-800 w-[200px]">
        <Sidebar />
      </aside>
      <main className="flex-1 h-full overflow-auto p-4">
        {activeView === 'table' && <FactTable />}
        {activeView === 'fts' && <FtsSearch />}
        {activeView === 'temporal' && <TemporalSlider />}
        {activeView === 'injections' && <InjectionLog />}
        {activeView === 'chat' && <ChatView />}
        {activeView === 'tool-log' && <ToolLogPage />}
      </main>
      <SupersessionChain />
      <PermissionModal />
      <CommandPalette />
      <Toaster richColors position="bottom-right" />
    </div>
  )
}

export default App
