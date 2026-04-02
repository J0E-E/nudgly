import type { ReactNode } from 'react'
import './PageCard.css'

interface PageCardProps {
  id?: string
  ariaLabel?: string
  noCard?: boolean
  cardPadding?: string
  children: ReactNode
}

export function PageCard({
  id,
  ariaLabel,
  noCard,
  cardPadding,
  children,
}: PageCardProps) {
  return (
    <main id={id} className="page-card" aria-label={ariaLabel}>
      {noCard ? (
        children
      ) : (
        <div
          id={id ? `${id}-card` : undefined}
          className="page-card__card"
          style={
            cardPadding !== undefined
              ? ({ '--page-card-padding': cardPadding } as React.CSSProperties)
              : undefined
          }
        >
          {children}
        </div>
      )}
    </main>
  )
}
