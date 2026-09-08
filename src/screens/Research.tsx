import { Card, Label, Row } from '../components/ui'
import { fmtNum, fmtPct } from '../lib/format'
import type { ResearchReport } from '../lib/types'

function Histogram({ values }: { values: number[] }) {
  const bins = 12
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const counts = new Array<number>(bins).fill(0)
  for (const value of values) {
    const index = Math.min(bins - 1, Math.floor(((value - min) / span) * bins))
    counts[index] = (counts[index] ?? 0) + 1
  }
  const peak = Math.max(...counts)
  const zeroBin = Math.min(bins - 1, Math.max(0, Math.floor(((0 - min) / span) * bins)))

  return (
    <div>
      <div className="flex h-24 items-end gap-1">
        {counts.map((count, index) => (
          <div
            key={index}
            className={`flex-1 rounded-t ${index < zeroBin ? 'bg-pg-down/70' : 'bg-pg-accent/70'}`}
            style={{ height: `${(count / peak) * 100}%` }}
          />
        ))}
      </div>
      <Row className="mt-1 text-[10px] text-pg-mute">
        <span className="tnum">{fmtNum(min)}</span>
        <span className="tnum">{fmtNum(max)}</span>
      </Row>
    </div>
  )
}

function Plateau({ plateau }: { plateau: ResearchReport['plateau'] }) {
  const peak = Math.max(...plateau.points.map((p) => p.sharpe))
  return (
    <div className="flex h-24 items-end gap-1">
      {plateau.points.map((point) => (
        <div key={point.value} className="flex flex-1 flex-col items-center gap-1">
          <div
            className={`w-full rounded-t ${point.value === plateau.selected ? 'bg-pg-accent' : 'bg-pg-line'}`}
            style={{ height: `${Math.max(2, (point.sharpe / peak) * 80)}px` }}
          />
          <span className="tnum text-[9px] text-pg-mute">{point.value}</span>
        </div>
      ))}
    </div>
  )
}

export function Research({ research }: { research: ResearchReport }) {
  const { gates, cpcv, costMultiples, regimes, agentCycles } = research
  const gateRows: [string, string, boolean][] = [
    ['Deflated Sharpe', fmtNum(gates.dsr), gates.dsr > 0],
    ['P(backtest overfit)', fmtNum(gates.pbo), gates.pbo < 0.5],
    ['t-statistic', fmtNum(gates.tStat), gates.tStat > 3],
    ['Sample vs min length', `${fmtNum(gates.sampleYears, 1)}y / ${fmtNum(gates.minBacktestLengthYears, 1)}y`, gates.sampleYears > gates.minBacktestLengthYears],
  ]

  return (
    <div className="space-y-3">
      <Label>Research</Label>

      <Card className="p-4">
        <Row>
          <Label>Validation gates</Label>
          <span className="tnum text-[11px] text-pg-mute">{research.trialCount.toLocaleString()} trials deflated</span>
        </Row>
        <div className="mt-3 space-y-2">
          {gateRows.map(([label, value, pass]) => (
            <Row key={label} className="text-sm">
              <span className="text-pg-mute">{label}</span>
              <span className={`tnum ${pass ? 'text-pg-up' : 'text-pg-down'}`}>{value}</span>
            </Row>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <Label>
          CPCV Sharpe distribution · {cpcv.paths.length} paths ({cpcv.trainFolds}/{cpcv.testFolds} folds, {cpcv.embargoDays}d embargo)
        </Label>
        <div className="mt-3">
          <Histogram values={cpcv.paths} />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-pg-mute">
          One walk-forward path would report a single number. The left tail is the part that matters.
        </p>
      </Card>

      <Card className="p-4">
        <Label>Net Sharpe at cost multiples</Label>
        <div className="mt-3 space-y-2">
          {costMultiples.map((point) => (
            <Row key={point.multiple} className="text-sm">
              <span className="text-pg-mute">{point.multiple}× modelled cost</span>
              <span className={`tnum ${point.netSharpe > 0 ? 'text-pg-text' : 'text-pg-down'}`}>{fmtNum(point.netSharpe)}</span>
            </Row>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <Label>Parameter surface · {research.plateau.parameter}</Label>
        <div className="mt-3">
          <Plateau plateau={research.plateau} />
        </div>
        <p className="mt-2 text-[11px] text-pg-mute">Selected at the centre of the plateau, not the peak.</p>
      </Card>

      <Card className="p-4">
        <Label>Regime breakdown</Label>
        <div className="mt-3 space-y-2">
          {regimes.map((regime) => (
            <Row key={regime.name} className="text-sm">
              <span className="text-pg-mute">{regime.name}</span>
              <span className="tnum">
                <span className={regime.sharpe > 0 ? '' : 'text-pg-down'}>{fmtNum(regime.sharpe)}</span>
                <span className="ml-3 text-pg-mute">dd {fmtPct(-regime.maxDrawdown)}</span>
              </span>
            </Row>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <Label>Agent cycles</Label>
        <div className="mt-3 space-y-3">
          {agentCycles.map((cycle) => (
            <div key={cycle.cycle} className="border-t border-pg-line/60 pt-3 first:border-t-0 first:pt-0">
              <Row className="text-sm">
                <span className="tnum text-pg-mute">#{cycle.cycle}</span>
                <span className={cycle.survived ? 'text-pg-up' : 'text-pg-mute'}>
                  {cycle.survived ? 'survived' : 'rejected'} · ${fmtNum(cycle.costUsd)}
                </span>
              </Row>
              <p className="mt-1 text-sm">{cycle.hypothesis}</p>
              <p className="mt-1 text-[11px] text-pg-mute">{cycle.note}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
