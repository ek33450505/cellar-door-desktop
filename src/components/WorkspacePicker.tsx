import { open } from '@tauri-apps/plugin-dialog'
import { FolderOpen } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'

/**
 * WorkspacePicker — folder picker button for the chat header.
 *
 * Calls tauri-plugin-dialog `open({ directory: true })` and persists
 * the selected path to the active chat via `setWorkspacePath`.
 * Displays the folder basename when a workspace is pinned.
 */
export function WorkspacePicker() {
  const activeChatId = useChatStore(s => s.activeChatId)
  const setWorkspacePath = useChatStore(s => s.setWorkspacePath)
  const workspacePath = useChatStore(s =>
    s.chats.find(c => c.id === s.activeChatId)?.workspacePath ?? null,
  )

  const basename = workspacePath ? workspacePath.split('/').pop() ?? workspacePath : null

  async function handlePick() {
    const selected = await open({
      directory: true,
      defaultPath: '~/Projects',
      title: 'Pin workspace folder',
    })
    if (selected && activeChatId) {
      setWorkspacePath(activeChatId, selected as string)
    }
  }

  return (
    <button
      onClick={handlePick}
      aria-label={workspacePath ? `Workspace: ${workspacePath}` : 'Pin workspace folder'}
      title={workspacePath ?? 'No workspace pinned'}
      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-500"
    >
      <FolderOpen size={14} aria-hidden="true" />
      {basename
        ? <span className="max-w-[120px] truncate">{basename}</span>
        : <span>No workspace</span>
      }
    </button>
  )
}
