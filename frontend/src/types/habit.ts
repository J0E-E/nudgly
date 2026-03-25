export const HabitFrequency = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
} as const

export type HabitFrequency = (typeof HabitFrequency)[keyof typeof HabitFrequency]

export const HABIT_FREQUENCY_LABELS: Record<HabitFrequency, string> = {
  [HabitFrequency.DAILY]: 'Daily',
  [HabitFrequency.WEEKLY]: 'Weekly',
  [HabitFrequency.MONTHLY]: 'Monthly',
}

export interface Habit {
  id: number
  name: string
  frequency: HabitFrequency
  target_count: number
  reminder_times: string[]
  streak_count: number
  last_completed_at: string | null
  created_at: string
  period_completions: number
  next_reminder_at: string | null
}

export interface HabitListResponse {
  count: number
  limit: number
  offset: number
  results: Habit[]
}

export interface HabitCreatePayload {
  name: string
  frequency: HabitFrequency
  target_count?: number
  reminder_times?: string[]
}

export interface HabitUpdatePayload {
  name?: string
  frequency?: HabitFrequency
  target_count?: number
  reminder_times?: string[]
}

export interface HabitCompletion {
  id: number
  habit_id: number
  completed_at: string
  skipped: boolean
}

export interface HabitCompletePayload {
  skipped?: boolean
}
