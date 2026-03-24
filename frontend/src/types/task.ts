export const TaskCategory = {
  TREAT_MYSELF: 'treat_myself',
  GLOW_UP: 'glow_up',
  ADULTING: 'adulting',
  I_SAID_I_WOULD: 'i_said_i_would',
  THE_INEVITABLE: 'the_inevitable',
} as const

export type TaskCategory = (typeof TaskCategory)[keyof typeof TaskCategory]

export const TaskStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus]

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  [TaskCategory.TREAT_MYSELF]: 'Treat myself',
  [TaskCategory.GLOW_UP]: 'Glow up',
  [TaskCategory.ADULTING]: 'Adulting',
  [TaskCategory.I_SAID_I_WOULD]: 'I said I would',
  [TaskCategory.THE_INEVITABLE]: 'The inevitable',
}

export const TASK_PRIORITY_LABELS: Record<number, string> = {
  0: 'No one cares',
  1: 'No one is watching',
  2: "I'll feel guilty",
  3: 'Others are watching',
  4: 'Others will be let down',
  5: "I'll let myself down",
}

export interface Task {
  id: number
  title: string
  description: string
  due_date: string | null
  category: TaskCategory
  tag: string
  priority: number
  recurring: string | null
  status: TaskStatus
  muted_until: string | null
  created_at: string
  completed_at: string | null
  list_id: number | null
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
  tag?: string
  priority?: number
  recurring?: string | null
  status?: TaskStatus
  muted_until?: string | null
  list_id?: number | null
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
  category?: TaskCategory
  tag?: string
  priority?: number
  recurring?: string | null
  status?: TaskStatus
  muted_until?: string | null
  mute_preset?: MutePreset
  list_id?: number | null
}
