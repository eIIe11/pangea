import { useMemo } from 'react'
import type { EquityPoint } from '../lib/types'

const W = 640
const H = 160

function path(values: number[], min: number, max: number): string {
  const span = max - min || 1
  return values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * W
      const y = H - ((v - min) / span) * H
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

/**
 * Hand-rolled SVG rather than a charting library: two polylines do not justify
 * 400 kB of JavaScript on a control surface that must render on bad wifi.
 * Both series are indexed to 100 at the window start so they are comparable.
 */
export function EquityChart({ points }: { points: EquityPoint[] }) {
  const { equity, benchmark, min, max } = useMemo(() => {
    const first = points[0]
    if (!first) return { equity: [], benchmark: [], min: 0, max: 1 }
    const e = points.map((p) => (p.equity / first.equity) * 100)
    const b = points.map((p) => (p.benchmark / first.benchmark) * 100)
    const all = [...e, ...b]
    return { equity: e, benchmark: b, min: Math.min(...all), max: Math.max(...all) }
  }, [points])

  if (equity.length === 0) return null

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-40 w-full"
      role="img"
      aria-label="Equity curve, 90 days, benchmark ghosted"
    >
      <line x1="0" y1={H - ((100 - min) / (max - min || 1)) * H} x2={W} y2={H - ((100 - min) / (max - min || 1)) * H} stroke="var(--color-pg-line)" strokeWidth="1" />
      <path d={path(benchmark, min, max)} fill="none" stroke="var(--color-pg-line)" strokeWidth="2" />
      <path d={path(equity, min, max)} fill="none" stroke="var(--color-pg-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
