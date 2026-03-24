import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './useAuth'
import type { Notification } from '../types/notification'
import { listNotifications, getUnreadCount, markRead, markAllRead } from '../services/notificationApi'

interface NotificationContextValue {
  unreadCount: number
  notifications: Notification[]
  addNotification: (n: Notification) => void
  handleMarkRead: (id: number) => Promise<void>
  handleMarkAllRead: () => Promise<void>
  refreshNotifications: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, getApiDeps } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])

  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticated) return
    const deps = getApiDeps()
    const [listRes, countRes] = await Promise.all([
      listNotifications(deps, { limit: 50 }),
      getUnreadCount(deps),
    ])
    setNotifications(listRes.results)
    setUnreadCount(countRes.count)
  }, [isAuthenticated, getApiDeps])

  useEffect(() => {
    refreshNotifications()
  }, [refreshNotifications])

  const addNotification = useCallback((n: Notification) => {
    setNotifications(prev => [n, ...prev])
    setUnreadCount(prev => prev + 1)
  }, [])

  const handleMarkRead = useCallback(async (id: number) => {
    const deps = getApiDeps()
    await markRead(deps, id)
    setNotifications(prev => {
      const wasUnread = prev.some(n => n.id === id && !n.read_at)
      if (wasUnread) {
        setUnreadCount(c => Math.max(0, c - 1))
      }
      return prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
    })
  }, [getApiDeps])

  const handleMarkAllRead = useCallback(async () => {
    const deps = getApiDeps()
    await markAllRead(deps)
    setNotifications(prev =>
      prev.map(n => n.read_at ? n : { ...n, read_at: new Date().toISOString() })
    )
    setUnreadCount(0)
  }, [getApiDeps])

  const value: NotificationContextValue = {
    unreadCount,
    notifications,
    addNotification,
    handleMarkRead,
    handleMarkAllRead,
    refreshNotifications,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
