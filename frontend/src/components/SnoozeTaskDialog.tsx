/**
 * Dialog for snoozing/muting a task with preset durations.
 * Uses native <dialog> for focus trap and accessibility.
 */

import { useRef, useEffect } from 'react'
import type { MutePreset } from '../types/task'
import { MUTE_PRESET_LABELS } from '../types/task'
import './SnoozeTaskDialog.css'

interface SnoozeTaskDialogProps {
  open: boolean
  taskTitle: string
  isMuted: boolean
  onSnooze: (preset: MutePreset) => void
  onUnmute: () => void
  onCancel: () => void
}

const PRESETS: MutePreset[] = ['1h', '1d', '1wk']

export function SnoozeTaskDialog({
  open,
  taskTitle,
  isMuted,
  onSnooze,
  onUnmute,
  onCancel,
}: SnoozeTaskDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<Element | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      triggerRef.current = document.activeElement
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus()
      }
    }
  }, [open])

  return (
    <dialog
      id="snooze-task-dialog"
      ref={dialogRef}
      className="snooze-task-dialog"
      aria-labelledby="snooze-task-dialog-title"
      onClose={onCancel}
    >
      <h2 id="snooze-task-dialog-title" className="snooze-task-dialog-title">
        Snooze task
      </h2>
      <p className="snooze-task-dialog-task-name">{taskTitle}</p>
      <div className="snooze-task-dialog-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            id={`snooze-task-preset-${preset}`}
            type="button"
            className="snooze-task-dialog-preset"
            onClick={() => onSnooze(preset)}
          >
            {MUTE_PRESET_LABELS[preset]}
          </button>
        ))}
      </div>
      <div className="snooze-task-dialog-actions">
        {isMuted && (
          <button
            id="snooze-task-unmute-btn"
            type="button"
            className="snooze-task-dialog-unmute"
            onClick={onUnmute}
          >
            Unmute
          </button>
        )}
        <button
          id="snooze-task-cancel-btn"
          type="button"
          className="snooze-task-dialog-cancel"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </dialog>
  )
}
