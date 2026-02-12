import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadDropzone } from '../../components/UploadDropzone'
import { KpiCardLayout, MiniAreaChart, MiniBeforeAfter, MiniDistribution, MiniLineChart, kpiFormatters } from '../../components/KpiCharts'
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
  const [agentRaw, setAgentRaw] = useState<string | null>(null)

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
        (!filters.almacen || l.almacenOrigen.includes(filters.almacen))
      )
    })
  }, [lineas, filters])

  const dashboard = useMemo(() => {
    const total = lineas.length
    const valid = validLines.length
    const invalid = total - valid
    const validRate = total > 0 ? valid / total : 0

    const storageChange = lineas.filter((l) => {
      const desired = (l.almacenDestinoDeseado ?? '').trim()
      return desired.length > 0 && desired !== l.almacenOrigen
    }).length
    const changeRate = total > 0 ? storageChange / total : 0

    const pt15 = pt15Lines.length
    const pt15Rate = total > 0 ? pt15 / total : 0

    const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
    const makeTrend = (seed: number, base: number, amplitude: number) => {
      return Array.from({ length: 12 }, (_, i) => {
        const wave = Math.sin((i + 1 + seed) * 0.85) * amplitude
        const drift = (i - 11) * 0.003
        return clamp01(base + wave + drift)
      })
    }

    const validTrend = makeTrend(2, validRate || 0.78, 0.06)
    const changeTrend = makeTrend(7, changeRate || 0.22, 0.07)
    const approvalTrend = makeTrend(11, pt15Rate || 0.12, 0.05)

    const quantityBuckets = [0, 0, 0, 0, 0]
    for (const l of validLines) {
      const q = Number(l.cantidad)
      if (!Number.isFinite(q) || q <= 0) continue
      if (q <= 1) quantityBuckets[0] += 1
      else if (q <= 5) quantityBuckets[1] += 1
      else if (q <= 10) quantityBuckets[2] += 1
      else if (q <= 25) quantityBuckets[3] += 1
      else quantityBuckets[4] += 1
    }

    return {
      total,
      valid,
      invalid,
      validRate,
      storageChange,
      changeRate,
      pt15,
      pt15Rate,
      validTrend,
      changeTrend,
      approvalTrend,
      quantityBuckets,
    }
  }, [lineas, validLines, pt15Lines])

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
      setAgentRaw(null)
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
        setAgentRaw(null)
      } else {
        setAgentSummary(
          'Agent response could not be fully parsed (likely truncated). Try sending again after fixing invalid quantities, or reduce the number of lines.',
        )
        setAgentRaw(result.rawText)
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
        <section className="kpi-section" aria-label="Dashboard">
          <header className="kpi-section__header">
            <div>
              <p className="eyebrow">Dashboard</p>
              <h3 className="kpi-section__title">Operational snapshot</h3>
            </div>
            <p className="muted kpi-section__hint">Updates after file import</p>
          </header>

          <div className="kpi-grid">
            <KpiCardLayout
              title="Validation pass rate"
              subtitle="Quality"
              value={kpiFormatters.fmtPct(dashboard.validRate)}
              footer={<span className="muted">Valid: {dashboard.valid} · Invalid: {dashboard.invalid}</span>}
            >
              <MiniLineChart values={dashboard.validTrend} label="Validation pass rate trend" />
            </KpiCardLayout>

            <KpiCardLayout
              title="Storage change requests"
              subtitle="Flow"
              value={kpiFormatters.fmtPct(dashboard.changeRate)}
              footer={<span className="muted">Lines with a new location: {dashboard.storageChange}</span>}
            >
              <MiniAreaChart values={dashboard.changeTrend} label="Storage change trend" />
            </KpiCardLayout>

            <KpiCardLayout
              title="Approval workload"
              subtitle="PT15"
              value={`${dashboard.pt15}`}
              footer={<span className="muted">Share: {kpiFormatters.fmtPct(dashboard.pt15Rate)}</span>}
            >
              <MiniBeforeAfter
                before={dashboard.pt15}
                after={Math.max(0, dashboard.total - dashboard.pt15)}
                label="PT15 vs non-PT15 distribution"
                beforeLabel="PT15"
                afterLabel="Non-PT15"
              />
            </KpiCardLayout>

            <KpiCardLayout
              title="Quantity distribution"
              subtitle="Orders"
              value={`${dashboard.total}`}
              footer={<span className="muted">Buckets: 1 · 5 · 10 · 25 · 25+</span>}
            >
              <MiniDistribution buckets={dashboard.quantityBuckets} label="Quantity distribution" />
            </KpiCardLayout>
          </div>
        </section>

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
                aria-label="Filter storage location"
                placeholder="Storage"
              value={filters.almacen}
              onChange={(e) => setFilters((f) => ({ ...f, almacen: e.target.value }))}
            />
          </div>
        </header>

        <div className="table-simple" role="table" aria-label="SAP lines">
          <div
            className="table-simple__head"
            role="row"
            style={{ gridTemplateColumns: `repeat(${showRecomendacion ? 5 : 4}, 1fr)` }}
          >
            <span role="columnheader">Sales Order Number</span>
            <span role="columnheader">Line Item</span>
            <span role="columnheader">Material UCC14</span>
            <span role="columnheader">Storage Location</span>
            {showRecomendacion && <span role="columnheader">Agent recommendation</span>}
          </div>
          <div className="table-simple__body">
            {filtered.map((linea, idx) => (
              <div
                key={idx}
                className="table-simple__row"
                role="row"
                style={{ gridTemplateColumns: `repeat(${showRecomendacion ? 5 : 4}, 1fr)` }}
              >
                <span role="cell">{linea.pedidoSAP}</span>
                <span role="cell">{linea.posicion}</span>
                <span role="cell">{linea.sku}</span>
                <span role="cell">{linea.almacenOrigen}</span>
                {showRecomendacion && <span role="cell">{linea.recomendacion}</span>}
              </div>
            ))}
          </div>
        </div>

        {agentSummary && (
          <div className="alert alert--info">
            <p className="eyebrow">Agent summary</p>
            <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{agentSummary}</p>
            {agentRaw && (
              <details style={{ marginTop: '0.75rem' }}>
                <summary className="muted">Show raw response</summary>
                <pre className="muted" style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>{agentRaw}</pre>
              </details>
            )}
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
