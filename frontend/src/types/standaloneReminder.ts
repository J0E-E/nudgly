export const ReminderRecurrence = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const

export type ReminderRecurrence = (typeof ReminderRecurrence)[keyof typeof ReminderRecurrence]

export const RECURRENCE_LABELS: Record<ReminderRecurrence, string> = {
  [ReminderRecurrence.DAILY]: 'Daily',
  [ReminderRecurrence.WEEKLY]: 'Weekly',
  [ReminderRecurrence.MONTHLY]: 'Monthly',
  [ReminderRecurrence.YEARLY]: 'Yearly',
}

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  0: 'Monday',
  1: 'Tuesday',
  2: 'Wednesday',
  3: 'Thursday',
  4: 'Friday',
  5: 'Saturday',
  6: 'Sunday',
}

export const MONTH_LABELS: Record<number, string> = {
  1: 'January',
  2: 'February',
  3: 'March',
  4: 'April',
  5: 'May',
  6: 'June',
  7: 'July',
  8: 'August',
  9: 'September',
  10: 'October',
  11: 'November',
  12: 'December',
}

export const SNOOZE_PRESETS = [5, 15, 30, 60] as const
export type SnoozePreset = (typeof SNOOZE_PRESETS)[number]

export const SNOOZE_PRESET_LABELS: Record<SnoozePreset, string> = {
  5: '5 min',
  15: '15 min',
  30: '30 min',
  60: '1 hour',
}

export interface ReminderInstance {
  id: number
  reminder_id: number
  due_at: string
  cleared_at: string | null
  snoozed_until: string | null
  created_at: string
}

export interface StandaloneReminder {
  id: number
  name: string
  remind_at: string | null
  remind_time: string | null
  recurrence: ReminderRecurrence | null
  day_of_week: number | null
  day_of_month: number | null
  month_of_year: number | null
  is_active: boolean
  created_at: string
  latest_instance: ReminderInstance | null
  next_trigger_at: string | null
}

export interface StandaloneReminderListResponse {
  count: number
  limit: number
  offset: number
  results: StandaloneReminder[]
}

export interface StandaloneReminderCreatePayload {
  name: string
  recurrence?: ReminderRecurrence | null
  remind_at?: string | null
  remind_time?: string | null
  day_of_week?: number | null
  day_of_month?: number | null
  month_of_year?: number | null
}

export interface StandaloneReminderUpdatePayload {
  name?: string
  recurrence?: ReminderRecurrence | null
  remind_at?: string | null
  remind_time?: string | null
  day_of_week?: number | null
  day_of_month?: number | null
  month_of_year?: number | null
  is_active?: boolean
}

export interface SnoozePayload {
  snooze_minutes: SnoozePreset
}
