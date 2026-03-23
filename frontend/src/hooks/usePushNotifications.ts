/**
 * Hook to register for push notifications via Capacitor.
 * Call after successful authentication. Handles permission prompt
 * and device token registration with the backend.
 */

import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { useAuth } from '../contexts/useAuth'
import * as deviceApi from '../services/deviceApi'

export function usePushNotifications() {
  const { isAuthenticated, getApiDeps } = useAuth()
  const registeredRef = useRef(false)
  const [permissionDenied, setPermissionDenied] = useState(false)

  // Reset registration state on logout so next login re-registers.
  useEffect(() => {
    if (!isAuthenticated) {
      registeredRef.current = false
      setPermissionDenied(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated || registeredRef.current) return
    if (!Capacitor.isNativePlatform()) return

    const platform = Capacitor.getPlatform() as 'ios' | 'android'

    // Add listeners BEFORE calling register() to avoid a race where
    // the registration event fires before listeners are attached.
    PushNotifications.addListener('registration', async (token) => {
      try {
        await deviceApi.registerDevice(getApiDeps(), token.value, platform)
        registeredRef.current = true
      } catch (err) {
        console.error('Failed to register device token:', err)
      }
    })

    PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error)
    })

    async function register() {
      const permission = await PushNotifications.requestPermissions()
      if (permission.receive !== 'granted') {
        setPermissionDenied(true)
        return
      }

      await PushNotifications.register()
    }

    register()

    return () => {
      PushNotifications.removeAllListeners()
    }
  }, [isAuthenticated, getApiDeps])

  return { permissionDenied }
}
