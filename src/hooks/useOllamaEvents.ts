import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useChatStore } from '@/store/chatStore'
import type { ChatStore } from '@/store/chatStore'

export function useOllamaEvents() {
  const setOllamaStatus = useChatStore(s => s.setOllamaStatus)
  const appendToken = useChatStore(s => s.appendToken)
  const finalizeAssistant = useChatStore(s => s.finalizeAssistant)

  useEffect(() => {
    const unlistenStatus = listen<{ status: ChatStore['ollamaStatus'] }>(
      'ollama-status',
      e => setOllamaStatus(e.payload.status),
    )
    const unlistenReady = listen('ollama-ready', () =>
      setOllamaStatus('ready'),
    )
    const unlistenFailed = listen('ollama-failed', () =>
      setOllamaStatus('error'),
    )
    const unlistenToken = listen<{ token: string; done: boolean }>(
      'chat-token',
      e => {
        if (e.payload.done) {
          finalizeAssistant()
        } else {
          appendToken(e.payload.token)
        }
      },
    )

    return () => {
      unlistenStatus.then(f => f())
      unlistenReady.then(f => f())
      unlistenFailed.then(f => f())
      unlistenToken.then(f => f())
    }
  // Stable store selectors — intentionally empty dep array
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
