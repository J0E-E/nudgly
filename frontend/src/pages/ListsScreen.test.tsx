import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ListsScreen } from './ListsScreen'
import type { List, ListResponse } from '../types/list'
import * as listApi from '../services/listApi'

vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(() => ({
    getApiDeps: vi.fn(() => ({
      getAccessToken: () => 'token',
      refreshTokens: vi.fn(),
      onUnauthorized: vi.fn(),
    })),
  })),
}))

vi.mock('../services/listApi', () => ({
  listLists: vi.fn(),
  getList: vi.fn(),
  createList: vi.fn(),
  updateList: vi.fn(),
  deleteList: vi.fn(),
}))

const mockLists: List[] = [
  {
    id: 1,
    name: 'Groceries',
    category: 'work',
    tag: 'shopping',
    priority: 2,
    sort_order: 0,
    muted_until: null,
    archived_at: null,
    created_at: '2026-03-20T10:00:00Z',
    task_count: 5,
  },
  {
    id: 2,
    name: 'Workout Plan',
    category: 'personal',
    tag: '',
    priority: 0,
    sort_order: 1,
    muted_until: null,
    archived_at: null,
    created_at: '2026-03-20T11:00:00Z',
    task_count: 3,
  },
]

const mockResponse: ListResponse = {
  count: 2,
  limit: 50,
  offset: 0,
  results: mockLists,
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ListsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    HTMLDialogElement.prototype.showModal =
      HTMLDialogElement.prototype.showModal ||
      vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '')
      })
    HTMLDialogElement.prototype.close =
      HTMLDialogElement.prototype.close ||
      vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute('open')
      })
  })

  it('shows loading state initially', () => {
    vi.mocked(listApi.listLists).mockReturnValue(new Promise(() => {}))
    renderWithProviders(<ListsScreen />)
    expect(screen.getByText(/loading lists/i)).toBeInTheDocument()
  })

  it('shows error state on fetch failure', async () => {
    vi.mocked(listApi.listLists).mockRejectedValue(new Error('Network error'))
    renderWithProviders(<ListsScreen />)
    await waitFor(() => {
      expect(screen.getByText(/failed to load lists/i)).toBeInTheDocument()
    })
  })

  it('renders lists after loading', async () => {
    vi.mocked(listApi.listLists).mockResolvedValue(mockResponse)
    renderWithProviders(<ListsScreen />)
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument()
      expect(screen.getByText('Workout Plan')).toBeInTheDocument()
    })
  })

  it('shows task count for each list', async () => {
    vi.mocked(listApi.listLists).mockResolvedValue(mockResponse)
    renderWithProviders(<ListsScreen />)
    await waitFor(() => {
      expect(screen.getByText('5 tasks')).toBeInTheDocument()
      expect(screen.getByText('3 tasks')).toBeInTheDocument()
    })
  })

  it('filters lists by search text', async () => {
    vi.mocked(listApi.listLists).mockResolvedValue(mockResponse)
    renderWithProviders(<ListsScreen />)
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByPlaceholderText(/search lists/i), {
      target: { value: 'workout' },
    })
    expect(screen.queryByText('Groceries')).not.toBeInTheDocument()
    expect(screen.getByText('Workout Plan')).toBeInTheDocument()
  })

  it('filters lists by category', async () => {
    vi.mocked(listApi.listLists).mockResolvedValue(mockResponse)
    renderWithProviders(<ListsScreen />)
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByLabelText('Toggle filters'))
    fireEvent.change(document.getElementById('list-filter-category')!, {
      target: { value: 'personal' },
    })
    expect(screen.queryByText('Groceries')).not.toBeInTheDocument()
    expect(screen.getByText('Workout Plan')).toBeInTheDocument()
  })

  it('shows empty state when no lists exist', async () => {
    vi.mocked(listApi.listLists).mockResolvedValue({
      ...mockResponse,
      count: 0,
      results: [],
    })
    renderWithProviders(<ListsScreen />)
    await waitFor(() => {
      expect(screen.getByText(/no lists yet/i)).toBeInTheDocument()
    })
  })

  it('shows empty state when filters match nothing', async () => {
    vi.mocked(listApi.listLists).mockResolvedValue(mockResponse)
    renderWithProviders(<ListsScreen />)
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByPlaceholderText(/search lists/i), {
      target: { value: 'nonexistent' },
    })
    expect(screen.getByText(/no lists match/i)).toBeInTheDocument()
  })

  it('renders page title', () => {
    vi.mocked(listApi.listLists).mockReturnValue(new Promise(() => {}))
    renderWithProviders(<ListsScreen />)
    expect(screen.getByText('Lists')).toBeInTheDocument()
  })

  it('opens add list form when add button clicked', async () => {
    vi.mocked(listApi.listLists).mockResolvedValue(mockResponse)
    renderWithProviders(<ListsScreen />)
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument()
    })

    fireEvent.click(document.getElementById('list-add-btn')!)
    expect(document.getElementById('list-form-title')?.textContent).toBe(
      'Add list'
    )
  })
})
