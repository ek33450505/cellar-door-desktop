import { useChatStore } from '@/store/chatStore'

export function AgentModeToggle() {
  const agentMode = useChatStore(s => s.agentMode)
  const setAgentMode = useChatStore(s => s.setAgentMode)

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2 border-b border-zinc-800 bg-zinc-900">
      <div className="flex items-center gap-3">
        <label
          htmlFor="agent-mode-toggle"
          className="text-sm text-zinc-300 select-none cursor-pointer"
        >
          Agent mode
        </label>
        {/* Toggle switch implemented via checkbox */}
        <button
          id="agent-mode-toggle"
          role="switch"
          aria-checked={agentMode}
          onClick={() => setAgentMode(!agentMode)}
          className={[
            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
            'transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
            agentMode ? 'bg-blue-600' : 'bg-zinc-600',
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className={[
              'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm',
              'transition duration-200',
              agentMode ? 'translate-x-4' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </div>

      {agentMode && (
        <p className="text-xs text-yellow-400" role="note">
          Agent mode allows the AI to call tools. You will approve each tool call.
        </p>
      )}
    </div>
  )
}
