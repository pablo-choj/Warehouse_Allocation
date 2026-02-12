import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadDropzone } from '../../components/UploadDropzone'
import type { Solicitud } from '../../types/solicitudes'
import { enviarAlAgente, simularReglas, type SimulacionPayload } from './upload.service'
import type { LineaValidada } from './upload.rules'
import { useStore } from '../../state/store.tsx'

export function UploadView() {
  const { dispatch } = useStore()
  const navigate = useNavigate()
  const [lineas, setLineas] = useState<LineaValidada[]>([])
  const [filters, setFilters] = useState({ sku: '', pedido: '', almacen: '' })
  const [solicitud, setSolicitud] = useState<Solicitud | undefined>()
  const [agentContext, setAgentContext] = useState<{ cliente: string; horaLocalChile: string } | null>(null)
  const [observaciones, setObservaciones] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showRecomendacion, setShowRecomendacion] = useState(false)
  const [agentSummary, setAgentSummary] = useState<string | null>(null)

  const pt15Lines = useMemo(() => {
    const isPT15 = (value: string | undefined) => (value ?? '').trim().toUpperCase() === 'PT15'
    return lineas.filter((l) => isPT15(l.almacenOrigen) || isPT15(l.almacenDestinoDeseado))
  }, [lineas])

  const validLines = useMemo(() => {
    return lineas.filter((l) => l.esValida)
  }, [lineas])

  const filtered = useMemo(() => {
    return lineas.filter((l) => {
      return (
        (!filters.sku || l.sku.toLowerCase().includes(filters.sku.toLowerCase())) &&
        (!filters.pedido || l.pedidoSAP.includes(filters.pedido)) &&
        (!filters.almacen || l.almacenDestinoDeseado.includes(filters.almacen))
      )
    })
  }, [lineas, filters])

  async function handleFiles(files: FileList) {
    const file = files[0]
    if (!file) return
    setBusy(true)
    setToast(null)
    try {
      const payload: SimulacionPayload = {
        cliente: 'SAP Customer',
        solicitante: 'Demo User',
        horaLocalChile: '10:45',
      }
      setAgentContext({ cliente: payload.cliente, horaLocalChile: payload.horaLocalChile })
      const resultado = await simularReglas(file, payload)
      setLineas(resultado.lineasValidadas)
      setObservaciones(resultado.observacionesGlobales)
      setSolicitud(resultado.solicitud)
      setShowRecomendacion(false)
      setAgentSummary(null)
      if (resultado.solicitud) {
        dispatch({ type: 'add', payload: resultado.solicitud })
      }
      setToast('File processed and rules applied')
    } catch (error) {
      setToast((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleEnviarAgente() {
    setBusy(true)
    try {
      if (validLines.length === 0) {
        setToast('No valid lines to send to the agent')
        return
      }

      const ctx = solicitud
        ? { cliente: solicitud.cliente, horaLocalChile: solicitud.horaLocalChile }
        : agentContext

      if (!ctx) {
        setToast('Missing context for agent call')
        return
      }

      const result = await enviarAlAgente(validLines, ctx)

      if (result.parsed) {
        const map = new Map(result.parsed.lines.map((l) => [`${l.sales_order}::${l.line_item}`, l]))
        setLineas((prev) =>
          prev.map((l) => {
            const hit = map.get(`${l.pedidoSAP}::${l.posicion}`)
            if (!hit) return l
            return { ...l, recomendacion: hit.recommendation || l.recomendacion }
          }),
        )
        setAgentSummary(result.parsed.summary)
      } else {
        setAgentSummary(result.rawText)
      }

      setShowRecomendacion(true)
      setToast('Agent responded with recommendations')
    } catch (error) {
      setToast((error as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function handleDescargarJson() {
    if (!solicitud) return
    const blob = new Blob([JSON.stringify(solicitud, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${solicitud.id}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleEnviarPT15AAprobaciones() {
    if (!solicitud) return
    if (pt15Lines.length === 0) {
      setToast('No PT15 lines found')
      return
    }

    const aprobacion: Solicitud = {
      ...solicitud,
      id: `SOL-APR-${Date.now().toString(16).toUpperCase()}`,
      accionSugerida: 'Ambas',
      estado: 'Pendiente',
      comentariosSolicitante: 'PT15 lines require approval ticket',
      lineas: pt15Lines.map((l) => ({
        pedidoSAP: l.pedidoSAP,
        posicion: l.posicion,
        sku: l.sku,
        cantidad: l.cantidad,
        almacenOrigen: l.almacenOrigen,
        almacenDestinoDeseado: l.almacenDestinoDeseado,
      })),
      historial: [
        {
          fechaISO: new Date().toISOString(),
          actor: 'System',
          evento: 'Approval request created from PT15 lines',
          nota: `PT15 lines: ${pt15Lines.length}`,
        },
      ],
    }

    dispatch({ type: 'add', payload: aprobacion })
    navigate('/aprobaciones')
  }

  return (
    <div className="grid-2">
      <UploadDropzone onFiles={handleFiles} busy={busy} />

      <div className="panel">
        <header className="panel__header">
          <div>
            <p className="eyebrow">Preview</p>
            <h3>Detected lines</h3>
          </div>
          <div className="filters">
            <input
                aria-label="Filter SKU"
                placeholder="SKU"
              value={filters.sku}
              onChange={(e) => setFilters((f) => ({ ...f, sku: e.target.value }))}
            />
            <input
                aria-label="Filter order"
                placeholder="Order"
              value={filters.pedido}
              onChange={(e) => setFilters((f) => ({ ...f, pedido: e.target.value }))}
            />
            <input
                aria-label="Filter destination"
                placeholder="Destination"
              value={filters.almacen}
              onChange={(e) => setFilters((f) => ({ ...f, almacen: e.target.value }))}
            />
          </div>
        </header>

        <div className="table-simple" role="table" aria-label="SAP lines">
          <div
            className="table-simple__head"
            role="row"
            style={{ gridTemplateColumns: `repeat(${showRecomendacion ? 6 : 5}, 1fr)` }}
          >
            <span role="columnheader">Sales Order Number</span>
            <span role="columnheader">Line Item</span>
            <span role="columnheader">Material UCC14</span>
            <span role="columnheader">Storage Location</span>
            <span role="columnheader">New storage Location</span>
            {showRecomendacion && <span role="columnheader">Agent recommendation</span>}
          </div>
          <div className="table-simple__body">
            {filtered.map((linea, idx) => (
              <div
                key={idx}
                className="table-simple__row"
                role="row"
                style={{ gridTemplateColumns: `repeat(${showRecomendacion ? 6 : 5}, 1fr)` }}
              >
                <span role="cell">{linea.pedidoSAP}</span>
                <span role="cell">{linea.posicion}</span>
                <span role="cell">{linea.sku}</span>
                <span role="cell">{linea.almacenOrigen}</span>
                <span role="cell">{linea.almacenDestinoDeseado}</span>
                {showRecomendacion && <span role="cell">{linea.recomendacion}</span>}
              </div>
            ))}
          </div>
        </div>

        {agentSummary && (
          <div className="alert alert--info">
            <p className="eyebrow">Agent summary</p>
            <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{agentSummary}</p>
          </div>
        )}

        {observaciones.length > 0 && (
          <div className="alert alert--warning">
            <p>Observations</p>
            <ul>
              {observaciones.map((obs) => (
                <li key={obs}>{obs}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="actions-grid">
          <button className="ui-button ui-button--secondary" onClick={handleDescargarJson} disabled={!solicitud || busy}>
            Download JSON
          </button>
          <button
            className="ui-button ui-button--primary"
            onClick={handleEnviarAgente}
            disabled={busy || validLines.length === 0}
            title={validLines.length === 0 ? 'Requires valid detected lines' : undefined}
          >
            Send to agent
          </button>
          <button
            className="ui-button ui-button--secondary"
            onClick={handleEnviarPT15AAprobaciones}
            disabled={!solicitud || busy || pt15Lines.length === 0}
            title={pt15Lines.length === 0 ? 'Requires PT15 lines' : undefined}
          >
            Send PT15 to approvals
          </button>
        </div>

        {toast && <p className="muted">{toast}</p>}
      </div>
    </div>
  )
}
