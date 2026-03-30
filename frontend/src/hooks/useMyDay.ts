/**
 * TanStack Query hook for the My Day aggregation endpoint.
 */

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/useAuth'
import * as myDayApi from '../services/myDayApi'

export const myDayKeys = {
  all: ['myDay'] as const,
  detail: () => [...myDayKeys.all, 'detail'] as const,
}

export function useMyDay() {
  const { getApiDeps } = useAuth()
  return useQuery({
    queryKey: myDayKeys.detail(),
    queryFn: () => myDayApi.getMyDay(getApiDeps()),
    staleTime: 60_000,
    refetchInterval: 300_000,
  })
}
