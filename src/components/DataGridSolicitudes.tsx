import type { Solicitud } from '../types/solicitudes'

export type DataGridSolicitudesProps = {
  rows: Solicitud[]
  onSelect: (solicitud: Solicitud) => void
}

export function DataGridSolicitudes({ rows, onSelect }: DataGridSolicitudesProps) {
  return (
    <div className="table-card" role="table" aria-label="Requests">
      <div className="table-card__header" role="row">
        <span role="columnheader">Status</span>
        <span role="columnheader">Priority</span>
        <span role="columnheader">Requester</span>
        <span role="columnheader">Customer</span>
        <span role="columnheader">Action</span>
        <span role="columnheader">Sent at</span>
      </div>
      <div className="table-card__body">
        {rows.map((row) => {
          const estadoSlug = row.estado.toLowerCase().replace(/\s+/g, '-')
          const prioridadSlug = row.prioridad.toLowerCase()
          return (
            <button key={row.id} className="table-card__row" role="row" onClick={() => onSelect(row)}>
              <span role="cell"><span className={`chip chip--${estadoSlug}`}>{row.estado}</span></span>
              <span role="cell"><span className={`chip chip--prio-${prioridadSlug}`}>{row.prioridad}</span></span>
            <span role="cell">{row.solicitante}</span>
            <span role="cell">{row.cliente}</span>
            <span role="cell">{row.accionSugerida}</span>
            <span role="cell">{new Date(row.fechaEnvioISO).toLocaleString()}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
