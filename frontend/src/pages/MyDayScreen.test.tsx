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
import * as habitApi from '../services/habitApi'
import { getTimeOfDay } from '../utils/timeOfDay'

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

vi.mock('../services/habitApi', () => ({
  completeHabit: vi.fn(),
  listHabits: vi.fn(),
  createHabit: vi.fn(),
  updateHabit: vi.fn(),
  deleteHabit: vi.fn(),
}))

vi.mock('../utils/timeOfDay', () => ({
  getGreeting: vi.fn(() => 'Good morning'),
  getTimeOfDay: vi.fn(() => 'morning'),
}))

const baseFocusTask = {
  description: '',
  due_date: '2026-03-30',
  category: TaskCategory.WORK,
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
        ...baseFocusTask,
        completed_at: '2026-03-30T09:00:00Z',
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

// Stub showModal / close for jsdom (no native <dialog> support)
beforeEach(() => {
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

  it('renders "Add to Focus" button that opens picker dialog', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    vi.mocked(taskApi.listTasks).mockResolvedValue({
      count: 0,
      limit: 50,
      offset: 0,
      results: [],
    })
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('+ Add to Focus')).toBeInTheDocument()
    })
    const btn = screen.getByText('+ Add to Focus')
    expect(btn.tagName).toBe('BUTTON')
    fireEvent.click(btn)
    expect(screen.getByText('Add to Focus')).toBeInTheDocument()
  })

  it('renders focus tasks with drag handles', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    const { container } = renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Write tests')).toBeInTheDocument()
    })
    const dragHandles = container.querySelectorAll('.my-day-focus-item__drag-handle')
    expect(dragHandles.length).toBe(3)
  })

  it('renders remove-from-focus buttons on focus tasks', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Write tests')).toBeInTheDocument()
    })
    expect(
      screen.getByLabelText('Remove "Write tests" from focus'),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Remove "Review PR" from focus'),
    ).toBeInTheDocument()
  })

  it('calls updateTask with null focus_date when remove button clicked', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    vi.mocked(taskApi.updateTask).mockResolvedValue({
      ...baseFocusTask,
      id: 1,
      title: 'Write tests',
      due_time: '14:30:00',
      status: TaskStatus.PENDING,
      focus_sort_order: 0,
      focus_date: null,
    })
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Write tests')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByLabelText('Remove "Write tests" from focus'))
    await waitFor(() => {
      expect(taskApi.updateTask).toHaveBeenCalledWith(expect.anything(), 1, {
        focus_date: null,
      })
    })
  })

  // --- Habits section ---

  it('renders habit names in Habits section', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Meditate')).toBeInTheDocument()
    })
  })

  it('renders streak badge for habits with streak', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('5 day streak')).toBeInTheDocument()
    })
  })

  it('shows "No habits remaining" when habits list is empty', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(
      makeMockResponse({ habits: [] }),
    )
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('No habits remaining.')).toBeInTheDocument()
    })
  })

  it('shows "Show all" link when more than 4 habits', async () => {
    const habits = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: `Habit ${i + 1}`,
      frequency: HabitFrequency.DAILY,
      target_count: 1,
      reminder_times: [] as string[],
      streak_count: 0,
      last_completed_at: null,
      created_at: '2026-01-01T00:00:00Z',
      period_completions: 0,
      next_reminder_at: null,
    }))
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(
      makeMockResponse({ habits }),
    )
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Show all')).toBeInTheDocument()
      expect(screen.getByText('Show all').closest('a')).toHaveAttribute(
        'href',
        '/habits',
      )
    })
    // Only 4 visible
    expect(screen.queryByText('Habit 5')).not.toBeInTheDocument()
  })

  it('calls completeHabit when (+) button clicked', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    vi.mocked(habitApi.completeHabit).mockResolvedValue({
      id: 1,
      habit_id: 1,
      completed_at: '2026-03-30T10:00:00Z',
      skipped: false,
    })
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Meditate')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByLabelText('Complete "Meditate"'))
    await waitFor(() => {
      expect(habitApi.completeHabit).toHaveBeenCalledWith(
        expect.anything(),
        1,
        undefined,
      )
    })
  })

  // --- Reminders section ---

  it('renders reminder names in Reminders section', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Standup')).toBeInTheDocument()
    })
  })

  it('shows "No upcoming reminders" when list is empty', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(
      makeMockResponse({ upcoming_reminders: [] }),
    )
    renderScreen()
    await waitFor(() => {
      expect(
        screen.getByText('No upcoming reminders.'),
      ).toBeInTheDocument()
    })
  })

  it('shows "See all" link when more than 3 reminders', async () => {
    const reminders = Array.from({ length: 4 }, (_, i) => ({
      id: i + 1,
      name: `Reminder ${i + 1}`,
      next_trigger_at: '2026-03-30T18:00:00Z',
      recurrence: null,
    }))
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(
      makeMockResponse({ upcoming_reminders: reminders }),
    )
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('See all')).toBeInTheDocument()
      expect(screen.getByText('See all').closest('a')).toHaveAttribute(
        'href',
        '/reminders',
      )
    })
    expect(screen.queryByText('Reminder 4')).not.toBeInTheDocument()
  })

  // --- Context-aware ordering ---

  it('renders Habits before Reminders in the morning', async () => {
    vi.mocked(getTimeOfDay).mockReturnValue('morning')
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Meditate')).toBeInTheDocument()
    })
    const headings = screen.getAllByRole('heading', { level: 2 })
    const titles = headings.map((h) => h.textContent)
    const habitsIdx = titles.indexOf('Habits')
    const remindersIdx = titles.indexOf('Reminders')
    expect(habitsIdx).toBeLessThan(remindersIdx)
  })

  it('renders Reminders before Habits in the afternoon', async () => {
    vi.mocked(getTimeOfDay).mockReturnValue('afternoon')
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Meditate')).toBeInTheDocument()
    })
    const headings = screen.getAllByRole('heading', { level: 2 })
    const titles = headings.map((h) => h.textContent)
    const habitsIdx = titles.indexOf('Habits')
    const remindersIdx = titles.indexOf('Reminders')
    expect(remindersIdx).toBeLessThan(habitsIdx)
  })

  // --- Nudge banner ---

  it('shows nudge message based on metrics and time of day', async () => {
    vi.mocked(getTimeOfDay).mockReturnValue('morning')
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(
      makeMockResponse({
        metrics: {
          focus_total: 3,
          focus_completed: 0,
          habits_remaining: 2,
          upcoming_reminder_count: 1,
        },
      }),
    )
    renderScreen()
    await waitFor(() => {
      expect(
        screen.getByText('Quick win? Complete a habit to build momentum!'),
      ).toBeInTheDocument()
    })
  })

  it('shows evening completed summary instead of task list', async () => {
    vi.mocked(getTimeOfDay).mockReturnValue('evening')
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(
      makeMockResponse({
        metrics: {
          focus_total: 3,
          focus_completed: 3,
          habits_remaining: 1,
          upcoming_reminder_count: 0,
        },
      }),
    )
    renderScreen()
    await waitFor(() => {
      expect(
        screen.getByText('You completed all 3 focus tasks today.'),
      ).toBeInTheDocument()
    })
    // Individual task items should not be rendered
    expect(screen.queryByLabelText(/Mark "/)).not.toBeInTheDocument()
  })

  it('shows "All caught up!" when everything is done', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(
      makeMockResponse({
        metrics: {
          focus_total: 3,
          focus_completed: 3,
          habits_remaining: 0,
          upcoming_reminder_count: 0,
        },
      }),
    )
    renderScreen()
    await waitFor(() => {
      expect(
        screen.getByText('All caught up! Enjoy your day.'),
      ).toBeInTheDocument()
    })
  })

  // --- Plan My Day CTA tests ---

  it('shows CTA when no focus tasks and tasks are due today', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(
      makeMockResponse({
        focus_tasks: [],
        metrics: {
          focus_total: 0,
          focus_completed: 0,
          habits_remaining: 1,
          upcoming_reminder_count: 1,
        },
        tasks_due_today_count: 3,
      }),
    )
    renderScreen()
    await waitFor(() => {
      expect(
        screen.getByText(/You have 3 tasks due today/),
      ).toBeInTheDocument()
      expect(screen.getByText('Plan my day')).toBeInTheDocument()
    })
  })

  it('shows generic CTA when no focus tasks and none due today', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(
      makeMockResponse({
        focus_tasks: [],
        metrics: {
          focus_total: 0,
          focus_completed: 0,
          habits_remaining: 1,
          upcoming_reminder_count: 1,
        },
        tasks_due_today_count: 0,
      }),
    )
    renderScreen()
    await waitFor(() => {
      expect(
        screen.getByText('Pick your top priorities'),
      ).toBeInTheDocument()
    })
  })

  it('shows completion CTA when all focus tasks complete', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(
      makeMockResponse({
        focus_tasks: [
          {
            id: 1,
            title: 'Done task',
            due_time: null,
            status: TaskStatus.COMPLETED,
            focus_sort_order: 0,
            ...baseFocusTask,
            completed_at: '2026-03-30T09:00:00Z',
          },
        ],
        metrics: {
          focus_total: 1,
          focus_completed: 1,
          habits_remaining: 0,
          upcoming_reminder_count: 0,
        },
      }),
    )
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Great day! All done.')).toBeInTheDocument()
      expect(screen.getByText('Pick more tasks')).toBeInTheDocument()
    })
  })

  it('hides CTA when focus tasks are in progress', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(makeMockResponse())
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Write tests')).toBeInTheDocument()
    })
    expect(screen.queryByText('Plan my day')).not.toBeInTheDocument()
    expect(screen.queryByText('Pick more tasks')).not.toBeInTheDocument()
  })

  it('CTA button opens FocusPickerDialog', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(
      makeMockResponse({
        focus_tasks: [],
        metrics: {
          focus_total: 0,
          focus_completed: 0,
          habits_remaining: 1,
          upcoming_reminder_count: 1,
        },
        tasks_due_today_count: 2,
      }),
    )
    vi.mocked(taskApi.listTasks).mockResolvedValue({
      count: 0,
      limit: 50,
      offset: 0,
      results: [],
    })
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Plan my day')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Plan my day'))
    await waitFor(() => {
      expect(screen.getByText('Add to Focus')).toBeInTheDocument()
    })
  })

  it('shows celebration icon inside CTA when all focus tasks complete', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(
      makeMockResponse({
        focus_tasks: [
          {
            id: 1,
            title: 'Done task',
            due_time: null,
            status: TaskStatus.COMPLETED,
            focus_sort_order: 0,
            ...baseFocusTask,
            completed_at: '2026-03-30T09:00:00Z',
          },
        ],
        metrics: {
          focus_total: 1,
          focus_completed: 1,
          habits_remaining: 0,
          upcoming_reminder_count: 0,
        },
      }),
    )
    const { container } = renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Great day! All done.')).toBeInTheDocument()
    })
    const cta = container.querySelector('.my-day__cta')
    expect(cta?.querySelector('.my-day__celebration-icon')).toBeInTheDocument()
  })

  it('hides Add to Focus button when CTA is visible', async () => {
    vi.mocked(myDayApi.getMyDay).mockResolvedValue(
      makeMockResponse({
        focus_tasks: [],
        metrics: {
          focus_total: 0,
          focus_completed: 0,
          habits_remaining: 1,
          upcoming_reminder_count: 1,
        },
        tasks_due_today_count: 0,
      }),
    )
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('Pick your top priorities')).toBeInTheDocument()
    })
    expect(screen.queryByText('+ Add to Focus')).not.toBeInTheDocument()
  })
})
