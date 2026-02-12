import type { Solicitud } from '../types/solicitudes'
import { ApproverActions, type ApproverActionsProps } from './ApproverActions'

export type SolicitudDetailDrawerProps = {
  solicitud?: Solicitud
  open: boolean
  onClose: () => void
  onAccion: ApproverActionsProps['onAccion']
}

export function SolicitudDetailDrawer({ solicitud, open, onClose, onAccion }: SolicitudDetailDrawerProps) {
  if (!open || !solicitud) return null

  return (
    <aside className="drawer" aria-label={`Detail ${solicitud.id}`}>
      <header className="drawer__header">
        <div>
          <p className="eyebrow">Detail</p>
          <h3>{solicitud.id}</h3>
          <p className="muted">Customer {solicitud.cliente} · {solicitud.pais}</p>
        </div>
        <button className="ui-button ui-button--ghost" onClick={onClose}>Close</button>
      </header>

      <section className="drawer__section">
        <h4>Summary</h4>
        <p>{solicitud.comentariosSolicitante ?? 'No comments'}</p>
        <dl className="description-list">
          <div>
            <dt>Suggested action</dt>
            <dd>{solicitud.accionSugerida}</dd>
          </div>
          <div>
            <dt>Chile time</dt>
            <dd>{solicitud.horaLocalChile} {solicitud.emergencialDiario ? '· Daily emergency' : ''}</dd>
          </div>
          <div>
            <dt>SLA (h)</dt>
            <dd>{solicitud.slaHoras ?? '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="drawer__section">
        <h4>Lines</h4>
        <div className="lines-grid">
          {solicitud.lineas.map((linea) => (
            <div key={`${linea.pedidoSAP}-${linea.posicion}`} className="line-card">
              <p className="eyebrow">{linea.pedidoSAP} · Item {linea.posicion}</p>
              <p>SKU {linea.sku} · Qty {linea.cantidad}</p>
              <p>Warehouse: {linea.almacenOrigen} → {linea.almacenDestinoDeseado}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="drawer__section">
        <h4>History</h4>
        <ul className="timeline">
          {solicitud.historial.map((h, idx) => (
            <li key={idx}>
              <p className="eyebrow">{new Date(h.fechaISO).toLocaleString()}</p>
              <p>{h.evento} — {h.actor}</p>
              {h.nota && <p className="muted">{h.nota}</p>}
            </li>
          ))}
        </ul>
      </section>

      <ApproverActions solicitud={solicitud} onAccion={onAccion} />
    </aside>
  )
}
