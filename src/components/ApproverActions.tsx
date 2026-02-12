import { useState } from 'react'
import type { Solicitud } from '../types/solicitudes'

export type ApproverActionsProps = {
  solicitud: Solicitud
  onAccion: (estado: Solicitud['estado'], comentario?: string) => void
}

export function ApproverActions({ solicitud, onAccion }: ApproverActionsProps) {
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleAction(estado: Solicitud['estado']) {
    if ((estado === 'Observada' || estado === 'Rechazada') && !comentario.trim()) {
      setError('Comment required to request changes or reject')
      return
    }
    setError(null)
    onAccion(estado, comentario.trim() || undefined)
    setComentario('')
  }

  return (
    <section className="drawer__section">
      <h4>Actions</h4>
      <div className="actions-grid">
        <button className="ui-button ui-button--primary" onClick={() => handleAction('Aprobada')}>
          Approve
        </button>
        <button className="ui-button ui-button--secondary" onClick={() => handleAction('Observada')}>
          Request changes
        </button>
        <button className="ui-button ui-button--ghost" onClick={() => handleAction('Rechazada')}>
          Reject
        </button>
      </div>
      <label className="ui-input">
        <span className="ui-input__label">Comments / Suggested changes</span>
        <textarea
          className="ui-input__control"
          value={comentario}
          rows={3}
          placeholder="Describe adjustments or reason"
          onChange={(e) => setComentario(e.target.value)}
        />
      </label>
      {error && <p className="error-text">{error}</p>}
      <p className="muted">Current status: {solicitud.estado}</p>
    </section>
  )
}
