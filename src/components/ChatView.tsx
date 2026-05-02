import { useRef, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Send } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { sendChat } from '@/lib/ollama'
import { OllamaStatusBanner } from './OllamaStatusBanner'
import { ModelSelector } from './ModelSelector'
import { AgentModeToggle } from './AgentModeToggle'
import { PermissionConsole } from './PermissionConsole'
import type { ToolLogEntry } from './PermissionConsole'
import { useToolEvents } from '@/hooks/useToolEvents'

export default function ChatView() {
  const messages = useChatStore(s => s.messages)
  const isStreaming = useChatStore(s => s.isStreaming)
  const ollamaStatus = useChatStore(s => s.ollamaStatus)
  const model = useChatStore(s => s.model)
  const agentMode = useChatStore(s => s.agentMode)
  const agentSessionId = useChatStore(s => s.agentSessionId)
  const addUserMessage = useChatStore(s => s.addUserMessage)

  const [input, setInput] = useState('')
  const [toolEntries, setToolEntries] = useState<ToolLogEntry[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useToolEvents(updater => setToolEntries(updater))
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (!prefersReducedMotion) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    } else {
      bottomRef.current?.scrollIntoView()
    }
  }, [messages, prefersReducedMotion])

  const isDisabled = isStreaming || ollamaStatus !== 'ready'

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isDisabled) return
    setInput('')
    addUserMessage(text)
    const currentMessages = [
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: text },
    ]
    try {
      if (agentMode) {
        await invoke('start_agent_turn', {
          model,
          messages: currentMessages,
          topK: 5,
          sessionId: agentSessionId,
        })
      } else {
        // 7b path — unchanged
        await sendChat(model, currentMessages)
      }
    } catch {
      // errors surface via ollama-failed event — no inline triage
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
        <span className="text-sm font-semibold text-zinc-300">Chat</span>
        <ModelSelector />
      </div>

      {/* Agent mode toggle */}
      <AgentModeToggle />

      {/* Status banner */}
      <OllamaStatusBanner />

      {/* Message thread */}
      <ul
        role="list"
        aria-label="Chat messages"
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.map((msg, i) => (
          <li
            key={i}
            role="listitem"
            className={[
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start',
            ].join(' ')}
          >
            <div
              className={[
                'max-w-[70%] rounded-lg px-4 py-2 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-blue-700 text-white'
                  : 'bg-zinc-800 text-zinc-200',
                msg.pending ? 'opacity-70' : '',
              ].join(' ')}
            >
              {msg.content}
              {msg.pending && (
                <span className="ml-1 animate-pulse" aria-hidden="true">
                  ▊
                </span>
              )}
            </div>
          </li>
        ))}
        <div ref={bottomRef} />
      </ul>

      {/* Permission console — visible in agent mode */}
      {agentMode && (
        <div className="h-48 shrink-0">
          <PermissionConsole entries={toolEntries} />
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-end gap-2 px-4 py-3 border-t border-zinc-800 bg-zinc-900">
        <textarea
          aria-label="Chat message"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          rows={1}
          placeholder={
            ollamaStatus !== 'ready'
              ? 'Ollama not ready…'
              : 'Type a message… (Enter to send)'
          }
          className={[
            'flex-1 resize-none rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200',
            'placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
            isDisabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        />
        <button
          aria-label="Send message"
          onClick={handleSend}
          disabled={isDisabled || !input.trim()}
          className={[
            'flex items-center justify-center rounded px-3 py-2 transition-colors',
            'bg-blue-700 hover:bg-blue-600 text-white',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          ].join(' ')}
        >
          <Send size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
