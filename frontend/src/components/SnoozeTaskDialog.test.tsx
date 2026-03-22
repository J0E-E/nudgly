import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SnoozeTaskDialog } from './SnoozeTaskDialog'

function renderDialog(overrides: Partial<Parameters<typeof SnoozeTaskDialog>[0]> = {}) {
  const props = {
    open: true,
    taskTitle: 'Buy groceries',
    isMuted: false,
    onSnooze: vi.fn(),
    onUnmute: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }
  render(<SnoozeTaskDialog {...props} />)
  return props
}

// Stub showModal / close for jsdom (no native <dialog> support)
beforeEach(() => {
  HTMLDialogElement.prototype.showModal =
    HTMLDialogElement.prototype.showModal ||
    vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    })
  HTMLDialogElement.prototype.close =
    HTMLDialogElement.prototype.close ||
    vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    })
})

describe('SnoozeTaskDialog', () => {
  it('renders title and task name', () => {
    renderDialog()
    expect(screen.getByText('Snooze task')).toBeInTheDocument()
    expect(screen.getByText('Buy groceries')).toBeInTheDocument()
  })

  it('renders all preset buttons', () => {
    renderDialog()
    expect(screen.getByText('1 Hour')).toBeInTheDocument()
    expect(screen.getByText('1 Day')).toBeInTheDocument()
    expect(screen.getByText('1 Week')).toBeInTheDocument()
  })

  it('calls onSnooze with 1h when clicking 1 Hour', () => {
    const { onSnooze } = renderDialog()
    fireEvent.click(screen.getByText('1 Hour'))
    expect(onSnooze).toHaveBeenCalledWith('1h')
  })

  it('calls onSnooze with 1d when clicking 1 Day', () => {
    const { onSnooze } = renderDialog()
    fireEvent.click(screen.getByText('1 Day'))
    expect(onSnooze).toHaveBeenCalledWith('1d')
  })

  it('calls onSnooze with 1wk when clicking 1 Week', () => {
    const { onSnooze } = renderDialog()
    fireEvent.click(screen.getByText('1 Week'))
    expect(onSnooze).toHaveBeenCalledWith('1wk')
  })

  it('shows Unmute button when isMuted is true', () => {
    renderDialog({ isMuted: true })
    expect(screen.getByText('Unmute')).toBeInTheDocument()
  })

  it('hides Unmute button when isMuted is false', () => {
    renderDialog({ isMuted: false })
    expect(screen.queryByText('Unmute')).not.toBeInTheDocument()
  })

  it('calls onUnmute when Unmute button clicked', () => {
    const { onUnmute } = renderDialog({ isMuted: true })
    fireEvent.click(screen.getByText('Unmute'))
    expect(onUnmute).toHaveBeenCalled()
  })

  it('calls onCancel when Cancel button clicked', () => {
    const { onCancel } = renderDialog()
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })
})
