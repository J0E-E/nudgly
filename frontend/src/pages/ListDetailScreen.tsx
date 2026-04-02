/**
 * List detail screen: shows list info, tasks in the list, and list actions.
 */

import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Task } from '../types/task'
import { useListDetail, useUpdateList, useDeleteList } from '../hooks/useLists'
import {
  useTaskList,
  useToggleTaskComplete,
  useDeleteTask,
} from '../hooks/useTasks'
import type { TaskCategory } from '../types/task'
import { TASK_CATEGORY_LABELS, TASK_PRIORITY_LABELS } from '../types/task'
import { TaskFilterBar } from '../components/TaskFilterBar'
import { TaskList } from '../components/TaskList'
import { TaskFormModal } from '../components/TaskFormModal'
import { ListFormModal } from '../components/ListFormModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PageCard } from '../components/PageCard'
import './ListDetailScreen.css'

interface DeleteConfirmState {
  open: boolean
  task?: Task
}

export function ListDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const listId = Number(id)

  const {
    data: list,
    isLoading: listLoading,
    isError: listError,
  } = useListDetail(listId)
  const {
    data: tasksData,
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErrorObj,
  } = useTaskList(undefined, listId)
  const toggleComplete = useToggleTaskComplete()
  const deleteTaskMutation = useDeleteTask()
  const updateListMutation = useUpdateList()
  const deleteListMutation = useDeleteList()

  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [editTask, setEditTask] = useState<{
    open: boolean
    task?: Task
  }>({ open: false })
  const [listFormOpen, setListFormOpen] = useState(false)
  const [deleteListConfirm, setDeleteListConfirm] = useState(false)
  const [deleteTaskConfirm, setDeleteTaskConfirm] =
    useState<DeleteConfirmState>({ open: false })

  const filteredTasks = useMemo(() => {
    if (!tasksData?.results) return []
    let tasks = tasksData.results
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
  }, [tasksData?.results, searchText, categoryFilter, priorityFilter])

  function handleToggleComplete(task: Task) {
    toggleComplete.mutate({ id: task.id, currentStatus: task.status })
  }

  function handleEditTask(task: Task) {
    setEditTask({ open: true, task })
  }

  function handleDeleteTaskRequest(task: Task) {
    setDeleteTaskConfirm({ open: true, task })
  }

  function handleDeleteTaskConfirm() {
    if (deleteTaskConfirm.task) {
      deleteTaskMutation.mutate(deleteTaskConfirm.task.id)
    }
    setDeleteTaskConfirm({ open: false })
  }

  function handleMuteList() {
    if (!list) return
    const muteUntil = new Date()
    muteUntil.setDate(muteUntil.getDate() + 1)
    updateListMutation.mutate({
      id: listId,
      payload: { muted_until: muteUntil.toISOString() },
    })
  }

  function handleUnmuteList() {
    updateListMutation.mutate({
      id: listId,
      payload: { muted_until: null },
    })
  }

  function handleArchiveList() {
    updateListMutation.mutate(
      { id: listId, payload: { archived_at: new Date().toISOString() } },
      { onSuccess: () => navigate('/lists', { replace: true }) }
    )
  }

  function handleDeleteListConfirm() {
    deleteListMutation.mutate(listId, {
      onSuccess: () => navigate('/lists', { replace: true }),
    })
    setDeleteListConfirm(false)
  }

  if (listLoading) {
    return (
      <PageCard id="list-detail-screen" ariaLabel="List detail">
        <div id="list-detail-loading" className="list-detail-state" role="status">
          <p>Loading list...</p>
        </div>
      </PageCard>
    )
  }

  if (listError || !list) {
    return (
      <PageCard id="list-detail-screen" ariaLabel="List detail">
        <div
          id="list-detail-error"
          className="list-detail-state list-detail-state--error"
          role="alert"
        >
          <p>List not found.</p>
        </div>
      </PageCard>
    )
  }

  const isMuted = list.muted_until && new Date(list.muted_until) > new Date()

  return (
    <PageCard id="list-detail-screen" ariaLabel={`List: ${list.name}`}>
      <div id="list-detail-header" className="list-detail-header">
        <div id="list-detail-header-top" className="list-detail-header-top">
          <h1 id="list-detail-title" className="list-detail-title">
            {list.name}
          </h1>
          <button
            id="list-detail-back-btn"
            type="button"
            className="list-detail-back-btn"
            onClick={() => navigate('/lists')}
          >
            Back to lists
          </button>
        </div>
        <div id="list-detail-meta" className="list-detail-meta">
          {list.category && (
            <span id="list-detail-category-badge" className="list-detail-badge">
              {TASK_CATEGORY_LABELS[list.category as TaskCategory] ??
                list.category}
            </span>
          )}
          {list.priority > 0 && (
            <span id="list-detail-priority-badge" className="list-detail-badge list-detail-badge--priority">
              {TASK_PRIORITY_LABELS[list.priority]}
            </span>
          )}
          {list.tag && <span id="list-detail-tag-badge" className="list-detail-badge">{list.tag}</span>}
          {isMuted && (
            <span id="list-detail-muted-badge" className="list-detail-badge list-detail-badge--muted">
              Muted
            </span>
          )}
        </div>
      </div>

      <div id="list-detail-actions" className="list-detail-actions">
        <button
          id="list-detail-edit-btn"
          type="button"
          className="list-detail-action-btn"
          onClick={() => setListFormOpen(true)}
        >
          Edit
        </button>
        <button
          id="list-detail-mute-btn"
          type="button"
          className="list-detail-action-btn"
          onClick={isMuted ? handleUnmuteList : handleMuteList}
        >
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button
          id="list-detail-archive-btn"
          type="button"
          className="list-detail-action-btn"
          onClick={handleArchiveList}
        >
          Archive
        </button>
        <button
          id="list-detail-delete-btn"
          type="button"
          className="list-detail-action-btn list-detail-action-btn--danger"
          onClick={() => setDeleteListConfirm(true)}
        >
          Delete
        </button>
      </div>

      <TaskFilterBar
        searchText={searchText}
        onSearchChange={setSearchText}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        onAddTask={() => setTaskFormOpen(true)}
      />

      {(toggleComplete.isError || deleteTaskMutation.isError) && (
        <div id="list-detail-mutation-error" className="list-detail-mutation-error" role="alert">
          <p>
            {toggleComplete.isError
              ? 'Failed to update task. Please try again.'
              : 'Failed to delete task. Please try again.'}
          </p>
        </div>
      )}

      {tasksLoading && (
        <div id="list-detail-tasks-loading" className="list-detail-state" role="status">
          <p>Loading tasks...</p>
        </div>
      )}

      {tasksError && (
        <div
          id="list-detail-tasks-error"
          className="list-detail-state list-detail-state--error"
          role="alert"
        >
          <p>
            Failed to load tasks
            {tasksErrorObj instanceof Error
              ? `: ${tasksErrorObj.message}`
              : '.'}
          </p>
        </div>
      )}

      {tasksData && (
        <TaskList
          tasks={filteredTasks}
          onToggleComplete={handleToggleComplete}
          onEdit={handleEditTask}
          onDelete={handleDeleteTaskRequest}
          onSnooze={() => {}}
        />
      )}

      <TaskFormModal
        open={taskFormOpen}
        mode="create"
        onClose={() => setTaskFormOpen(false)}
        listId={listId}
        defaultCategory={list.category || undefined}
        defaultTag={list.tag || undefined}
        defaultPriority={list.priority}
      />

      <TaskFormModal
        open={editTask.open}
        mode="edit"
        task={editTask.task}
        onClose={() => setEditTask({ open: false })}
      />

      <ListFormModal
        open={listFormOpen}
        mode="edit"
        list={list}
        onClose={() => setListFormOpen(false)}
      />

      <ConfirmDialog
        open={deleteListConfirm}
        title="Delete list"
        message={`Are you sure you want to delete "${list.name}"? Tasks in this list will be moved to the default Tasks view.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteListConfirm}
        onCancel={() => setDeleteListConfirm(false)}
      />

      <ConfirmDialog
        open={deleteTaskConfirm.open}
        title="Delete task"
        message={
          deleteTaskConfirm.task
            ? `Are you sure you want to delete "${deleteTaskConfirm.task.title}"?`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteTaskConfirm}
        onCancel={() => setDeleteTaskConfirm({ open: false })}
      />
    </PageCard>
  )
}
