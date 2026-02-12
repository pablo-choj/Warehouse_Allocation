import { useMemo, useState } from 'react'
import { DataGridSolicitudes } from '../../components/DataGridSolicitudes'
import { SolicitudDetailDrawer } from '../../components/SolicitudDetailDrawer'
import { mockActualizarEstado, mockNotificar } from './aprobaciones.service'
import { useStore } from '../../state/store.tsx'
import type { Solicitud } from '../../types/solicitudes'

export function AprobacionesView() {
  const { state, dispatch } = useStore()
  const [seleccionada, setSeleccionada] = useState<Solicitud | undefined>()
  const [toast, setToast] = useState<string | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<string>('')

  const filas = useMemo(() => {
    return state.solicitudes.filter((s) => (filtroEstado ? s.estado === filtroEstado : true))
  }, [state.solicitudes, filtroEstado])

  async function handleAccion(estado: Solicitud['estado'], comentario?: string) {
    if (!seleccionada) return
    const actualizado = await mockActualizarEstado(seleccionada, estado, comentario)
    dispatch({ type: 'updateEstado', payload: { id: actualizado.id, estado, comentario, actor: 'Aprobador' } })
    await mockNotificar('solicitante', actualizado, comentario ?? estado)
    setToast(`Status updated to ${estado}`)
    setSeleccionada((prev) => (prev ? { ...prev, estado } : prev))
  }

  return (
    <div className="panel">
      <header className="panel__header">
        <div>
          <p className="eyebrow">Approvals</p>
          <h3>Pending requests</h3>
        </div>
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">All</option>
          <option value="Pendiente">Pending</option>
          <option value="En revisión">Under review</option>
          <option value="Observada">Changes requested</option>
          <option value="Aprobada">Approved</option>
          <option value="Rechazada">Rejected</option>
        </select>
      </header>

      <DataGridSolicitudes rows={filas} onSelect={setSeleccionada} />

      {toast && <p className="muted">{toast}</p>}

      <SolicitudDetailDrawer
        open={Boolean(seleccionada)}
        solicitud={seleccionada}
        onClose={() => setSeleccionada(undefined)}
        onAccion={handleAccion}
      />
    </div>
  )
}
