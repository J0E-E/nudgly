import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { MyDayScreen } from './MyDayScreen'
import { TaskCategory, TaskStatus } from '../types/task'
import { HabitFrequency } from '../types/habit'
import type { MyDayResponse } from '../types/myDay'
import * as myDayApi from '../services/myDayApi'
import * as taskApi from '../services/taskApi'

vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(() => ({
    getApiDeps: vi.fn(() => ({
      getAccessToken: () => 'token',
      refreshTokens: vi.fn(),
      onUnauthorized: vi.fn(),
    })),
  })),
}))

vi.mock('../services/myDayApi', () => ({
  getMyDay: vi.fn(),
}))

vi.mock('../services/taskApi', () => ({
  updateTask: vi.fn(),
  listTasks: vi.fn(),
  reorderFocusTasks: vi.fn(),
}))

vi.mock('../utils/timeOfDay', () => ({
  getGreeting: vi.fn(() => 'Good morning'),
  getTimeOfDay: vi.fn(() => 'morning'),
}))

const baseFocusTask = {
  description: '',
  due_date: '2026-03-30',
  category: TaskCategory.WORK as const,
  tag: '',
  priority: 0,
  recurring: null,
  stack_count: 0,
  muted_until: null,
  created_at: '2026-03-30T10:00:00Z',
  completed_at: null,
  list_id: null,
  focus_date: '2026-03-30',
  created_by: null,
  linked_friends: [],
}

function makeMockResponse(overrides?: Partial<MyDayResponse>): MyDayResponse {
  return {
    focus_tasks: [
      {
        id: 1,
        title: 'Write tests',
        due_time: '14:30:00',
        status: TaskStatus.PENDING,
        focus_sort_order: 0,
        ...baseFocusTask,
      },
      {
        id: 2,
        title: 'Review PR',
        due_time: null,
        status: TaskStatus.PENDING,
        focus_sort_order: 1,
        ...baseFocusTask,
      },
      {
        id: 3,
        title: 'Deploy',
        due_time: null,
        status: TaskStatus.COMPLETED,
        focus_sort_order: 2,
        completed_at: '2026-03-30T09:00:00Z',
        ...baseFocusTask,
      },
    ],
    habits: [
      {
        id: 1,
        name: 'Meditate',
        frequency: HabitFrequency.DAILY,
        target_count: 1,
        reminder_times: [],
        streak_count: 5,
        last_completed_at: null,
        created_at: '2026-01-01T00:00:00Z',
        period_completions: 0,
        next_reminder_at: null,
      },
    ],
    upcoming_reminders: [
      {
        id: 1,
        name: 'Standup',
        next_trigger_at: '2026-03-30T15:00:00Z',
        recurrence: 'daily',
      },
    ],
    metrics: {
      focus_total: 3,
      focus_completed: 1,
      habits_remaining: 1,
      upcoming_reminder_count: 1,
    },
    tasks_due_today_count: 2,
    ...overrides,
  }
}

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MyDayScreen />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('MyDayScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    vi.mocked(myDayApi.getMyDay).mockReturnValue(new Promise(() => {}))
    renderScreen()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows error state on fetch failure', async () => {
    vi.mocked(myDayApi.getMyDay).mockRejectedValue(new Error('Network error'))
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('renders greeting and date', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Good morning')).toBeInTheDocument()
    })
    // Date is rendered via toLocaleDateString; just check the header exists
    expect(
      screen.getByRole('heading', { level: 1, name: 'Good morning' })
    ).toBeInTheDocument()
  })

  it('renders metric badges', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Focus: 1/3')).toBeInTheDocument()
      expect(screen.getByText('Habits: 1')).toBeInTheDocument()
      expect(screen.getByText('Reminders: 1')).toBeInTheDocument()
    })
  })

  it('renders focus task list with titles', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Write tests')).toBeInTheDocument()
      expect(screen.getByText('Review PR')).toBeInTheDocument()
      expect(screen.getByText('Deploy')).toBeInTheDocument()
    })
  })

  it('shows due time when present', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('2:30 PM')).toBeInTheDocument()
    })
  })

  it('renders completed task with checked checkbox', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Deploy')).toBeInTheDocument()
    })
    const checkbox = screen.getByLabelText(
      'Mark "Deploy" as pending'
    ) as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('calls updateTask when checkbox is toggled', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    vi.mocked(taskApi.updateTask).mockResolvedValue({
      ...baseFocusTask,
      id: 1,
      title: 'Write tests',
      due_time: '14:30:00',
      status: TaskStatus.COMPLETED,
      focus_sort_order: 0,
    })
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Write tests')).toBeInTheDocument()
    })

    const checkbox = screen.getByLabelText('Mark "Write tests" as complete')
    fireEvent.click(checkbox)
    await waitFor(() => {
      expect(taskApi.updateTask).toHaveBeenCalledWith(expect.anything(), 1, {
        status: 'completed',
      })
    })
  })

  it('shows empty state when no focus tasks', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(
      makeMockResponse({
        focus_tasks: [],
        metrics: {
          focus_total: 0,
          focus_completed: 0,
          habits_remaining: 1,
          upcoming_reminder_count: 1,
        },
      })
    )
    renderScreen()
    await waitFor(() => {
      expect(
        screen.getByText("No focus tasks yet. What's most important today?")
      ).toBeInTheDocument()
    })
  })

  it('hides progress bar when no focus tasks', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(
      makeMockResponse({
        focus_tasks: [],
        metrics: {
          focus_total: 0,
          focus_completed: 0,
          habits_remaining: 1,
          upcoming_reminder_count: 1,
        },
      })
    )
    renderScreen()
    await waitFor(() => {
      expect(
        screen.getByText("No focus tasks yet. What's most important today?")
      ).toBeInTheDocument()
    })
    expect(screen.queryByText(/down,/)).not.toBeInTheDocument()
    expect(screen.queryByText('All done!')).not.toBeInTheDocument()
  })

  it('shows progress text for partial completion', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('1 down, 2 to go')).toBeInTheDocument()
    })
  })

  it('shows "All done!" at 100% completion', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(
      makeMockResponse({
        metrics: {
          focus_total: 3,
          focus_completed: 3,
          habits_remaining: 0,
          upcoming_reminder_count: 0,
        },
      })
    )
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('All done!')).toBeInTheDocument()
    })
  })

  it('renders "Add to Focus" link pointing to /tasks', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    renderScreen()
    await waitFor(() => {
      const link = screen.getByText('+ Add to Focus')
      expect(link).toBeInTheDocument()
      expect(link.closest('a')).toHaveAttribute('href', '/tasks')
    })
  })
})
