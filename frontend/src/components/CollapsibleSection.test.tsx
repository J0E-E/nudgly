import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CollapsibleSection } from './CollapsibleSection'

describe('CollapsibleSection', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders title, count, and children when expanded (default)', () => {
    render(
      <CollapsibleSection sectionKey="test" title="Habits" count={3}>
        <p>Child content</p>
      </CollapsibleSection>,
    )
    expect(
      screen.getByRole('heading', { level: 2, name: 'Habits' }),
    ).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Child content')).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('collapses on toggle click', () => {
    render(
      <CollapsibleSection sectionKey="test" title="Habits" count={3}>
        <p>Child content</p>
      </CollapsibleSection>,
    )
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  it('reads initial collapsed state from localStorage', () => {
    localStorage.setItem('nudgly_section_habits', '1')
    render(
      <CollapsibleSection sectionKey="habits" title="Habits" count={2}>
        <p>Content</p>
      </CollapsibleSection>,
    )
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('writes to localStorage on toggle', () => {
    render(
      <CollapsibleSection sectionKey="habits" title="Habits" count={2}>
        <p>Content</p>
      </CollapsibleSection>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(localStorage.getItem('nudgly_section_habits')).toBe('1')

    fireEvent.click(screen.getByRole('button'))
    expect(localStorage.getItem('nudgly_section_habits')).toBeNull()
  })

  it('falls back to expanded when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    render(
      <CollapsibleSection sectionKey="test" title="Title" count={0}>
        <p>Content</p>
      </CollapsibleSection>,
    )
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })
})
