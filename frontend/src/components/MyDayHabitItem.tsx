import type { Habit } from '../types/habit'
import { HabitFrequency } from '../types/habit'
import './MyDayHabitItem.css'

interface MyDayHabitItemProps {
  habit: Habit
  onComplete: (habit: Habit) => void
}

function formatStreakLabel(habit: Habit): string | null {
  if (habit.streak_count <= 0) return null
  if (habit.frequency === HabitFrequency.DAILY)
    return `${habit.streak_count} day streak`
  const unit = habit.frequency === HabitFrequency.WEEKLY ? 'week' : 'month'
  return `${habit.streak_count} ${unit} streak`
}

export function MyDayHabitItem({ habit, onComplete }: MyDayHabitItemProps) {
  const streakLabel = formatStreakLabel(habit)

  return (
    <li className="my-day-habit-item">
      <div className="my-day-habit-item__info">
        <span className="my-day-habit-item__name">{habit.name}</span>
        <div className="my-day-habit-item__meta">
          {streakLabel && (
            <span className="my-day-habit-item__streak">{streakLabel}</span>
          )}
          <span className="my-day-habit-item__progress">
            {habit.period_completions}/{habit.target_count}
          </span>
        </div>
      </div>
      <button
        type="button"
        className="my-day-habit-item__complete-btn"
        onClick={() => onComplete(habit)}
        aria-label={`Complete "${habit.name}"`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </li>
  )
}
