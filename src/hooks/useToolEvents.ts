import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import { usePermissionStore } from '@/store/permissionStore'
import type { PermissionScope, GrantDecision } from '@/store/permissionStore'
import type { ToolLogEntry } from '@/components/PermissionConsole'

// Payload shapes emitted by the Rust backend
interface ToolPendingPayload {
  callId: string
  toolName: string
  toolDescription: string
  scope: PermissionScope
  args: Record<string, unknown>
}

interface ToolResultPayload {
  callId: string
  result: string
  durationMs: number
}

interface ToolErrorPayload {
  callId: string
  error: string
  durationMs: number
}

interface ToolTimeoutPayload {
  callId: string
}

type OnEntryUpdate = (updater: (entries: ToolLogEntry[]) => ToolLogEntry[]) => void

/**
 * Listens for tool-call lifecycle events from the Rust backend.
 *
 * @param onEntryUpdate - callback to update the PermissionConsole entry list
 */
export function useToolEvents(onEntryUpdate: OnEntryUpdate) {
  const requestApproval = usePermissionStore(s => s.requestApproval)
  // Keep latest callback ref to avoid stale closures in listener
  const onEntryUpdateRef = useRef(onEntryUpdate)
  onEntryUpdateRef.current = onEntryUpdate

  useEffect(() => {
    const unlistenPending = listen<ToolPendingPayload>('chat-tool-pending', e => {
      const { callId, toolName, toolDescription, scope, args } = e.payload

      // Add pending entry to the console log
      const entry: ToolLogEntry = {
        callId,
        toolName,
        scope,
        args,
        decision: null,
        result: null,
        error: null,
        durationMs: null,
        startedAt: Date.now(),
        status: 'pending',
      }
      onEntryUpdateRef.current(prev => [entry, ...prev])

      // Trigger the approval modal; resolve calls the backend
      requestApproval({
        toolName,
        toolDescription,
        scope,
        args,
        callId,
        resolve: async (decision: GrantDecision) => {
          await invoke('resolve_tool_decision', { callId, decision })
          // Update entry with decision
          onEntryUpdateRef.current(prev =>
            prev.map(en =>
              en.callId === callId
                ? { ...en, decision, status: 'resolved' as const }
                : en,
            ),
          )
        },
      })
    })

    const unlistenResult = listen<ToolResultPayload>('chat-tool-result', e => {
      const { callId, result, durationMs } = e.payload
      onEntryUpdateRef.current(prev =>
        prev.map(en =>
          en.callId === callId
            ? { ...en, result, durationMs, status: 'resolved' as const }
            : en,
        ),
      )
    })

    const unlistenError = listen<ToolErrorPayload>('chat-tool-error', e => {
      const { callId, error, durationMs } = e.payload
      onEntryUpdateRef.current(prev =>
        prev.map(en =>
          en.callId === callId
            ? { ...en, error, durationMs, status: 'error' as const }
            : en,
        ),
      )
    })

    const unlistenTimeout = listen<ToolTimeoutPayload>('chat-tool-timeout', () => {
      toast.error('Tool call timed out — agent paused')
    })

    return () => {
      unlistenPending.then(f => f())
      unlistenResult.then(f => f())
      unlistenError.then(f => f())
      unlistenTimeout.then(f => f())
    }
  // requestApproval is a stable store selector — intentionally empty dep array
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
