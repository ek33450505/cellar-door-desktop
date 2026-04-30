import { useEffect } from 'react'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export function useDbWatcher(onChange: () => void) {
  useEffect(() => {
    let unlisten: UnlistenFn | null = null
    listen('db-changed', () => onChange()).then(fn => { unlisten = fn })
    return () => { if (unlisten) unlisten() }
  }, [onChange])
}
