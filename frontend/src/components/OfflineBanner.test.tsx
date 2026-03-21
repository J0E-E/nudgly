import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OfflineBanner } from './OfflineBanner'

vi.mock('../hooks/useOnlineStatus', () => ({
  useOnlineStatus: vi.fn(),
}))

import { useOnlineStatus } from '../hooks/useOnlineStatus'

describe('OfflineBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when online', () => {
    vi.mocked(useOnlineStatus).mockReturnValue(true)
    const { container } = render(<OfflineBanner />)
    expect(container.innerHTML).toBe('')
  })

  it('renders banner when offline', () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    render(<OfflineBanner />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
  })
})
