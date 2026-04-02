import type { UpcomingReminder } from '../types/myDay'
import './MyDayReminderItem.css'

interface MyDayReminderItemProps {
  reminder: UpcomingReminder
}

export function formatRelativeTime(isoStr: string): string {
  const diffMs = new Date(isoStr).getTime() - Date.now()
  if (diffMs < 0) return 'Past due'
  const mins = Math.round(diffMs / 60_000)
  if (mins < 1) return 'Any moment'
  if (mins < 60) return `In ${mins} min`
  const hours = Math.floor(diffMs / 3_600_000)
  if (hours < 24) return hours === 1 ? 'In 1 hour' : `In ${hours} hours`
  return 'Tomorrow'
}

export function MyDayReminderItem({ reminder }: MyDayReminderItemProps) {
  return (
    <li id={`my-day-reminder-${reminder.id}`} className="my-day-reminder-item">
      <svg
        id={`my-day-reminder-${reminder.id}-icon`}
        className="my-day-reminder-item__icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <div id={`my-day-reminder-${reminder.id}-content`} className="my-day-reminder-item__content">
        <span id={`my-day-reminder-${reminder.id}-name`} className="my-day-reminder-item__name">{reminder.name}</span>
        <span id={`my-day-reminder-${reminder.id}-time`} className="my-day-reminder-item__time">
          {formatRelativeTime(reminder.next_trigger_at)}
        </span>
      </div>
    </li>
  )
}
