import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
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

    // Query current health state after listeners are registered so we don't
    // miss a slightly-late ollama-ready event but also don't rely on it as
    // the sole source of truth.
    invoke<boolean>('ollama_health')
      .then(healthy => {
        if (healthy) setOllamaStatus('ready')
      })
      .catch(() => {
        // health check failure — leave status at default 'unknown'
        // the polling loop's ollama-failed event will surface real errors
      })

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
