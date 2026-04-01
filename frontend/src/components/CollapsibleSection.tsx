import { useState, type ReactNode } from 'react'
import './CollapsibleSection.css'

interface CollapsibleSectionProps {
  sectionKey: string
  title: string
  count: number
  children: ReactNode
}

const STORAGE_PREFIX = 'nudgly_section_'

function loadCollapsed(key: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key) === '1'
  } catch {
    return false
  }
}

function saveCollapsed(key: string, collapsed: boolean): void {
  try {
    if (collapsed) {
      localStorage.setItem(STORAGE_PREFIX + key, '1')
    } else {
      localStorage.removeItem(STORAGE_PREFIX + key)
    }
  } catch {
    // ignore
  }
}

export function CollapsibleSection({
  sectionKey,
  title,
  count,
  children,
}: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useState(() => loadCollapsed(sectionKey))
  const bodyId = `collapsible-${sectionKey}-body`

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    saveCollapsed(sectionKey, next)
  }

  return (
    <section
      className={`collapsible-section${collapsed ? ' collapsible-section--collapsed' : ''}`}
    >
      <div className="collapsible-section__header">
        <h2 id={`collapsible-${sectionKey}-title`} className="collapsible-section__title">{title}</h2>
        <span className="collapsible-section__count">{count}</span>
        <button
          type="button"
          className="collapsible-section__toggle"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={toggle}
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
        >
          <svg
            className="collapsible-section__chevron"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M7 4l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <div
        id={bodyId}
        className="collapsible-section__body"
        role="region"
        aria-labelledby={`collapsible-${sectionKey}-title`}
      >
        <div className="collapsible-section__body-inner">{children}</div>
      </div>
    </section>
  )
}
