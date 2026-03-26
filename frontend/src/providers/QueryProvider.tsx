/**
 * TanStack Query provider: configures QueryClient with caching, retry, and
 * online-manager for offline resilience. Wrap the app in this provider.
 *
 * TODO: Integrate Capacitor Network plugin for better mobile offline detection.
 * Currently uses navigator.onLine which has limitations on native platforms.
 */

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from '@tanstack/react-query'
import type { ReactNode } from 'react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
})

onlineManager.setEventListener((setOnline) => {
  const onlineHandler = () => setOnline(true)
  const offlineHandler = () => setOnline(false)
  window.addEventListener('online', onlineHandler)
  window.addEventListener('offline', offlineHandler)
  return () => {
    window.removeEventListener('online', onlineHandler)
    window.removeEventListener('offline', offlineHandler)
  }
})

export { queryClient }

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
