import { describe, it, expect } from 'vitest'
import { getNudgeMessage } from './nudgeCopy'
import type { MyDayMetrics } from '../types/myDay'

function m(overrides: Partial<MyDayMetrics> = {}): MyDayMetrics {
  return {
    focus_total: 3,
    focus_completed: 1,
    habits_remaining: 2,
    upcoming_reminder_count: 1,
    ...overrides,
  }
}

describe('getNudgeMessage', () => {
  it('returns "All caught up!" when everything is done', () => {
    const metrics = m({
      focus_completed: 3,
      habits_remaining: 0,
      upcoming_reminder_count: 0,
    })
    expect(getNudgeMessage(metrics, 'morning')).toBe(
      'All caught up! Enjoy your day.',
    )
  })

  it('returns evening focus complete message', () => {
    const metrics = m({ focus_completed: 3, habits_remaining: 1 })
    expect(getNudgeMessage(metrics, 'evening')).toBe(
      'Great day! Focus tasks complete.',
    )
  })

  it('returns "Almost done" when 1 focus task left and habits done', () => {
    const metrics = m({ focus_completed: 2, habits_remaining: 0 })
    expect(getNudgeMessage(metrics, 'morning')).toBe(
      'Almost done -- just 1 task left!',
    )
  })

  it('returns "Complete a habit" when focus done but habits remain', () => {
    const metrics = m({ focus_completed: 3, habits_remaining: 2 })
    expect(getNudgeMessage(metrics, 'morning')).toBe(
      'Quick win? Complete a habit!',
    )
  })

  it('returns morning momentum message when no focus progress', () => {
    const metrics = m({ focus_completed: 0, habits_remaining: 1 })
    expect(getNudgeMessage(metrics, 'morning')).toBe(
      'Quick win? Complete a habit to build momentum!',
    )
  })

  it('returns afternoon focus countdown for 1 remaining', () => {
    const metrics = m({ focus_completed: 2 })
    expect(getNudgeMessage(metrics, 'afternoon')).toBe(
      'Just 1 focus task to go!',
    )
  })

  it('returns afternoon focus countdown for 2 remaining', () => {
    const metrics = m({ focus_completed: 1 })
    expect(getNudgeMessage(metrics, 'afternoon')).toBe(
      'Just 2 focus tasks to go!',
    )
  })

  it('returns null when no rule matches', () => {
    const metrics = m({ focus_total: 0, focus_completed: 0, habits_remaining: 0 })
    expect(getNudgeMessage(metrics, 'afternoon')).toBeNull()
  })
})
