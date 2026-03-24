/**
 * Single habit row with tap-to-expand detail view.
 * Shows name, streak/progress label, and a "Done" button.
 * Expanding reveals frequency, target, reminder times, and action buttons.
 */

import { useState } from 'react'
import type { Habit } from '../types/habit'
import { HabitFrequency, HABIT_FREQUENCY_LABELS } from '../types/habit'
import './HabitListItem.css'

interface HabitListItemProps {
  habit: Habit
  onComplete: (habit: Habit) => void
  onSkip: (habit: Habit) => void
  onEdit: (habit: Habit) => void
  onDelete: (habit: Habit) => void
}

function formatStreakLabel(habit: Habit): string {
  if (habit.frequency === HabitFrequency.DAILY) {
    if (habit.streak_count > 0) return `${habit.streak_count} day streak`
    return 'No streak'
  }
  const periodLabel =
    habit.frequency === HabitFrequency.WEEKLY ? 'this week' : 'this month'
  const progress = `${habit.period_completions}/${habit.target_count} ${periodLabel}`
  if (habit.streak_count > 0) {
    const unit = habit.frequency === HabitFrequency.WEEKLY ? 'week' : 'month'
    return `${progress} · ${habit.streak_count} ${unit} streak`
  }
  return progress
}

function formatDateTime(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(':')
  const h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${mStr} ${ampm}`
}

export function HabitListItem({
  habit,
  onComplete,
  onSkip,
  onEdit,
  onDelete,
}: HabitListItemProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <li
      id={`habit-${habit.id}`}
      className={`habit-list-item${expanded ? ' habit-list-item--expanded' : ''}`}
    >
      <button
        type="button"
        className="habit-list-item-done-btn"
        onClick={() => onComplete(habit)}
        aria-label={`Mark "${habit.name}" as done`}
      >
        +
      </button>
      <button
        type="button"
        className="habit-list-item-content"
        aria-expanded={expanded}
        aria-controls={`habit-${habit.id}-details`}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="habit-list-item-content-text">
          <span
            id={`habit-${habit.id}-name`}
            className="habit-list-item-name"
          >
            {habit.name}
          </span>
          <div className="habit-list-item-meta">
            <span className="habit-list-item-streak">
              {formatStreakLabel(habit)}
            </span>
            <span className="habit-list-item-frequency">
              {HABIT_FREQUENCY_LABELS[habit.frequency]}
            </span>
          </div>
        </div>
        <svg
          className="habit-list-item-chevron"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M7 4l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        id={`habit-${habit.id}-details`}
        className="habit-list-item-details"
        role="region"
        aria-labelledby={`habit-${habit.id}-name`}
        aria-hidden={!expanded}
      >
        <div className="habit-list-item-details-inner">
          <p className="habit-list-item-detail-row">
            <span className="habit-list-item-detail-label">Target</span>
            <span>
              {habit.target_count} time{habit.target_count !== 1 ? 's' : ''} per{' '}
              {habit.frequency === HabitFrequency.DAILY
                ? 'day'
                : habit.frequency === HabitFrequency.WEEKLY
                  ? 'week'
                  : 'month'}
            </span>
          </p>
          {habit.reminder_times.length > 0 && (
            <p className="habit-list-item-detail-row">
              <span className="habit-list-item-detail-label">Reminders</span>
              <span>
                {habit.reminder_times.map(formatTime12h).join(', ')}
              </span>
            </p>
          )}
          <p className="habit-list-item-detail-row">
            <span className="habit-list-item-detail-label">Last done</span>
            <span>
              {habit.last_completed_at
                ? formatDateTime(habit.last_completed_at)
                : 'Never'}
            </span>
          </p>
          <p className="habit-list-item-detail-row">
            <span className="habit-list-item-detail-label">Created</span>
            <span>{formatDateTime(habit.created_at)}</span>
          </p>
          <div className="habit-list-item-actions">
            <button
              id={`habit-${habit.id}-edit-btn`}
              type="button"
              className="habit-list-item-edit"
              onClick={() => onEdit(habit)}
              aria-label={`Edit "${habit.name}"`}
            >
              Edit
            </button>
            <button
              id={`habit-${habit.id}-skip-btn`}
              type="button"
              className="habit-list-item-skip"
              onClick={() => onSkip(habit)}
              aria-label={`Skip "${habit.name}"`}
            >
              Skip
            </button>
            <button
              id={`habit-${habit.id}-delete-btn`}
              type="button"
              className="habit-list-item-delete"
              onClick={() => onDelete(habit)}
              aria-label={`Delete "${habit.name}"`}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}
