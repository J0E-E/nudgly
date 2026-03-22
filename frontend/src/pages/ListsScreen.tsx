/**
 * Lists screen: list, create, edit, delete lists with search/filter.
 */

import { useState, useMemo } from 'react'
import type { List } from '../types/list'
import { useListList, useDeleteList } from '../hooks/useLists'
import { ListFilterBar } from '../components/ListFilterBar'
import { ListCard } from '../components/ListCard'
import { ListFormModal } from '../components/ListFormModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import './ListsScreen.css'

interface FormModalState {
  open: boolean
  mode: 'create' | 'edit'
  list?: List
}

interface DeleteConfirmState {
  open: boolean
  list?: List
}

export function ListsScreen() {
  const { data, isLoading, isError, error } = useListList()
  const deleteMutation = useDeleteList()

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

  const filteredLists = useMemo(() => {
    if (!data?.results) return []
    let lists = data.results
    if (searchText) {
      const search = searchText.toLowerCase()
      lists = lists.filter((l) => l.name.toLowerCase().includes(search))
    }
    if (categoryFilter) {
      lists = lists.filter((l) => l.category === categoryFilter)
    }
    if (priorityFilter) {
      lists = lists.filter((l) => l.priority === Number(priorityFilter))
    }
    return lists
  }, [data?.results, searchText, categoryFilter, priorityFilter])

  function handleDeleteConfirm() {
    if (deleteConfirm.list) {
      deleteMutation.mutate(deleteConfirm.list.id)
    }
    setDeleteConfirm({ open: false })
  }

  function handleDeleteCancel() {
    setDeleteConfirm({ open: false })
  }

  return (
    <main id="lists-screen" className="lists-screen" aria-label="Lists">
      <h1 id="lists-screen-title" className="lists-screen-title">
        Lists
      </h1>
      <ListFilterBar
        searchText={searchText}
        onSearchChange={setSearchText}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        onAddList={() => setFormModal({ open: true, mode: 'create' })}
      />
      {deleteMutation.isError && (
        <div
          id="lists-mutation-error"
          className="lists-mutation-error"
          role="alert"
        >
          <p>Failed to delete list. Please try again.</p>
        </div>
      )}
      {isLoading && (
        <div id="lists-loading" className="lists-state" role="status">
          <p>Loading lists...</p>
        </div>
      )}
      {isError && (
        <div
          id="lists-error"
          className="lists-state lists-state--error"
          role="alert"
        >
          <p>
            Failed to load lists
            {error instanceof Error ? `: ${error.message}` : '.'}
          </p>
        </div>
      )}
      {data && filteredLists.length === 0 && !isLoading && (
        <div id="lists-empty" className="lists-state">
          <p>
            {data.results.length === 0
              ? 'No lists yet. Add one to get started!'
              : 'No lists match your filters.'}
          </p>
        </div>
      )}
      {data && filteredLists.length > 0 && (
        <ul id="lists-list" className="lists-list">
          {filteredLists.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              onEdit={(l) =>
                setFormModal({ open: true, mode: 'edit', list: l })
              }
              onDelete={(l) => setDeleteConfirm({ open: true, list: l })}
            />
          ))}
        </ul>
      )}
      <ListFormModal
        open={formModal.open}
        mode={formModal.mode}
        list={formModal.list}
        onClose={() => setFormModal({ open: false, mode: 'create' })}
      />
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete list"
        message={
          deleteConfirm.list
            ? `Are you sure you want to delete "${deleteConfirm.list.name}"? Tasks in this list will be moved to the default Tasks view.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </main>
  )
}
