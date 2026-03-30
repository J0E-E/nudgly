/**
 * Types for the My Day aggregation endpoint: GET /api/my-day/.
 */

import type { Task } from './task'
import type { Habit } from './habit'

export interface UpcomingReminder {
  id: number
  name: string
  next_trigger_at: string
  recurrence: string | null
}

export interface MyDayMetrics {
  focus_total: number
  focus_completed: number
  habits_remaining: number
  upcoming_reminder_count: number
}

export interface MyDayResponse {
  focus_tasks: Task[]
  habits: Habit[]
  upcoming_reminders: UpcomingReminder[]
  metrics: MyDayMetrics
  tasks_due_today_count: number
}
