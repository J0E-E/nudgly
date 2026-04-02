/**
 * Reminders screen: list, create, edit, delete, snooze, and clear standalone reminders.
 */

import { useState, useMemo } from 'react'
import type { StandaloneReminder } from '../types/standaloneReminder'
import type { SnoozePreset } from '../types/standaloneReminder'
import {
  useStandaloneReminderList,
  useSnoozeInstance,
  useClearInstance,
  useDeleteStandaloneReminder,
} from '../hooks/useStandaloneReminders'
import { ReminderListItem } from '../components/ReminderListItem'
import { ReminderFormModal } from '../components/ReminderFormModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PageCard } from '../components/PageCard'
import './RemindersScreen.css'

interface FormModalState {
  open: boolean
  mode: 'create' | 'edit'
  reminder?: StandaloneReminder
}

interface DeleteConfirmState {
  open: boolean
  reminder?: StandaloneReminder
}

export function RemindersScreen() {
  const [searchText, setSearchText] = useState('')
  const { data, isLoading, isError, error } = useStandaloneReminderList()
  const snoozeMutation = useSnoozeInstance()
  const clearMutation = useClearInstance()
  const deleteMutation = useDeleteStandaloneReminder()
  const [formModal, setFormModal] = useState<FormModalState>({
    open: false,
    mode: 'create',
  })
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    open: false,
  })

  const filteredReminders = useMemo(() => {
    if (!data?.results) return []
    if (!searchText) return data.results
    const search = searchText.toLowerCase()
    return data.results.filter((r) => r.name.toLowerCase().includes(search))
  }, [data?.results, searchText])

  function handleSnooze(reminder: StandaloneReminder, minutes: SnoozePreset) {
    if (!reminder.latest_instance) return
    snoozeMutation.mutate({
      reminderId: reminder.id,
      instanceId: reminder.latest_instance.id,
      payload: { snooze_minutes: minutes },
    })
  }

  function handleClear(reminder: StandaloneReminder) {
    if (!reminder.latest_instance) return
    clearMutation.mutate({
      reminderId: reminder.id,
      instanceId: reminder.latest_instance.id,
    })
  }

  function handleEdit(reminder: StandaloneReminder) {
    setFormModal({ open: true, mode: 'edit', reminder })
  }

  function handleDeleteRequest(reminder: StandaloneReminder) {
    setDeleteConfirm({ open: true, reminder })
  }

  function handleDeleteConfirm() {
    if (deleteConfirm.reminder) {
      deleteMutation.mutate(deleteConfirm.reminder.id)
    }
    setDeleteConfirm({ open: false })
  }

  function handleDeleteCancel() {
    setDeleteConfirm({ open: false })
  }

  return (
    <PageCard id="reminders-screen" ariaLabel="Reminders">
      <h1 id="reminders-screen-title" className="reminders-screen-title">
        Reminders
      </h1>
      <div id="reminders-toolbar" className="reminders-toolbar">
        <input
          id="reminders-search"
          type="text"
          className="reminders-search-input"
          placeholder="Search reminders..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          aria-label="Search reminders"
        />
        <button
          id="reminders-add-btn"
          type="button"
          className="reminders-add-btn"
          onClick={() => setFormModal({ open: true, mode: 'create' })}
        >
          + Add
        </button>
      </div>
      {deleteMutation.isError && (
        <div id="reminders-delete-error" className="reminders-mutation-error" role="alert">
          <p>Failed to delete reminder. Please try again.</p>
        </div>
      )}
      {snoozeMutation.isError && (
        <div id="reminders-snooze-error" className="reminders-mutation-error" role="alert">
          <p>Failed to snooze reminder. Please try again.</p>
        </div>
      )}
      {clearMutation.isError && (
        <div id="reminders-clear-error" className="reminders-mutation-error" role="alert">
          <p>Failed to clear reminder. Please try again.</p>
        </div>
      )}
      {isLoading && (
        <div id="reminders-loading" className="reminders-state" role="status">
          <p>Loading reminders...</p>
        </div>
      )}
      {isError && (
        <div
          id="reminders-error"
          className="reminders-state reminders-state--error"
          role="alert"
        >
          <p>
            Failed to load reminders
            {error instanceof Error ? `: ${error.message}` : '.'}
          </p>
        </div>
      )}
      {data && (
        filteredReminders.length === 0 ? (
          <div id="reminders-empty" className="reminders-state">
            <p>No reminders yet. Add one above!</p>
          </div>
        ) : (
          <ul id="reminders-list" className="reminders-list">
            {filteredReminders.map((r) => (
              <ReminderListItem
                key={r.id}
                reminder={r}
                onSnooze={handleSnooze}
                onClear={handleClear}
                onEdit={handleEdit}
                onDelete={handleDeleteRequest}
              />
            ))}
          </ul>
        )
      )}
      <ReminderFormModal
        open={formModal.open}
        mode={formModal.mode}
        reminder={formModal.reminder}
        onClose={() => setFormModal({ open: false, mode: 'create' })}
      />
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete reminder"
        message={
          deleteConfirm.reminder
            ? `Are you sure you want to delete "${deleteConfirm.reminder.name}"? All instances will be lost.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </PageCard>
  )
}
