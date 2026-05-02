import { useChatStore } from '@/store/chatStore'
import { spawnOllama } from '@/lib/ollama'

export function OllamaStatusBanner() {
  const ollamaStatus = useChatStore(s => s.ollamaStatus)
  const setOllamaStatus = useChatStore(s => s.setOllamaStatus)

  if (ollamaStatus === 'ready' || ollamaStatus === 'unknown') return null

  const handleRetry = async () => {
    try {
      setOllamaStatus('unknown')
      await spawnOllama()
    } catch {
      setOllamaStatus('error')
    }
  }

  return (
    <div
      role="alert"
      className="flex items-center justify-between px-4 py-2 bg-red-950 border-b border-red-800 text-red-300 text-sm"
    >
      <span>
        {ollamaStatus === 'dead'
          ? 'Ollama is not running.'
          : 'Ollama encountered an error.'}
      </span>
      <button
        onClick={handleRetry}
        className="ml-4 rounded px-3 py-1 text-xs font-medium bg-red-800 hover:bg-red-700 text-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 transition-colors"
      >
        Retry
      </button>
    </div>
  )
}
