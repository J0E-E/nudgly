/**
 * Habits screen: list, create, edit, delete, and complete habits.
 */

import { useState, useMemo } from 'react'
import type { Habit } from '../types/habit'
import {
  useHabitList,
  useCompleteHabit,
  useDeleteHabit,
} from '../hooks/useHabits'
import { HabitList } from '../components/HabitList'
import { HabitFormModal } from '../components/HabitFormModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import './HabitsScreen.css'

interface FormModalState {
  open: boolean
  mode: 'create' | 'edit'
  habit?: Habit
}

interface DeleteConfirmState {
  open: boolean
  habit?: Habit
}

export function HabitsScreen() {
  const [searchText, setSearchText] = useState('')
  const { data, isLoading, isError, error } = useHabitList()
  const completeMutation = useCompleteHabit()
  const deleteMutation = useDeleteHabit()
  const [formModal, setFormModal] = useState<FormModalState>({
    open: false,
    mode: 'create',
  })
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    open: false,
  })

  const filteredHabits = useMemo(() => {
    if (!data?.results) return []
    if (!searchText) return data.results
    const search = searchText.toLowerCase()
    return data.results.filter((h) => h.name.toLowerCase().includes(search))
  }, [data?.results, searchText])

  function handleComplete(habit: Habit) {
    completeMutation.mutate({ id: habit.id })
  }

  function handleSkip(habit: Habit) {
    completeMutation.mutate({ id: habit.id, payload: { skipped: true } })
  }

  function handleEdit(habit: Habit) {
    setFormModal({ open: true, mode: 'edit', habit })
  }

  function handleDeleteRequest(habit: Habit) {
    setDeleteConfirm({ open: true, habit })
  }

  function handleDeleteConfirm() {
    if (deleteConfirm.habit) {
      deleteMutation.mutate(deleteConfirm.habit.id)
    }
    setDeleteConfirm({ open: false })
  }

  function handleDeleteCancel() {
    setDeleteConfirm({ open: false })
  }

  return (
    <main id="habits-screen" className="habits-screen" aria-label="Habits">
      <h1 id="habits-screen-title" className="habits-screen-title">
        Habits
      </h1>
      <div className="habits-toolbar">
        <input
          id="habits-search"
          type="text"
          className="habits-search-input"
          placeholder="Search habits..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          aria-label="Search habits"
        />
        <button
          id="habits-add-btn"
          type="button"
          className="habits-add-btn"
          onClick={() => setFormModal({ open: true, mode: 'create' })}
        >
          + Add habit
        </button>
      </div>
      {deleteMutation.isError && (
        <div className="habits-mutation-error" role="alert">
          <p>Failed to delete habit. Please try again.</p>
        </div>
      )}
      {completeMutation.isError && (
        <div className="habits-mutation-error" role="alert">
          <p>Failed to log completion. Please try again.</p>
        </div>
      )}
      {isLoading && (
        <div id="habits-loading" className="habits-state" role="status">
          <p>Loading habits...</p>
        </div>
      )}
      {isError && (
        <div
          id="habits-error"
          className="habits-state habits-state--error"
          role="alert"
        >
          <p>
            Failed to load habits
            {error instanceof Error ? `: ${error.message}` : '.'}
          </p>
        </div>
      )}
      {data && (
        <HabitList
          habits={filteredHabits}
          onComplete={handleComplete}
          onSkip={handleSkip}
          onEdit={handleEdit}
          onDelete={handleDeleteRequest}
        />
      )}
      <HabitFormModal
        open={formModal.open}
        mode={formModal.mode}
        habit={formModal.habit}
        onClose={() => setFormModal({ open: false, mode: 'create' })}
      />
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete habit"
        message={
          deleteConfirm.habit
            ? `Are you sure you want to delete "${deleteConfirm.habit.name}"? All completions will be lost.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </main>
  )
}
