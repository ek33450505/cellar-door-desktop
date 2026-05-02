import { useEffect } from 'react'
import * as Select from '@radix-ui/react-select'
import { ChevronDown } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { listModels } from '@/lib/ollama'

export function ModelSelector() {
  const model = useChatStore(s => s.model)
  const availableModels = useChatStore(s => s.availableModels)
  const setModel = useChatStore(s => s.setModel)
  const setAvailableModels = useChatStore(s => s.setAvailableModels)

  useEffect(() => {
    listModels()
      .then(setAvailableModels)
      .catch(() => {
        // Ollama may not be running yet — silently ignore
      })
  }, [setAvailableModels])

  const models = availableModels.length > 0 ? availableModels : [model]

  return (
    <Select.Root value={model} onValueChange={setModel}>
      <Select.Trigger
        aria-label="Select model"
        className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 transition-colors"
      >
        <Select.Value />
        <Select.Icon>
          <ChevronDown size={14} aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="z-50 rounded border border-zinc-700 bg-zinc-900 shadow-lg"
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport className="p-1">
            {models.map((m) => (
              <Select.Item
                key={m}
                value={m}
                className="flex cursor-pointer select-none items-center rounded px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 focus:bg-zinc-800 focus:outline-none"
              >
                <Select.ItemText>{m}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
