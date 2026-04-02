import { usePushNotifications } from '../hooks/usePushNotifications'

/**
 * Invisible component that registers device for push notifications
 * when the user is authenticated on a native platform.
 * Shows a hint if the user denied notification permission.
 */
export function PushNotificationRegistrar() {
  const { permissionDenied } = usePushNotifications()

  if (permissionDenied) {
    return (
      <div id="push-notification-denied-banner" style={{ padding: '8px 16px', background: '#fff3cd', color: '#856404', fontSize: '0.85rem', textAlign: 'center' }}>
        Notifications are disabled. Enable them in your device settings to receive reminders.
      </div>
    )
  }

  return null
}
