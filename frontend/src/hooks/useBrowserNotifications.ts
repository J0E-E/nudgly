import { useCallback } from 'react'

function isSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function useBrowserNotifications() {
  const requestPermission = useCallback(async () => {
    if (!isSupported()) return
    if (Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  }, [])

  const showBrowserNotification = useCallback((title: string, body: string) => {
    if (!isSupported()) return
    if (Notification.permission !== 'granted') return
    new Notification(title, { body })
  }, [])

  return { requestPermission, showBrowserNotification }
}
