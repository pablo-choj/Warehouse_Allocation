import type { ReactNode } from 'react'

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function fmtPct(value01: number) {
  const v = Math.round(value01 * 1000) / 10
  return `${v}%`
}

function buildLinePath(values: number[], width: number, height: number, padding = 6) {
  if (values.length === 0) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const innerW = Math.max(1, width - padding * 2)
  const innerH = Math.max(1, height - padding * 2)

  return values
    .map((v, idx) => {
      const x = padding + (idx / Math.max(1, values.length - 1)) * innerW
      const t = (v - min) / range
      const y = padding + (1 - t) * innerH
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function buildAreaPath(values: number[], width: number, height: number, padding = 6) {
  if (values.length === 0) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const innerW = Math.max(1, width - padding * 2)
  const innerH = Math.max(1, height - padding * 2)

  const points = values.map((v, idx) => {
    const x = padding + (idx / Math.max(1, values.length - 1)) * innerW
    const t = (v - min) / range
    const y = padding + (1 - t) * innerH
    return { x, y }
  })

  const start = points[0]
  const end = points[points.length - 1]
  const bottomY = padding + innerH

  const line = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
  return `${line} L ${end.x.toFixed(2)} ${bottomY.toFixed(2)} L ${start.x.toFixed(2)} ${bottomY.toFixed(2)} Z`
}

export function KpiCardLayout({ title, subtitle, value, footer, children }: {
  title: string
  subtitle: string
  value: string
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <article className="kpi-card">
      <header className="kpi-card__header">
        <div>
          <p className="kpi-card__subtitle">{subtitle}</p>
          <h3 className="kpi-card__title">{title}</h3>
        </div>
        <p className="kpi-card__value">{value}</p>
      </header>
      <div className="kpi-card__chart">{children}</div>
      {footer && <div className="kpi-card__footer">{footer}</div>}
    </article>
  )
}

export function MiniLineChart({ values, label, height = 64 }: { values: number[]; label: string; height?: number }) {
  const width = 220
  const path = buildLinePath(values, width, height)
  return (
    <svg className="kpi-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} preserveAspectRatio="none">
      <path className="kpi-chart__grid" d={`M 0 ${(height / 2).toFixed(2)} L ${width} ${(height / 2).toFixed(2)}`} />
      <path className="kpi-chart__line" d={path} />
    </svg>
  )
}

export function MiniAreaChart({ values, label, height = 64 }: { values: number[]; label: string; height?: number }) {
  const width = 220
  const area = buildAreaPath(values, width, height)
  const line = buildLinePath(values, width, height)
  return (
    <svg className="kpi-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} preserveAspectRatio="none">
      <path className="kpi-chart__grid" d={`M 0 ${(height / 2).toFixed(2)} L ${width} ${(height / 2).toFixed(2)}`} />
      <path className="kpi-chart__area" d={area} />
      <path className="kpi-chart__line" d={line} />
    </svg>
  )
}

export function MiniBeforeAfter({
  before,
  after,
  label,
  beforeLabel = 'Before',
  afterLabel = 'After',
}: {
  before: number
  after: number
  label: string
  beforeLabel?: string
  afterLabel?: string
}) {
  const max = Math.max(1, before, after)
  const beforeH = clamp01(before / max)
  const afterH = clamp01(after / max)

  return (
    <svg className="kpi-chart" viewBox="0 0 220 64" role="img" aria-label={label} preserveAspectRatio="none">
      <rect className="kpi-chart__barBg" x="20" y="8" width="60" height="48" rx="10" />
      <rect className="kpi-chart__barBg" x="140" y="8" width="60" height="48" rx="10" />

      <rect className="kpi-chart__bar" x="20" y={8 + (1 - beforeH) * 48} width="60" height={beforeH * 48} rx="10" />
      <rect className="kpi-chart__bar" x="140" y={8 + (1 - afterH) * 48} width="60" height={afterH * 48} rx="10" />

      <text className="kpi-chart__label" x="50" y="62" textAnchor="middle">{beforeLabel}</text>
      <text className="kpi-chart__label" x="170" y="62" textAnchor="middle">{afterLabel}</text>
    </svg>
  )
}

export function MiniDistribution({ buckets, label }: { buckets: number[]; label: string }) {
  const width = 220
  const height = 64
  const padding = 8
  const innerW = width - padding * 2
  const innerH = height - padding * 2
  const max = Math.max(1, ...buckets)
  const barW = innerW / Math.max(1, buckets.length)

  return (
    <svg className="kpi-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} preserveAspectRatio="none">
      <path className="kpi-chart__grid" d={`M 0 ${(height / 2).toFixed(2)} L ${width} ${(height / 2).toFixed(2)}`} />
      {buckets.map((v, idx) => {
        const h = (v / max) * innerH
        const x = padding + idx * barW + 2
        const y = padding + innerH - h
        const w = Math.max(2, barW - 4)
        return <rect key={idx} className="kpi-chart__bar" x={x} y={y} width={w} height={h} rx={6} />
      })}
    </svg>
  )
}

export const kpiFormatters = {
  fmtPct,
}
