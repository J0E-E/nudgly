import { useAuth } from '../contexts/useAuth'
import { useNotificationSocket } from '../hooks/useNotificationSocket'
import { useNotifications } from '../contexts/NotificationContext'
import { useToast } from '../contexts/ToastContext'
import { useBrowserNotifications } from '../hooks/useBrowserNotifications'
import { useNotificationSound } from '../hooks/useNotificationSound'
import type { Notification } from '../types/notification'

export function NotificationSocketBridge() {
  const { isAuthenticated } = useAuth()
  const { addNotification } = useNotifications()
  const { addToast } = useToast()
  const { showBrowserNotification } = useBrowserNotifications()
  const { play: playSound } = useNotificationSound()

  useNotificationSocket({
    onMessage: (notification: Notification) => {
      addNotification(notification)
      addToast({
        title: notification.title,
        body: notification.body,
        taskId: notification.schedule_id,
      })
      playSound()
      showBrowserNotification(notification.title, notification.body)
    },
  })

  if (!isAuthenticated) return null
  return null
}
