import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { HealthScreen } from './HealthScreen'
import { useHealth } from '../hooks/useHealth'

vi.mock('../hooks/useHealth')

const mockUseHealth = vi.mocked(useHealth)

describe('HealthScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows API, database, and redis status when health is ok', async () => {
    mockUseHealth.mockReturnValue({
      data: { status: 'ok', database: 'ok', redis: 'ok' },
      error: null,
      loading: false,
      refetch: vi.fn(),
    })

    render(<HealthScreen />)

    await waitFor(() => {
      expect(screen.getByTestId('health-api-status')).toHaveTextContent(
        'API: ok'
      )
    })
    expect(screen.getByTestId('health-database-status')).toHaveTextContent(
      'Database: ok'
    )
    expect(screen.getByTestId('health-redis-status')).toHaveTextContent(
      'Redis: ok'
    )
  })

  it('shows error message when health fetch fails', () => {
    mockUseHealth.mockReturnValue({
      data: null,
      error: 'Network error',
      loading: false,
      refetch: vi.fn(),
    })

    render(<HealthScreen />)

    expect(screen.getByTestId('health-error')).toHaveTextContent(
      'Network error'
    )
  })

  it('shows loading state initially when loading', () => {
    mockUseHealth.mockReturnValue({
      data: null,
      error: null,
      loading: true,
      refetch: vi.fn(),
    })

    render(<HealthScreen />)

    expect(screen.getByTestId('health-loading')).toBeInTheDocument()
  })

  it('has unique descriptive IDs for accessibility and selectors', () => {
    mockUseHealth.mockReturnValue({
      data: { status: 'ok', database: 'ok', redis: 'ok' },
      error: null,
      loading: false,
      refetch: vi.fn(),
    })

    render(<HealthScreen />)

    expect(
      document.getElementById('health-screen-container')
    ).toBeInTheDocument()
    expect(document.getElementById('health-screen-title')).toHaveTextContent(
      'Nudgly'
    )
    expect(document.getElementById('health-refresh-btn')).toBeInTheDocument()
  })
})
