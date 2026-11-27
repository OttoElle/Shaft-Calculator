import { useState, type ReactNode } from 'react'
import type { ShaftResult } from '../core/calculate'
import type { Check, LoadKind, Quantity, Step } from '../core/types'
import { Rich, Sym } from './Fields'
import { fmt } from './format'

const checksOf = (result: ShaftResult): Check[] => [result.fatigue, result.static]

export function Summary({ result }: { result: ShaftResult }) {
  const checks = checksOf(result)
  const ok = checks.every((c) => c.ok)
  const decisive = result.fatigue.safety <= result.static.safety ? result.fatigue : result.static
  return (
    <section className={`card summary ${ok ? 'ok' : 'fail'}`}>
      <div className="verdict">
        <span className="badge">{ok ? 'Beide Nachweise erfüllt' : 'Nachweis nicht erfüllt'}</span>
        <span className="verdict-detail">maßgebend: {decisive.label}</span>
      </div>
      <dl className="kpis">
        <div>
          <dt>Sicherheit gegen Dauerbruch</dt>
          <dd>{fmt(result.fatigue.safety, 3)}</dd>
        </div>
        <div>
          <dt>Sicherheit gegen bleibende Verformung</dt>
          <dd>{fmt(result.static.safety, 3)}</dd>
        </div>
        <div>
          <dt>
            <Sym s="S_min" /> gefordert
          </dt>
          <dd>{fmt(result.fatigue.required, 3)}</dd>
        </div>
      </dl>
      {result.warnings.map((w) => (
        <p key={w} className="note">
          {w}
        </p>
      ))}
    </section>
  )
}

/** Auslastung = erforderliche / vorhandene Sicherheit, 100 % entspricht der Mindestsicherheit */
export function UtilizationBars({ result }: { result: ShaftResult }) {
  return (
    <section className="card">
      <h2>Auslastung</h2>
      <p className="hint">100 % entspricht der geforderten Mindestsicherheit.</p>
      <ul className="bars">
        {checksOf(result).map((c) => {
          const util = Number.isFinite(c.safety) ? c.required / c.safety : 0
          const width = Math.min(Math.max(util, 0), 1.5) / 1.5
          return (
            <li key={c.label} className={c.ok ? 'ok' : 'fail'}>
              <div className="bar-label">
                <span>{c.label}</span>
                <span className="bar-value">
                  S = {fmt(c.safety, 3)} (min. {fmt(c.required, 2)}) · {fmt(util * 100, 3)} %
                </span>
              </div>
              <div className="bar-track" aria-hidden="true">
                <div className="bar-fill" style={{ width: `${width * 100}%` }} />
                <div className="bar-limit" style={{ left: `${(1 / 1.5) * 100}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const kindLabel: Record<LoadKind, string> = { zd: 'Zug/Druck', b: 'Biegung', t: 'Torsion' }

/**
 * Ablaufschema nach DIN 743-1, Anhang B: vom Werkstoffkennwert über die
 * Einflussfaktoren zur Bauteilfestigkeit und Sicherheit. Jeder Kasten springt zum Rechenschritt.
 */
export function FlowChart({ result }: { result: ShaftResult }) {
  const kinds = (['zd', 'b', 't'] as LoadKind[]).filter((k) => result.kinds[k])
  const jump = (id: string) => {
    const el = document.getElementById(`step-${id}`)
    if (el instanceof HTMLDetailsElement) el.open = true
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const Box = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
    <button type="button" className="flow-box" onClick={() => jump(id)}>
      <span className="flow-title">{title}</span>
      <span className="flow-values">{children}</span>
    </button>
  )
  const first = kinds[0]
  return (
    <section className="card">
      <h2>Ablauf des Nachweises</h2>
      <p className="hint">Nach DIN 743-1, Anhang B. Ein Klick auf einen Kasten öffnet den zugehörigen Rechenschritt.</p>
      <div className="flow">
        <div className="flow-col">
          <span className="flow-head">Festigkeit</span>
          <Box id="material" title="Werkstoff (Probe)">
            σ<sub>B</sub>, σ<sub>S</sub>, σ<sub>W</sub>
          </Box>
          <Box id="k1" title="Größeneinfluss">
            K<sub>1,B</sub> = {fmt(result.K1B, 3)} · K<sub>1,S</sub> = {fmt(result.K1S, 3)}
          </Box>
          {kinds.map((k) => (
            <Box key={k} id={`notch-${k}`} title={`Kerbe ${kindLabel[k]}`}>
              β = {fmt(result.kinds[k]!.notch.beta, 3)}
            </Box>
          ))}
          {kinds.map((k) => (
            <Box key={k} id={`k-${k}`} title={`Gesamteinfluss ${kindLabel[k]}`}>
              K = {fmt(result.kinds[k]!.K, 3)}
            </Box>
          ))}
        </div>
        <div className="flow-arrow" aria-hidden="true">→</div>
        <div className="flow-col">
          <span className="flow-head">Bauteil</span>
          {kinds.map((k) => (
            <Box key={k} id="adk" title={`Dauerfestigkeit ${kindLabel[k]}`}>
              W<sub>K</sub> = {fmt(result.kinds[k]!.WK, 3)} → A<sub>DK</sub> = {fmt(result.kinds[k]!.ADK, 3)}
            </Box>
          ))}
          {kinds.map((k) => (
            <Box key={k} id="yield" title={`Fließgrenze ${kindLabel[k]}`}>
              FK = {fmt(result.kinds[k]!.FK, 3)}
            </Box>
          ))}
        </div>
        <div className="flow-arrow" aria-hidden="true">←</div>
        <div className="flow-col">
          <span className="flow-head">Beanspruchung</span>
          {kinds.map((k) => (
            <Box key={k} id="stresses" title={kindLabel[k]}>
              m = {fmt(result.kinds[k]!.m, 3)} · a = {fmt(result.kinds[k]!.a, 3)} · max = {fmt(result.kinds[k]!.max, 3)}
            </Box>
          ))}
          {first && (
            <Box id="adk" title="Vergleichsmittelspannung">
              σ<sub>mv</sub> = {fmt(result.sigmaMv, 3)}
            </Box>
          )}
        </div>
      </div>
      <div className="flow-result">
        <Box id="fatigue" title="Dauerbruch">
          S = {fmt(result.fatigue.safety, 3)} {result.fatigue.ok ? '✓' : '✗'}
        </Box>
        <Box id="static" title="Bleibende Verformung">
          S = {fmt(result.static.safety, 3)} {result.static.ok ? '✓' : '✗'}
        </Box>
      </div>
      <p className="hint">Spannungen in N/mm².</p>
    </section>
  )
}

function QuantityRow({ q, detailed }: { q: Quantity; detailed: boolean }) {
  const hasCalc = detailed && (q.formula || q.substitution || q.note || q.ref)
  return (
    <div className="qty">
      <div className="qty-main">
        <span className="qty-sym">
          <Sym s={q.symbol} />
        </span>
        <span className="q-label">{q.label}</span>
        <span className="num">{fmt(q.value)}</span>
        <span className="q-unit">{q.unit}</span>
      </div>
      {hasCalc && (
        <div className="qty-calc">
          {q.formula && <div className="formula">{q.formula}</div>}
          {q.substitution && (
            <div className="formula subst">
              = {q.substitution} = <strong>{fmt(q.value)}</strong> {q.unit}
            </div>
          )}
          {q.ref && <div className="ref">{q.ref}</div>}
          {q.note && <div className="qty-note">{q.note}</div>}
        </div>
      )}
    </div>
  )
}

export function StepList({ steps, title = 'Rechenweg' }: { steps: Step[]; title?: string }) {
  const [detailed, setDetailed] = useState(true)
  return (
    <section className="card">
      <div className="card-head">
        <h2>{title}</h2>
        <label className="toggle">
          <input type="checkbox" checked={detailed} onChange={(e) => setDetailed(e.target.checked)} /> Formeln und Erklärungen
        </label>
      </div>
      <div className="steps">
        {steps.map((s, i) => {
          const ok = s.checks.every((c) => c.ok)
          return (
            <details key={s.id} id={`step-${s.id}`} className="step" open={s.checks.length > 0}>
              <summary>
                <span className="step-tag">{i + 1}</span>
                <span className="step-title">{s.title}</span>
                {s.checks.length > 0 && <span className={`dot ${ok ? 'ok' : 'fail'}`} aria-label={ok ? 'erfüllt' : 'nicht erfüllt'} />}
              </summary>
              {detailed && <p className="explanation">{s.explanation}</p>}
              <div className="qty-list">
                {s.quantities.map((q, j) => (
                  <QuantityRow key={q.symbol + j} q={q} detailed={detailed} />
                ))}
              </div>
              {s.checks.map((c) => (
                <p key={c.label} className={`check ${c.ok ? 'ok' : 'fail'}`}>
                  {c.ok ? '✓' : '✗'} {c.label}: S = {fmt(c.safety, 3)} {c.ok ? '≥' : '<'} {fmt(c.required, 2)} ({c.ref})
                </p>
              ))}
              {s.notes.map((n) => (
                <p key={n} className="note">
                  <Rich text={n} />
                </p>
              ))}
            </details>
          )
        })}
      </div>
    </section>
  )
}
