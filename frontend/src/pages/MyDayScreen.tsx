import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageCard } from '../components/PageCard'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { MyDayHabitItem } from '../components/MyDayHabitItem'
import { MyDayReminderItem } from '../components/MyDayReminderItem'
import { MyDayFocusItem } from '../components/MyDayFocusItem'
import { FocusPickerDialog } from '../components/FocusPickerDialog'
import { useMyDay } from '../hooks/useMyDay'
import { useToggleTaskComplete, useUpdateTask, useReorderFocusTasks } from '../hooks/useTasks'
import { useCompleteHabit } from '../hooks/useHabits'
import { useDragReorder } from '../hooks/useDragReorder'
import type { Task } from '../types/task'
import type { Habit } from '../types/habit'
import { getGreeting, getTimeOfDay } from '../utils/timeOfDay'
import { getNudgeMessage } from '../utils/nudgeCopy'
import './MyDayScreen.css'

function getPlanMyDayCta(
  focusTotal: number,
  focusCompleted: number,
  tasksDueToday: number,
): { message: string; buttonLabel: string } | null {
  const remaining = focusTotal - focusCompleted

  if (focusTotal > 0 && remaining > 0) return null

  if (focusTotal > 0 && remaining === 0) {
    return { message: 'Great day! All done.', buttonLabel: 'Pick more tasks' }
  }

  if (tasksDueToday > 0) {
    return {
      message: `You have ${tasksDueToday} task${tasksDueToday === 1 ? '' : 's'} due today \u2014 want to focus on them?`,
      buttonLabel: 'Plan my day',
    }
  }

  return { message: 'Pick your top priorities', buttonLabel: 'Plan my day' }
}

export function MyDayScreen() {
  const { data, isLoading, isError, error } = useMyDay()
  const toggleComplete = useToggleTaskComplete()
  const completeHabit = useCompleteHabit()
  const updateTask = useUpdateTask()
  const reorderFocusTasks = useReorderFocusTasks()
  const timeOfDay = getTimeOfDay()
  const [pickerOpen, setPickerOpen] = useState(false)

  const focusTasks = data?.focus_tasks ?? []
  const { items: orderedFocusTasks, getDragSourceProps, getDropTargetProps, dragOverIndex } =
    useDragReorder(focusTasks, (ids) => reorderFocusTasks.mutate(ids))

  if (isLoading) {
    return (
      <PageCard id="my-day-screen" ariaLabel="My Day">
        <div id="my-day-loading" className="my-day__state">Loading…</div>
      </PageCard>
    )
  }

  if (isError) {
    return (
      <PageCard id="my-day-screen" ariaLabel="My Day">
        <div id="my-day-error" className="my-day__state my-day__state--error">
          {(error as Error)?.message || 'Failed to load My Day'}
        </div>
      </PageCard>
    )
  }

  const metrics = data!.metrics
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

  const visibleHabits = data!.habits.slice(0, 4)
  const visibleReminders = data!.upcoming_reminders.slice(0, 3)
  const nudgeMessage = getNudgeMessage(metrics, timeOfDay)
  const eveningAllDone =
    timeOfDay === 'evening' && metrics.focus_total > 0 && remaining === 0

  const cta = getPlanMyDayCta(metrics.focus_total, metrics.focus_completed, data!.tasks_due_today_count)

  function handleToggle(task: Task) {
    toggleComplete.mutate({ id: task.id, currentStatus: task.status })
  }

  function handleRemoveFromFocus(taskId: number) {
    updateTask.mutate({ id: taskId, payload: { focus_date: null } })
  }

  function handleCompleteHabit(habit: Habit) {
    completeHabit.mutate({ id: habit.id })
  }

  function habitsSection() {
    return (
      <CollapsibleSection
        sectionKey="habits"
        title="Habits"
        count={metrics.habits_remaining}
      >
        {visibleHabits.length > 0 ? (
          <ul id="my-day-habit-list" className="my-day__habit-list">
            {visibleHabits.map((habit) => (
              <MyDayHabitItem
                key={habit.id}
                habit={habit}
                onComplete={handleCompleteHabit}
              />
            ))}
          </ul>
        ) : (
          <p id="my-day-habits-empty" className="my-day__empty">No habits remaining.</p>
        )}
        {data!.habits.length > 4 && (
          <Link id="my-day-habits-show-all" to="/habits" className="my-day__show-all-link">
            Show all
          </Link>
        )}
      </CollapsibleSection>
    )
  }

  function remindersSection() {
    return (
      <CollapsibleSection
        sectionKey="reminders"
        title="Reminders"
        count={metrics.upcoming_reminder_count}
      >
        {visibleReminders.length > 0 ? (
          <ul id="my-day-reminder-list" className="my-day__reminder-list">
            {visibleReminders.map((reminder) => (
              <MyDayReminderItem key={reminder.id} reminder={reminder} />
            ))}
          </ul>
        ) : (
          <p id="my-day-reminders-empty" className="my-day__empty">No upcoming reminders.</p>
        )}
        {data!.upcoming_reminders.length > 3 && (
          <Link id="my-day-reminders-show-all" to="/reminders" className="my-day__show-all-link">
            See all
          </Link>
        )}
      </CollapsibleSection>
    )
  }

  return (
    <PageCard id="my-day-screen" ariaLabel="My Day">
      <header id="my-day-header" className="my-day__header">
        <h1 id="my-day-greeting" className="my-day__greeting">{getGreeting()}</h1>
        <span id="my-day-date" className="my-day__date">{dateStr}</span>
        <div id="my-day-badges" className="my-day__badges">
          <span id="my-day-badge-focus" className="my-day__badge">
            Focus: {metrics.focus_completed}/{metrics.focus_total}
          </span>
          <span id="my-day-badge-habits" className="my-day__badge">
            Habits: {metrics.habits_remaining}
          </span>
          <span id="my-day-badge-reminders" className="my-day__badge">
            Reminders: {metrics.upcoming_reminder_count}
          </span>
        </div>
      </header>

      <section id="my-day-focus-section" aria-labelledby="my-day-focus-title">
        <h2 id="my-day-focus-title" className="my-day__section-title">
          Today's Focus
        </h2>

        {eveningAllDone ? (
          <p id="my-day-focus-summary" className="my-day__focus-summary">
            You completed all {metrics.focus_total} focus{' '}
            {metrics.focus_total === 1 ? 'task' : 'tasks'} today.
          </p>
        ) : orderedFocusTasks.length > 0 ? (
          <ul id="my-day-focus-list" className="my-day__focus-list">
            {orderedFocusTasks.map((task, index) => (
              <MyDayFocusItem
                key={task.id}
                task={task}
                onToggleComplete={handleToggle}
                onRemoveFromFocus={handleRemoveFromFocus}
                dragSourceProps={getDragSourceProps(index)}
                dropTargetProps={getDropTargetProps(index)}
                isDragOver={dragOverIndex === index}
                data-index={index}
              />
            ))}
          </ul>
        ) : (
          <p id="my-day-focus-empty" className="my-day__empty">
            No focus tasks yet. What's most important today?
          </p>
        )}

        {!cta && (
          <button
            id="my-day-add-focus-btn"
            type="button"
            className="my-day__add-focus-btn"
            onClick={() => setPickerOpen(true)}
          >
            + Add to Focus
          </button>
        )}

        <FocusPickerDialog
          open={pickerOpen}
          currentFocusIds={focusTasks.map((t) => t.id)}
          onClose={() => setPickerOpen(false)}
        />
      </section>

      {metrics.focus_total > 0 && (
        <div id="my-day-progress" className="my-day__progress">
          <p id="my-day-progress-text" className="my-day__progress-text">
            {remaining === 0
              ? 'All done!'
              : `${metrics.focus_completed} down, ${remaining} to go`}
          </p>
          <div id="my-day-progress-bar" className="my-day__progress-bar">
            <div
              id="my-day-progress-fill"
              className={`my-day__progress-fill${pct >= 100 ? ' my-day__progress-fill--complete' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {cta && (
        <div id="my-day-cta" className="my-day__cta" aria-live="polite">
          {remaining === 0 && metrics.focus_total > 0 && (
            <svg id="my-day-celebration-icon" className="my-day__celebration-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline id="my-day-celebration-checkmark" points="20 6 9 17 4 12" />
            </svg>
          )}
          <p id="my-day-cta-text" className="my-day__cta-text">{cta.message}</p>
          <button
            id="my-day-cta-btn"
            type="button"
            className="my-day__cta-btn"
            onClick={() => setPickerOpen(true)}
          >
            {cta.buttonLabel}
          </button>
        </div>
      )}

      {nudgeMessage && (
        <div id="my-day-nudge" className="my-day__nudge" role="status">
          <p id="my-day-nudge-text" className="my-day__nudge-text">{nudgeMessage}</p>
        </div>
      )}

      {timeOfDay === 'afternoon'
        ? (
            <>
              {remindersSection()}
              {habitsSection()}
            </>
          )
        : (
            <>
              {habitsSection()}
              {remindersSection()}
            </>
          )}
    </PageCard>
  )
}
