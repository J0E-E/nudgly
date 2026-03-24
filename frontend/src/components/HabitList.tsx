/**
 * Habit list: renders HabitListItem rows or empty state.
 */

import type { Habit } from '../types/habit'
import { HabitListItem } from './HabitListItem'
import './HabitList.css'

interface HabitListProps {
  habits: Habit[]
  onComplete: (habit: Habit) => void
  onSkip: (habit: Habit) => void
  onEdit: (habit: Habit) => void
  onDelete: (habit: Habit) => void
}

export function HabitList({
  habits,
  onComplete,
  onSkip,
  onEdit,
  onDelete,
}: HabitListProps) {
  if (habits.length === 0) {
    return (
      <div id="habit-list-empty" className="habit-list-empty">
        <p id="habit-list-empty-message">
          No habits yet. Add one to start building streaks!
        </p>
      </div>
    )
  }

  return (
    <ul id="habit-list" className="habit-list" role="list">
      {habits.map((habit) => (
        <HabitListItem
          key={habit.id}
          habit={habit}
          onComplete={onComplete}
          onSkip={onSkip}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  )
}
