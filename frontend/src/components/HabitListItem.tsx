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

function formatPeriodCount(habit: Habit): string {
  const n = habit.period_completions
  if (habit.frequency === HabitFrequency.DAILY) return `${n} today`
  if (habit.frequency === HabitFrequency.WEEKLY) return `${n} this week`
  return `${n} this month`
}

function formatStreakLabel(habit: Habit): string | null {
  if (habit.streak_count <= 0) return null
  if (habit.frequency === HabitFrequency.DAILY) return `${habit.streak_count} day streak`
  const unit = habit.frequency === HabitFrequency.WEEKLY ? 'week' : 'month'
  return `${habit.streak_count} ${unit} streak`
}

function formatDateTime(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatNextReminder(isoStr: string): string {
  const date = new Date(isoStr)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffHours = Math.round(diffMs / (1000 * 60 * 60))
  const timeStr = formatTime12h(date.toTimeString().slice(0, 5))

  if (diffHours < 1) {
    const diffMins = Math.max(0, Math.round(diffMs / (1000 * 60)))
    return diffMins <= 0 ? 'Any moment' : `In ${diffMins} min`
  }

  const todayDate = now.toDateString()
  const tomorrowDate = new Date(now.getTime() + 86400000).toDateString()
  const targetDate = date.toDateString()

  if (targetDate === todayDate) return `Today at ${timeStr}`
  if (targetDate === tomorrowDate) return `Tomorrow at ${timeStr}`
  return formatDateTime(isoStr) + ` at ${timeStr}`
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
        className="habit-completion-btn"
        onClick={() => onComplete(habit)}
        aria-label={`Mark "${habit.name}" as done`}
      >
        <svg
          className="habit-completion-btn-icon"
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
            <span className="habit-list-item-period-count">
              {formatPeriodCount(habit)}
            </span>
            {formatStreakLabel(habit) && (
              <span className="habit-list-item-streak">
                {formatStreakLabel(habit)}
              </span>
            )}
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
          {habit.next_reminder_at && (
            <p className="habit-list-item-detail-row">
              <span className="habit-list-item-detail-label">Next reminder</span>
              <span>{formatNextReminder(habit.next_reminder_at)}</span>
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
