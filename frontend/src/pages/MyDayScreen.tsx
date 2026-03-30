import { Link } from 'react-router-dom'
import { PageCard } from '../components/PageCard'
import { useMyDay } from '../hooks/useMyDay'
import { useToggleTaskComplete } from '../hooks/useTasks'
import { TaskStatus } from '../types/task'
import type { Task } from '../types/task'
import { getGreeting } from '../utils/timeOfDay'
import './MyDayScreen.css'

function formatDueTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${m.toString().padStart(2, '0')} ${suffix}`
}

export function MyDayScreen() {
  const { data, isLoading, isError, error } = useMyDay()
  const toggleComplete = useToggleTaskComplete()

  if (isLoading) {
    return (
      <PageCard id="my-day-screen" ariaLabel="My Day">
        <div className="my-day__state">Loading…</div>
      </PageCard>
    )
  }

  if (isError) {
    return (
      <PageCard id="my-day-screen" ariaLabel="My Day">
        <div className="my-day__state my-day__state--error">
          {(error as Error)?.message || 'Failed to load My Day'}
        </div>
      </PageCard>
    )
  }

  const metrics = data!.metrics
  const focusTasks = data!.focus_tasks
  const pct =
    metrics.focus_total > 0
      ? (metrics.focus_completed / metrics.focus_total) * 100
      : 0
  const remaining = metrics.focus_total - metrics.focus_completed

  const today = new Date()
  const dateStr = today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  function handleToggle(task: Task) {
    toggleComplete.mutate({ id: task.id, currentStatus: task.status })
  }

  return (
    <PageCard id="my-day-screen" ariaLabel="My Day">
      <header className="my-day__header">
        <h1 className="my-day__greeting">{getGreeting()}</h1>
        <span className="my-day__date">{dateStr}</span>
        <div className="my-day__badges">
          <span className="my-day__badge">
            Focus: {metrics.focus_completed}/{metrics.focus_total}
          </span>
          <span className="my-day__badge">
            Habits: {metrics.habits_remaining}
          </span>
          <span className="my-day__badge">
            Reminders: {metrics.upcoming_reminder_count}
          </span>
        </div>
      </header>

      <section aria-labelledby="my-day-focus-title">
        <h2 id="my-day-focus-title" className="my-day__section-title">
          Today's Focus
        </h2>

        {focusTasks.length > 0 ? (
          <ul className="my-day__focus-list">
            {focusTasks.map((task) => {
              const completed = task.status === TaskStatus.COMPLETED
              return (
                <li
                  key={task.id}
                  className={`my-day__focus-item${completed ? ' my-day__focus-item--completed' : ''}`}
                >
                  <span className="my-day__focus-checkbox-wrap">
                    <input
                      type="checkbox"
                      className="my-day__focus-checkbox"
                      checked={completed}
                      onChange={() => handleToggle(task)}
                      aria-label={`Mark "${task.title}" as ${completed ? 'pending' : 'complete'}`}
                    />
                  </span>
                  <span
                    className={`my-day__focus-title${completed ? ' my-day__focus-title--completed' : ''}`}
                  >
                    {task.title}
                  </span>
                  {task.due_time && (
                    <span className="my-day__focus-time">
                      {formatDueTime(task.due_time)}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="my-day__empty">
            No focus tasks yet. What's most important today?
          </p>
        )}

        <Link to="/tasks" className="my-day__add-focus-link">
          + Add to Focus
        </Link>
      </section>

      {metrics.focus_total > 0 && (
        <div className="my-day__progress">
          <p className="my-day__progress-text">
            {remaining === 0
              ? 'All done!'
              : `${metrics.focus_completed} down, ${remaining} to go`}
          </p>
          <div className="my-day__progress-bar">
            <div
              className="my-day__progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </PageCard>
  )
}
