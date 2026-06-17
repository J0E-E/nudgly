export const TaskCategory = {
  PERSONAL: 'personal',
  LIFE_ADMIN: 'life_admin',
  WORK: 'work',
  SOCIAL: 'social',
} as const

export type TaskCategory = (typeof TaskCategory)[keyof typeof TaskCategory]

export const TaskStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus]

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  [TaskCategory.PERSONAL]: 'Personal',
  [TaskCategory.LIFE_ADMIN]: 'Life Admin',
  [TaskCategory.WORK]: 'Work',
  [TaskCategory.SOCIAL]: 'Social',
}

export const RecurringOptions = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const

export type RecurringOption = (typeof RecurringOptions)[keyof typeof RecurringOptions]

export const RECURRING_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

export const TASK_PRIORITY_LABELS: Record<number, string> = {
  0: 'None',
  1: 'Low',
  2: 'Medium',
  3: 'High',
}

export interface UserSummary {
  id: number
  username: string
  display_name: string
}

export interface Task {
  id: number
  title: string
  description: string
  due_date: string | null
  due_time: string | null
  category: TaskCategory
  tag: string
  priority: number
  recurring: string | null
  stack_count: number
  status: TaskStatus
  muted_until: string | null
  created_at: string
  completed_at: string | null
  list_id: number | null
  focus_date: string | null
  focus_sort_order: number
  created_by: UserSummary | null
  linked_friends: UserSummary[]
}

export interface TaskListResponse {
  count: number
  limit: number
  offset: number
  results: Task[]
}

export interface TaskCreatePayload {
  title: string
  category: TaskCategory
  description?: string
  due_date?: string | null
  due_time?: string | null
  tag?: string
  priority?: number
  recurring?: string | null
  status?: TaskStatus
  muted_until?: string | null
  list_id?: number | null
  focus_date?: string | null
  created_for_user_id?: number | null
  linked_friend_ids?: number[]
}

export type MutePreset = '1h' | '1d' | '1wk'

export const MUTE_PRESET_LABELS: Record<MutePreset, string> = {
  '1h': '1 Hour',
  '1d': '1 Day',
  '1wk': '1 Week',
}

export interface TaskSchedule {
  id: number
  next_trigger_at: string
  retry_interval_minutes: number
  max_attempts: number
  attempt_count: number
  is_active: boolean
  created_at: string
}

export interface TaskUpdatePayload {
  title?: string
  description?: string
  due_date?: string | null
  due_time?: string | null
  category?: TaskCategory
  tag?: string
  priority?: number
  recurring?: string | null
  status?: TaskStatus
  muted_until?: string | null
  mute_preset?: MutePreset
  list_id?: number | null
  focus_date?: string | null
  focus_sort_order?: number
  linked_friend_ids?: number[]
}
