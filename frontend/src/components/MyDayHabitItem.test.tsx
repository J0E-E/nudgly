import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MyDayHabitItem } from './MyDayHabitItem'
import { HabitFrequency } from '../types/habit'
import type { Habit } from '../types/habit'

const baseHabit: Habit = {
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
}

describe('MyDayHabitItem', () => {
  it('renders habit name', () => {
    render(<MyDayHabitItem habit={baseHabit} onComplete={vi.fn()} />)
    expect(screen.getByText('Meditate')).toBeInTheDocument()
  })

  it('shows streak badge when streak_count > 0', () => {
    render(<MyDayHabitItem habit={baseHabit} onComplete={vi.fn()} />)
    expect(screen.getByText('5 day streak')).toBeInTheDocument()
  })

  it('shows week streak for weekly habits', () => {
    const habit = { ...baseHabit, frequency: HabitFrequency.WEEKLY, streak_count: 3 }
    render(<MyDayHabitItem habit={habit} onComplete={vi.fn()} />)
    expect(screen.getByText('3 week streak')).toBeInTheDocument()
  })

  it('does not show streak badge when streak_count is 0', () => {
    const habit = { ...baseHabit, streak_count: 0 }
    render(<MyDayHabitItem habit={habit} onComplete={vi.fn()} />)
    expect(screen.queryByText(/streak/)).not.toBeInTheDocument()
  })

  it('shows progress fraction', () => {
    render(<MyDayHabitItem habit={baseHabit} onComplete={vi.fn()} />)
    expect(screen.getByText('0/1')).toBeInTheDocument()
  })

  it('calls onComplete when (+) button is clicked', () => {
    const onComplete = vi.fn()
    render(<MyDayHabitItem habit={baseHabit} onComplete={onComplete} />)
    fireEvent.click(screen.getByLabelText('Complete "Meditate"'))
    expect(onComplete).toHaveBeenCalledWith(baseHabit)
  })
})
