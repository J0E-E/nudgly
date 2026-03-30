import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HabitListItem } from './HabitListItem'
import { HabitFrequency } from '../types/habit'
import type { Habit } from '../types/habit'

const baseHabit: Habit = {
  id: 1,
  name: 'Meditate',
  frequency: HabitFrequency.DAILY,
  target_count: 1,
  reminder_times: ['09:00', '18:00'],
  streak_count: 5,
  last_completed_at: '2026-03-23T14:00:00Z',
  created_at: '2026-03-01T10:00:00Z',
  period_completions: 1,
  next_reminder_at: null,
}

function renderItem(habitOverrides: Partial<Habit> = {}) {
  const props = {
    habit: { ...baseHabit, ...habitOverrides },
    onComplete: vi.fn(),
    onSkip: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  }
  render(<HabitListItem {...props} />)
  return props
}

function expand() {
  const btn = document.querySelector(
    '[aria-controls="habit-1-details"]'
  ) as HTMLElement
  fireEvent.click(btn)
}

describe('HabitListItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders habit name', () => {
    renderItem()
    const matches = screen.getAllByText('Meditate')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('renders streak label', () => {
    renderItem()
    const matches = screen.getAllByText('5 day streak')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('renders reminder times in expanded view', () => {
    renderItem()
    expand()
    expect(screen.getByText('9:00 AM, 6:00 PM')).toBeInTheDocument()
  })

  it('renders next reminder when present', () => {
    const future = new Date()
    future.setHours(future.getHours() + 3)

    renderItem({ next_reminder_at: future.toISOString() })
    expand()
    expect(screen.getByText('Next reminder')).toBeInTheDocument()
  })

  it('does not render next reminder when null', () => {
    renderItem({ next_reminder_at: null })
    expand()
    expect(screen.queryByText('Next reminder')).not.toBeInTheDocument()
  })

  it('renders next reminder with Tomorrow when date is tomorrow', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(12, 0, 0, 0)

    renderItem({ next_reminder_at: tomorrow.toISOString() })
    expand()
    expect(screen.getByText(/Tomorrow at/)).toBeInTheDocument()
  })
})
