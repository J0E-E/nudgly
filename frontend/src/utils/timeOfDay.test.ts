import { describe, it, expect } from 'vitest'
import { getTimeOfDay, getGreeting } from './timeOfDay'

function dateAtHour(hour: number): Date {
  const d = new Date(2026, 2, 30) // March 30, 2026
  d.setHours(hour, 0, 0, 0)
  return d
}

describe('getTimeOfDay', () => {
  it('returns morning for hours 5-11', () => {
    expect(getTimeOfDay(dateAtHour(5))).toBe('morning')
    expect(getTimeOfDay(dateAtHour(8))).toBe('morning')
    expect(getTimeOfDay(dateAtHour(11))).toBe('morning')
  })

  it('returns afternoon for hours 12-16', () => {
    expect(getTimeOfDay(dateAtHour(12))).toBe('afternoon')
    expect(getTimeOfDay(dateAtHour(14))).toBe('afternoon')
    expect(getTimeOfDay(dateAtHour(16))).toBe('afternoon')
  })

  it('returns evening for hours 17-4', () => {
    expect(getTimeOfDay(dateAtHour(17))).toBe('evening')
    expect(getTimeOfDay(dateAtHour(21))).toBe('evening')
    expect(getTimeOfDay(dateAtHour(0))).toBe('evening')
    expect(getTimeOfDay(dateAtHour(4))).toBe('evening')
  })

  it('handles boundary hours correctly', () => {
    expect(getTimeOfDay(dateAtHour(4))).toBe('evening')
    expect(getTimeOfDay(dateAtHour(5))).toBe('morning')
    expect(getTimeOfDay(dateAtHour(11))).toBe('morning')
    expect(getTimeOfDay(dateAtHour(12))).toBe('afternoon')
    expect(getTimeOfDay(dateAtHour(16))).toBe('afternoon')
    expect(getTimeOfDay(dateAtHour(17))).toBe('evening')
  })
})

describe('getGreeting', () => {
  it('returns "Good morning" for morning hours', () => {
    expect(getGreeting(dateAtHour(8))).toBe('Good morning')
  })

  it('returns "Good afternoon" for afternoon hours', () => {
    expect(getGreeting(dateAtHour(14))).toBe('Good afternoon')
  })

  it('returns "Good evening" for evening hours', () => {
    expect(getGreeting(dateAtHour(20))).toBe('Good evening')
  })
})
