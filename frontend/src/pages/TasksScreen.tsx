/**
 * Tasks screen: list, create, edit, delete tasks with search/filter.
 */

import { useState, useMemo } from 'react'
import type { Task } from '../types/task'
import {
  useTaskList,
  useToggleTaskComplete,
  useDeleteTask,
} from '../hooks/useTasks'
import { TaskFilterBar } from '../components/TaskFilterBar'
import { TaskList } from '../components/TaskList'
import { TaskFormModal } from '../components/TaskFormModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
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

export function TasksScreen() {
  const { data, isLoading, isError, error } = useTaskList()
  const toggleComplete = useToggleTaskComplete()
  const deleteMutation = useDeleteTask()

  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [formModal, setFormModal] = useState<FormModalState>({
    open: false,
    mode: 'create',
  })
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>({
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

  return (
    <main id="tasks-screen" className="tasks-screen" aria-label="Tasks">
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
      />
      {(toggleComplete.isError || deleteMutation.isError) && (
        <div
          id="tasks-mutation-error"
          className="tasks-mutation-error"
          role="alert"
        >
          <p>
            {toggleComplete.isError
              ? 'Failed to update task. Please try again.'
              : 'Failed to delete task. Please try again.'}
          </p>
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
    </main>
  )
}
