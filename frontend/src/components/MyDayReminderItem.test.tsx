import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MyDayReminderItem, formatRelativeTime } from './MyDayReminderItem'

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Past due" for past times', () => {
    vi.useFakeTimers({ now: new Date('2026-03-30T14:00:00Z') })
    expect(formatRelativeTime('2026-03-30T13:00:00Z')).toBe('Past due')
  })

  it('returns "Any moment" for < 1 min away', () => {
    vi.useFakeTimers({ now: new Date('2026-03-30T14:00:00Z') })
    expect(formatRelativeTime('2026-03-30T14:00:20Z')).toBe('Any moment')
  })

  it('returns "In N min" for < 60 min', () => {
    vi.useFakeTimers({ now: new Date('2026-03-30T14:00:00Z') })
    expect(formatRelativeTime('2026-03-30T14:15:00Z')).toBe('In 15 min')
  })

  it('returns "In 1 hour" for singular hour', () => {
    vi.useFakeTimers({ now: new Date('2026-03-30T14:00:00Z') })
    expect(formatRelativeTime('2026-03-30T15:00:00Z')).toBe('In 1 hour')
  })

  it('returns "In N hours" for plural hours', () => {
    vi.useFakeTimers({ now: new Date('2026-03-30T14:00:00Z') })
    expect(formatRelativeTime('2026-03-30T17:00:00Z')).toBe('In 3 hours')
  })

  it('returns "Tomorrow" for > 24 hours', () => {
    vi.useFakeTimers({ now: new Date('2026-03-30T14:00:00Z') })
    expect(formatRelativeTime('2026-03-31T16:00:00Z')).toBe('Tomorrow')
  })
})

describe('MyDayReminderItem', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders reminder name and relative time', () => {
    vi.useFakeTimers({ now: new Date('2026-03-30T13:00:00Z') })
    render(
      <MyDayReminderItem
        reminder={{
          id: 1,
          name: 'Standup',
          next_trigger_at: '2026-03-30T15:00:00Z',
          recurrence: 'daily',
        }}
      />,
    )
    expect(screen.getByText('Standup')).toBeInTheDocument()
    expect(screen.getByText('In 2 hours')).toBeInTheDocument()
  })
})
