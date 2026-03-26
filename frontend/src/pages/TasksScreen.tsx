/**
 * Tasks screen: list, create, edit, delete tasks with search/filter.
 */

import { useState, useMemo } from 'react'
import type { Task } from '../types/task'
import type { MutePreset } from '../types/task'
import {
  useTaskList,
  useToggleTaskComplete,
  useUpdateTask,
  useDeleteTask,
} from '../hooks/useTasks'
import { TaskFilterBar } from '../components/TaskFilterBar'
import { TaskList } from '../components/TaskList'
import { TaskFormModal } from '../components/TaskFormModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { SnoozeTaskDialog } from '../components/SnoozeTaskDialog'
import { PageCard } from '../components/PageCard'
import './TasksScreen.css'

interface FormModalState {
  open: boolean
  mode: 'create' | 'edit'
  task?: Task
}

interface DeleteConfirmState {
  open: boolean
  task?: Task
}

interface SnoozeState {
  open: boolean
  task?: Task
}

export function TasksScreen() {
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [listFilter, setListFilter] = useState('')
  const [createdForMe, setCreatedForMe] = useState(false)

  const listIdParam = listFilter === 'none' ? ('none' as const) : undefined
  const { data, isLoading, isError, error } = useTaskList(
    undefined,
    listIdParam,
    createdForMe || undefined
  )
  const toggleComplete = useToggleTaskComplete()
  const updateMutation = useUpdateTask()
  const deleteMutation = useDeleteTask()
  const [formModal, setFormModal] = useState<FormModalState>({
    open: false,
    mode: 'create',
  })
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
    open: false,
  })
  const [snoozeState, setSnoozeState] = useState<SnoozeState>({
    open: false,
  })

  const filteredTasks = useMemo(() => {
    if (!data?.results) return []
    let tasks = data.results
    if (searchText) {
      const search = searchText.toLowerCase()
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(search) ||
          t.description.toLowerCase().includes(search)
      )
    }
    if (categoryFilter) {
      tasks = tasks.filter((t) => t.category === categoryFilter)
    }
    if (priorityFilter) {
      tasks = tasks.filter((t) => t.priority === Number(priorityFilter))
    }
    return tasks
  }, [data?.results, searchText, categoryFilter, priorityFilter])

  function handleToggleComplete(task: Task) {
    toggleComplete.mutate({ id: task.id, currentStatus: task.status })
  }

  function handleEdit(task: Task) {
    setFormModal({ open: true, mode: 'edit', task })
  }

  function handleDeleteRequest(task: Task) {
    setDeleteConfirm({ open: true, task })
  }

  function handleDeleteConfirm() {
    if (deleteConfirm.task) {
      deleteMutation.mutate(deleteConfirm.task.id)
    }
    setDeleteConfirm({ open: false })
  }

  function handleDeleteCancel() {
    setDeleteConfirm({ open: false })
  }

  function handleSnoozeRequest(task: Task) {
    setSnoozeState({ open: true, task })
  }

  function handleSnoozeConfirm(preset: MutePreset) {
    if (snoozeState.task) {
      updateMutation.mutate({
        id: snoozeState.task.id,
        payload: { mute_preset: preset },
      })
    }
    setSnoozeState({ open: false })
  }

  function handleUnmute() {
    if (snoozeState.task) {
      updateMutation.mutate({
        id: snoozeState.task.id,
        payload: { muted_until: null },
      })
    }
    setSnoozeState({ open: false })
  }

  function handleSnoozeCancel() {
    setSnoozeState({ open: false })
  }

  return (
    <PageCard id="tasks-screen" ariaLabel="Tasks">
      <h1 id="tasks-screen-title" className="tasks-screen-title">
        Tasks
      </h1>
      <TaskFilterBar
        searchText={searchText}
        onSearchChange={setSearchText}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        onAddTask={() => setFormModal({ open: true, mode: 'create' })}
        listFilter={listFilter}
        onListFilterChange={setListFilter}
        createdForMe={createdForMe}
        onCreatedForMeChange={setCreatedForMe}
      />
      {deleteMutation.isError && (
        <div className="tasks-mutation-error" role="alert">
          <p>Failed to delete task. Please try again.</p>
        </div>
      )}
      {toggleComplete.isError && (
        <div className="tasks-mutation-error" role="alert">
          <p>Failed to update task status. Please try again.</p>
        </div>
      )}
      {updateMutation.isError && (
        <div className="tasks-mutation-error" role="alert">
          <p>Failed to update task. Please try again.</p>
        </div>
      )}
      {isLoading && (
        <div id="tasks-loading" className="tasks-state" role="status">
          <p>Loading tasks...</p>
        </div>
      )}
      {isError && (
        <div
          id="tasks-error"
          className="tasks-state tasks-state--error"
          role="alert"
        >
          <p>
            Failed to load tasks
            {error instanceof Error ? `: ${error.message}` : '.'}
          </p>
        </div>
      )}
      {data && (
        <TaskList
          tasks={filteredTasks}
          onToggleComplete={handleToggleComplete}
          onEdit={handleEdit}
          onDelete={handleDeleteRequest}
          onSnooze={handleSnoozeRequest}
        />
      )}
      <TaskFormModal
        open={formModal.open}
        mode={formModal.mode}
        task={formModal.task}
        onClose={() => setFormModal({ open: false, mode: 'create' })}
      />
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete task"
        message={
          deleteConfirm.task
            ? `Are you sure you want to delete "${deleteConfirm.task.title}"?`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
      <SnoozeTaskDialog
        open={snoozeState.open}
        taskTitle={snoozeState.task?.title ?? ''}
        isMuted={
          snoozeState.task?.muted_until !== undefined &&
          snoozeState.task?.muted_until !== null &&
          new Date(snoozeState.task.muted_until) > new Date()
        }
        onSnooze={handleSnoozeConfirm}
        onUnmute={handleUnmute}
        onCancel={handleSnoozeCancel}
      />
    </PageCard>
  )
}
