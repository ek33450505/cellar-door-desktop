import { Database, Clock, Search, Activity, MessageSquare } from 'lucide-react'
import { useMemoryStore } from '@/store/memoryStore'
import type { ActiveView } from '@/store/memoryStore'

interface NavItem {
  view: ActiveView
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { view: 'table', label: 'Fact Table', icon: <Database size={18} aria-hidden="true" /> },
  { view: 'temporal', label: 'Time Travel', icon: <Clock size={18} aria-hidden="true" /> },
  { view: 'fts', label: 'FTS Search', icon: <Search size={18} aria-hidden="true" /> },
  { view: 'injections', label: 'Injections', icon: <Activity size={18} aria-hidden="true" /> },
  { view: 'chat', label: 'Chat', icon: <MessageSquare size={18} aria-hidden="true" /> },
]

export function Sidebar() {
  const activeView = useMemoryStore(s => s.activeView)
  const setActiveView = useMemoryStore(s => s.setActiveView)

  return (
    <nav
      aria-label="Main navigation"
      className="flex flex-col gap-1 p-2 bg-zinc-900 h-full min-w-[160px]"
    >
      <div className="px-2 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-500 select-none">
        Cellar Door
      </div>
      {NAV_ITEMS.map(({ view, label, icon }) => {
        const isActive = activeView === view
        return (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'flex items-center gap-2.5 w-full px-3 py-2 rounded text-sm text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500',
              isActive
                ? 'border-l-2 border-zinc-400 bg-zinc-800 text-zinc-100 pl-[10px]'
                : 'border-l-2 border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 pl-[10px]',
            ].join(' ')}
          >
            {icon}
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
