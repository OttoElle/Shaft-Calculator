import { useMemo } from 'react'
import { estimateDiameter, minimumDiameter, type MinimumDiameterResult } from '../core/design'
import { NumberField } from './Fields'
import { fmt } from './format'
import { StepList } from './Results'
import { selectedMaterial, toInput, type FormState } from './state'

interface Props {
  state: FormState
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void
  /** Durchmesser übernehmen, Kerbmaße maßstäblich mitskalieren */
  applyDiameter: (d: number) => void
}

export function DesignView({ state: s, set, applyDiameter }: Props) {
  const Mb = Math.abs(s.Mbm) + Math.abs(s.Mba)
  const T = Math.abs(s.Mtm) + Math.abs(s.Mta)
  const { estimate, minimum, error } = useMemo(() => {
    let estimate: ReturnType<typeof estimateDiameter> | null = null
    let minimum: MinimumDiameterResult | null = null
    let error: string | null = null
    try {
      estimate = estimateDiameter({
        material: selectedMaterial(s),
        Mb,
        T,
        Kest: s.Kest,
        Smin: s.Smin,
        alpha0: s.alpha0,
        k: s.di > 0 ? s.di / s.d : 0,
      })
      minimum = minimumDiameter(toInput(s))
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
    return { estimate, minimum, error }
  }, [s, Mb, T])

  return (
    <>
      <section className="card">
        <h2>Entwurf: Wie dick muss die Welle sein?</h2>
        <p className="hint">
          Die DIN 743 ist ein Nachweisverfahren und setzt einen Durchmesser voraus. Für den Entwurf gibt es zwei Wege: einen schnellen Überschlag ohne Kerbgeometrie
          (nicht genormt) und die Rückwärtsrechnung des vollständigen Nachweises mit der links eingegebenen Kerbe, die maßstäblich mitwächst.
        </p>
        <div className="grid3">
          <NumberField symbol="K_σ,est" label="geschätzter Gesamteinflussfaktor" value={s.Kest} onChange={(v) => set('Kest', v ?? 0)} hint="Absatz etwa 1,8; Passfeder oder Sicherungsringnut etwa 3,4" />
          <NumberField symbol="α_0" label="Anstrengungsverhältnis" value={s.alpha0} onChange={(v) => set('alpha0', v ?? 0)} hint="0,7 bei wechselnder Biegung und ruhender Torsion" />
        </div>
        <p className="hint">
          Für den Überschlag: M<sub>b</sub> = |M<sub>bm</sub>| + |M<sub>ba</sub>| = {fmt(Mb)} N·m, T = |M<sub>tm</sub>| + |M<sub>ta</sub>| = {fmt(T)} N·m. Axialkräfte werden im
          Überschlag nicht berücksichtigt.
        </p>
      </section>

      {error && (
        <section className="card errors" role="alert">
          <h2>Entwurf nicht möglich</h2>
          <p>{error}</p>
        </section>
      )}

      {estimate && minimum && (
        <>
          <section className="card summary ok">
            <dl className="kpis">
              <div>
                <dt>Überschlag (nicht genormt)</dt>
                <dd>{fmt(estimate.d, 3)} mm</dd>
              </div>
              <div>
                <dt>Mindestdurchmesser nach DIN 743</dt>
                <dd>{fmt(minimum.d, 4)} mm</dd>
              </div>
              <div>
                <dt>Vorschlag (aufgerundet)</dt>
                <dd>{minimum.dRounded} mm</dd>
              </div>
            </dl>
            <div className="actions">
              <button type="button" onClick={() => applyDiameter(minimum.dRounded)}>
                d = {minimum.dRounded} mm übernehmen und nachweisen
              </button>
            </div>
            <p className="hint">Beim Übernehmen werden D, r, t, m, Bohrung und Innendurchmesser im gleichen Verhältnis mitskaliert.</p>
          </section>
          <SafetyCurve minimum={minimum} Smin={s.Smin} current={s.d} />
          <StepList steps={[estimate.step, minimum.step]} title="Rechenweg Entwurf" />
        </>
      )}
    </>
  )
}

function SafetyCurve({ minimum, Smin, current }: { minimum: MinimumDiameterResult; Smin: number; current: number }) {
  const W = 560
  const H = 260
  const pad = { l: 46, r: 16, t: 16, b: 36 }
  const pts = minimum.curve
  const xs = pts.map((p) => p.d)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMax = Math.min(Math.max(...pts.map((p) => Math.max(p.SD, p.SF)), Smin * 1.2), Smin * 4)
  const X = (d: number) => pad.l + ((d - xMin) / (xMax - xMin)) * (W - pad.l - pad.r)
  const Y = (S: number) => pad.t + (1 - Math.min(S, yMax) / yMax) * (H - pad.t - pad.b)
  const line = (key: 'SD' | 'SF') => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.d).toFixed(1)},${Y(p[key]).toFixed(1)}`).join(' ')
  const ticksY = Array.from({ length: 5 }, (_, i) => (yMax * i) / 4)
  const ticksX = Array.from({ length: 5 }, (_, i) => xMin + ((xMax - xMin) * i) / 4)
  return (
    <section className="card">
      <h2>Sicherheit über dem Durchmesser</h2>
      <p className="hint">Wie ändern sich die Sicherheiten, wenn die Welle bei gleichen Proportionen dicker oder dünner wird?</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="diagram" role="img" aria-label="Sicherheit über Durchmesser">
        {ticksY.map((v) => (
          <g key={v}>
            <line className="grid" x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} />
            <text className="tick" x={pad.l - 6} y={Y(v) + 4} textAnchor="end">
              {fmt(v, 2)}
            </text>
          </g>
        ))}
        {ticksX.map((v) => (
          <text key={v} className="tick" x={X(v)} y={H - pad.b + 16} textAnchor="middle">
            {fmt(v, 3)}
          </text>
        ))}
        <text className="tick" x={W - pad.r} y={H - 4} textAnchor="end">
          d in mm
        </text>
        <text className="tick" x={4} y={pad.t + 4}>
          S
        </text>
        <line className="limit" x1={pad.l} x2={W - pad.r} y1={Y(Smin)} y2={Y(Smin)} />
        <text className="tick" x={W - pad.r} y={Y(Smin) - 4} textAnchor="end">
          Smin = {fmt(Smin, 2)}
        </text>
        <path className="curve-fatigue" d={line('SD')} />
        <path className="curve-static" d={line('SF')} />
        <line className="marker" x1={X(minimum.d)} x2={X(minimum.d)} y1={pad.t} y2={H - pad.b} />
        {current >= xMin && current <= xMax && <line className="marker current" x1={X(current)} x2={X(current)} y1={pad.t} y2={H - pad.b} />}
      </svg>
      <ul className="legend-list">
        <li>
          <span className="swatch fatigue" /> Dauerbruch
        </li>
        <li>
          <span className="swatch static" /> bleibende Verformung
        </li>
        <li>
          <span className="swatch marker" /> d<sub>min</sub> = {fmt(minimum.d, 4)} mm
        </li>
        <li>
          <span className="swatch current" /> aktuelle Eingabe d = {fmt(current)} mm
        </li>
      </ul>
    </section>
  )
}
