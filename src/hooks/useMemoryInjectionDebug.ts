import { useState, useCallback } from 'react'
import { getMemoryContext } from '@/lib/ollama'
import type { MemoryFact } from '@/lib/ollama'

interface UseMemoryInjectionDebugResult {
  facts: MemoryFact[]
  loading: boolean
  error: string | null
  run: (prompt: string) => Promise<void>
}

export function useMemoryInjectionDebug(
  topN = 5,
  agent = 'code-writer',
): UseMemoryInjectionDebugResult {
  const [facts, setFacts] = useState<MemoryFact[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (prompt: string) => {
      setLoading(true)
      setError(null)
      try {
        const result = await getMemoryContext(prompt, topN, agent)
        setFacts(result)
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    },
    [topN, agent],
  )

  return { facts, loading, error, run }
}
