import type { MyDayMetrics } from '../types/myDay'
import type { TimeOfDay } from './timeOfDay'

export function getNudgeMessage(
  metrics: MyDayMetrics,
  timeOfDay: TimeOfDay,
): string | null {
  const { focus_total, focus_completed, habits_remaining, upcoming_reminder_count } = metrics
  const focusDone = focus_total > 0 && focus_completed === focus_total
  const remaining = focus_total - focus_completed

  if (focusDone && habits_remaining === 0 && upcoming_reminder_count === 0) {
    return 'All caught up! Enjoy your day.'
  }
  if (timeOfDay === 'evening' && focusDone) {
    return 'Great day! Focus tasks complete.'
  }
  if (remaining === 1 && habits_remaining === 0) {
    return 'Almost done -- just 1 task left!'
  }
  if (focusDone && habits_remaining > 0) {
    return 'Quick win? Complete a habit!'
  }
  if (timeOfDay === 'morning' && habits_remaining > 0 && focus_completed === 0) {
    return 'Quick win? Complete a habit to build momentum!'
  }
  if (timeOfDay === 'afternoon' && remaining >= 1 && remaining <= 2) {
    return remaining === 1
      ? 'Just 1 focus task to go!'
      : 'Just 2 focus tasks to go!'
  }
  return null
}
