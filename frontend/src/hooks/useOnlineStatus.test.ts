import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOnlineStatus } from './useOnlineStatus'

describe('useOnlineStatus', () => {
  const originalOnLine = navigator.onLine
  let listeners: Record<string, (() => void)[]>

  beforeEach(() => {
    listeners = { online: [], offline: [] }
    vi.spyOn(window, 'addEventListener').mockImplementation(
      (event, handler) => {
        if (event in listeners) {
          listeners[event].push(handler as () => void)
        }
      }
    )
    vi.spyOn(window, 'removeEventListener').mockImplementation(
      (event, handler) => {
        if (event in listeners) {
          listeners[event] = listeners[event].filter((h) => h !== handler)
        }
      }
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      writable: true,
      configurable: true,
    })
  })

  it('returns true when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)
  })

  it('returns false when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)
  })

  it('updates to false when offline event fires', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)

    act(() => {
      listeners.offline.forEach((fn) => fn())
    })
    expect(result.current).toBe(false)
  })

  it('updates to true when online event fires', () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)

    act(() => {
      listeners.online.forEach((fn) => fn())
    })
    expect(result.current).toBe(true)
  })

  it('cleans up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useOnlineStatus())
    expect(listeners.online).toHaveLength(1)
    expect(listeners.offline).toHaveLength(1)

    unmount()
    expect(listeners.online).toHaveLength(0)
    expect(listeners.offline).toHaveLength(0)
  })
})
