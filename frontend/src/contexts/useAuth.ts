/**
 * Hook to read auth context. Use within AuthProvider only.
 */
import { useContext } from 'react'
import { AuthContext } from './authContext.types'
import type { AuthContextValue } from './authContext.types'

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
