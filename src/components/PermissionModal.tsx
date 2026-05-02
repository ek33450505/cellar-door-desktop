import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { usePermissionStore } from '@/store/permissionStore'
import type { GrantDecision, PermissionScope } from '@/store/permissionStore'

const SCOPE_BADGE: Record<PermissionScope, { label: string; className: string }> = {
  ReadOnly:    { label: 'Read Only',    className: 'bg-green-700 text-green-100' },
  MemoryWrite: { label: 'Memory Write', className: 'bg-yellow-700 text-yellow-100' },
  ShellExec:   { label: 'Shell Exec',   className: 'bg-red-700 text-red-100' },
  Network:     { label: 'Network',      className: 'bg-blue-700 text-blue-100' },
}

export function PermissionModal() {
  const pendingApproval = usePermissionStore(s => s.pendingApproval)
  const resolveApproval = usePermissionStore(s => s.resolveApproval)

  const isOpen = pendingApproval !== null

  function handleDecision(decision: GrantDecision) {
    if (!pendingApproval) return
    resolveApproval(pendingApproval.callId, decision)
  }

  const badge = pendingApproval ? SCOPE_BADGE[pendingApproval.scope] : null

  return (
    <AlertDialog.Root open={isOpen}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <AlertDialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-zinc-900 p-6 shadow-xl focus:outline-none"
          aria-describedby="permission-description"
        >
          <AlertDialog.Title className="text-lg font-semibold text-white mb-1">
            Permission Request
          </AlertDialog.Title>

          {pendingApproval && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-sm text-zinc-200">{pendingApproval.toolName}</span>
                {badge && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${badge.className}`}
                    aria-label={`Scope: ${badge.label}`}
                  >
                    {badge.label}
                  </span>
                )}
              </div>

              <AlertDialog.Description id="permission-description" className="text-sm text-zinc-400 mb-3">
                {pendingApproval.toolDescription}
              </AlertDialog.Description>

              {Object.keys(pendingApproval.args).length > 0 && (
                <pre className="mb-4 rounded bg-zinc-800 p-3 text-xs text-zinc-300 overflow-auto max-h-32">
                  {JSON.stringify(pendingApproval.args, null, 2)}
                </pre>
              )}

              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  onClick={() => handleDecision('deny')}
                  className="rounded px-3 py-1.5 text-sm font-medium bg-zinc-700 text-zinc-200 hover:bg-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                >
                  Deny
                </button>
                <button
                  onClick={() => handleDecision('once')}
                  className="rounded px-3 py-1.5 text-sm font-medium bg-zinc-700 text-zinc-200 hover:bg-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
                >
                  Allow once
                </button>
                <button
                  onClick={() => handleDecision('session')}
                  className="rounded px-3 py-1.5 text-sm font-medium bg-blue-700 text-white hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
                >
                  Allow session
                </button>
                {pendingApproval.scope === 'ReadOnly' && (
                  <button
                    onClick={() => handleDecision('always')}
                    className="rounded px-3 py-1.5 text-sm font-medium bg-green-700 text-white hover:bg-green-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-400"
                  >
                    Allow always
                  </button>
                )}
              </div>
            </>
          )}
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
