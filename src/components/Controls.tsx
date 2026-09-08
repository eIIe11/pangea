import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sendControl } from '../lib/api'
import type { ControlAction, EngineState } from '../lib/types'

const ENGINE_TEXT: Record<EngineState, string> = {
  running: 'Engine running',
  entries_paused: 'New entries paused — existing positions held',
  halted: 'Halted — flat. Restart needs a human and a journal note.',
}

/**
 * Three levels, not two (§17). STOP EVERYTHING has no confirmation dialog by design:
 * it must work one-tap, from a phone, on bad wifi. It also stays tappable while a command is
 * in flight — halting twice is harmless, whereas halving twice is not, so the graduated
 * controls lock until the previous command settles.
 */
export function Controls({ engine }: { engine: EngineState }) {
  const queryClient = useQueryClient()
  const control = useMutation({
    mutationFn: (action: ControlAction) => sendControl(action),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['snapshot'] }),
  })

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => control.mutate('halve')}
          disabled={engine === 'halted' || control.isPending}
          className="rounded-xl border border-pg-line py-3 text-xs font-semibold tracking-[0.12em] uppercase disabled:opacity-40"
        >
          Halve everything
        </button>
        <button
          type="button"
          onClick={() => control.mutate(engine === 'entries_paused' ? 'resume' : 'pause_entries')}
          disabled={engine === 'halted' || control.isPending}
          className="rounded-xl border border-pg-line py-3 text-xs font-semibold tracking-[0.12em] uppercase disabled:opacity-40"
        >
          {engine === 'entries_paused' ? 'Resume entries' : 'Pause new entries'}
        </button>
      </div>
      <button
        type="button"
        onClick={() => control.mutate('stop_everything')}
        className="w-full rounded-xl border border-pg-down/60 bg-pg-down/10 py-4 text-sm font-bold tracking-[0.16em] text-pg-down uppercase active:bg-pg-down/20"
      >
        ⏻ Stop everything
      </button>
      <p className="text-center text-[11px] text-pg-mute" aria-live="polite">
        {control.isPending ? 'Sending…' : ENGINE_TEXT[engine]}
      </p>
      {control.isError && (
        <p className="text-center text-[11px] text-pg-down" aria-live="polite">
          Command failed — retry, or use the CLI kill switch.
        </p>
      )}
      {control.data && !control.data.accepted && (
        <p className="text-center text-[11px] text-pg-gold" aria-live="polite">
          {control.data.reason}
        </p>
      )}
    </div>
  )
}
