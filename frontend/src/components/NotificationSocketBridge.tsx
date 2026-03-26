import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/useAuth'
import { useNotificationSocket } from '../hooks/useNotificationSocket'
import { useNotifications } from '../contexts/NotificationContext'
import { useToast } from '../contexts/ToastContext'
import { useBrowserNotifications } from '../hooks/useBrowserNotifications'
import { useNotificationSound } from '../hooks/useNotificationSound'
import { friendKeys } from '../hooks/useFriends'
import type { Notification, SocketMessage } from '../types/notification'

export function NotificationSocketBridge() {
  const { isAuthenticated } = useAuth()
  const { addNotification } = useNotifications()
  const { addToast } = useToast()
  const { showBrowserNotification } = useBrowserNotifications()
  const { play: playSound } = useNotificationSound()
  const queryClient = useQueryClient()

  useNotificationSocket({
    onMessage: (message: SocketMessage) => {
      if (message.msg_type === 'friend_event') {
        addToast({ title: message.title, body: message.body })
        playSound()
        showBrowserNotification(message.title, message.body)
        queryClient.invalidateQueries({ queryKey: friendKeys.all })
      } else {
        const notification = message as Notification
        addNotification(notification)
        addToast({
          title: notification.title,
          body: notification.body,
          taskId: notification.schedule_id,
        })
        playSound()
        showBrowserNotification(notification.title, notification.body)
      }
    },
  })

  if (!isAuthenticated) return null
  return null
}
