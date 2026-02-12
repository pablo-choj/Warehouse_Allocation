import type { ReactNode } from 'react'

export type DecisionState = 'approved' | 'rejected' | 'pending' | 'info' | 'error'

export type DecisionCardProps = {
  status: DecisionState
  title: string
  description: string
  meta?: ReactNode
}

const statusCopy: Record<DecisionState, string> = {
  approved: 'decision-card--approved',
  rejected: 'decision-card--rejected',
  pending: 'decision-card--pending',
  info: 'decision-card--info',
  error: 'decision-card--error',
}

export function DecisionCard({ status, title, description, meta }: DecisionCardProps) {
  const classes = ['decision-card', statusCopy[status]].join(' ')

  return (
    <article className={classes}>
      <header>
        <p className="decision-card__status">{status.toUpperCase()}</p>
        <h3>{title}</h3>
      </header>
      <p className="decision-card__description">{description}</p>
      {meta && <div className="decision-card__meta">{meta}</div>}
    </article>
  )
}
