import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: false,
    title: 'Delete item',
    message: 'Are you sure?',
    confirmLabel: 'Delete',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock showModal/close since happy-dom may not support native dialog
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

  it('renders title and message', () => {
    render(<ConfirmDialog {...defaultProps} open={true} />)
    expect(screen.getByText('Delete item')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button clicked', () => {
    render(<ConfirmDialog {...defaultProps} open={true} />)
    fireEvent.click(screen.getByText('Delete'))
    expect(defaultProps.onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when cancel button clicked', () => {
    render(<ConfirmDialog {...defaultProps} open={true} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(defaultProps.onCancel).toHaveBeenCalledOnce()
  })

  it('has alertdialog role', () => {
    render(<ConfirmDialog {...defaultProps} open={true} />)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })
})
