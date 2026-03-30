export type TimeOfDay = 'morning' | 'afternoon' | 'evening'

export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours()
  if (hour >= 5 && hour <= 11) return 'morning'
  if (hour >= 12 && hour <= 16) return 'afternoon'
  return 'evening'
}

export function getGreeting(date: Date = new Date()): string {
  const tod = getTimeOfDay(date)
  if (tod === 'morning') return 'Good morning'
  if (tod === 'afternoon') return 'Good afternoon'
  return 'Good evening'
}
