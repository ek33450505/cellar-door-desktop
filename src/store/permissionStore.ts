import { create } from 'zustand'

export type PermissionScope = 'ReadOnly' | 'MemoryWrite' | 'ShellExec' | 'Network'

export type GrantDecision = 'deny' | 'once' | 'session' | 'always'

export interface PendingApproval {
  toolName: string
  toolDescription: string
  scope: PermissionScope
  args: Record<string, unknown>
  callId: string // correlates to tool_invocations row
  resolve: (grant: GrantDecision) => void
}

export interface PermissionStore {
  sessionGrants: Record<string, 'once' | 'session' | 'always'>
  pendingApproval: PendingApproval | null
  requestApproval: (pending: PendingApproval) => void
  resolveApproval: (callId: string, decision: GrantDecision) => void
}

export const usePermissionStore = create<PermissionStore>((set, get) => ({
  sessionGrants: {},
  pendingApproval: null,

  requestApproval: (pending) => set({ pendingApproval: pending }),

  resolveApproval: (callId, decision) => {
    const { pendingApproval } = get()
    if (!pendingApproval || pendingApproval.callId !== callId) return

    pendingApproval.resolve(decision)

    if (decision === 'session' || decision === 'always') {
      set((state) => ({
        sessionGrants: { ...state.sessionGrants, [pendingApproval.toolName]: decision },
        pendingApproval: null,
      }))
    } else {
      set({ pendingApproval: null })
    }
  },
}))
