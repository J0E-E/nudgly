import { useCallback, useRef } from 'react'

/**
 * Plays a short two-tone chime using the Web Audio API.
 * No audio files required — synthesized at runtime.
 */
export function useNotificationSound() {
  const ctxRef = useRef<AudioContext | null>(null)

  const play = useCallback(() => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext()
      }
      const ctx = ctxRef.current
      const now = ctx.currentTime

      // Two-tone chime: C5 then E5
      const frequencies = [523.25, 659.25]
      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.15, now + i * 0.15)
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.3)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + i * 0.15)
        osc.stop(now + i * 0.15 + 0.3)
      })
    } catch {
      // Audio not available — silently skip.
    }
  }, [])

  return { play }
}
