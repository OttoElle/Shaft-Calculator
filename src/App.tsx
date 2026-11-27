import { useMemo, useState } from 'react'
import { calculate, type ShaftResult } from './core/calculate'
import { DesignView } from './ui/DesignView'
import { Expandable } from './ui/Expandable'
import { InputForm } from './ui/InputForm'
import { NotchSketch } from './ui/NotchSketch'
import { FlowChart, StepList, Summary, UtilizationBars } from './ui/Results'
import { DEFAULT_STATE, EXAMPLES, toInput, validate, type FormState } from './ui/state'
import './App.css'

const STORAGE_KEY = 'wellenrechner.state.v1'

function loadState(): FormState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) }
  } catch {
    // Speicher nicht verfügbar
  }
  return DEFAULT_STATE
}

function saveState(s: FormState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // Speicher nicht verfügbar
  }
}

type Tab = 'proof' | 'design'

export default function App() {
  const [state, setState] = useState<FormState>(loadState)
  const [tab, setTab] = useState<Tab>('proof')

  const update = (next: FormState) => {
    setState(next)
    saveState(next)
  }
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((prev) => {
      const next = { ...prev, [key]: value }
      saveState(next)
      return next
    })

  const applyDiameter = (d: number) => {
    const f = d / state.d
    const round = (x: number) => Math.round(x * 100) / 100
    update({
      ...state,
      d,
      D: round(state.D * f),
      r: round(state.r * f),
      t: state.t === null ? null : round(state.t * f),
      m: round(state.m * f),
      holeD: round(state.holeD * f),
      di: round(state.di * f),
      deff: state.deff === null ? null : round(state.deff * f),
    })
    setTab('proof')
  }

  const { errors, result } = useMemo(() => {
    let result: ShaftResult | null = null
    let errors = validate(state)
    if (errors.length === 0) {
      try {
        result = calculate(toInput(state))
      } catch (e) {
        errors = [e instanceof Error ? e.message : String(e)]
      }
    }
    return { errors, result }
  }, [state])

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Wellenrechner</h1>
          <p className="subtitle">Tragfähigkeitsnachweis für Wellen und Achsen nach DIN 743 Teil 1 bis 3, mit Rechenweg</p>
        </div>
        <div className="actions">
          <select
            className="example-select"
            value=""
            aria-label="Beispiel laden"
            onChange={(e) => {
              const ex = EXAMPLES.find((x) => x.id === e.target.value)
              if (ex) update(ex.state)
            }}
          >
            <option value="">Beispiel aus Beiblatt 1 laden …</option>
            {EXAMPLES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
          <button type="button" className="secondary" onClick={() => update(DEFAULT_STATE)}>
            Zurücksetzen
          </button>
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Ansicht">
        <button type="button" role="tab" aria-selected={tab === 'proof'} className={tab === 'proof' ? 'active' : ''} onClick={() => setTab('proof')}>
          Nachweis
        </button>
        <button type="button" role="tab" aria-selected={tab === 'design'} className={tab === 'design' ? 'active' : ''} onClick={() => setTab('design')}>
          Entwurf
        </button>
      </nav>

      <main className="layout">
        <aside className="panel">
          <InputForm state={state} set={set} />
        </aside>
        <div className="output">
          {errors.length > 0 && (
            <section className="card errors" role="alert">
              <h2>Eingaben prüfen</h2>
              <ul>
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </section>
          )}
          {tab === 'proof' && result && (
            <>
              <Summary result={result} />
              <div className="visuals">
                <UtilizationBars result={result} />
                <Expandable title="Kerbquerschnitt">{(large) => <NotchSketch s={state} large={large} />}</Expandable>
              </div>
              <FlowChart result={result} />
              <StepList steps={result.steps} />
            </>
          )}
          {tab === 'design' && errors.length === 0 && <DesignView state={state} set={set} applyDiameter={applyDiameter} />}
        </div>
      </main>

      <footer className="footer">
        Ergebnisse ohne Gewähr. Berechnung nach DIN 743-1 und -2 (2012-12) und DIN 743-3 (2024-07), geprüft an den Beispielen aus Beiblatt 1. Nicht enthalten:
        Anrissnachweis bei harten Randschichten (DIN 743-1, 5.1.2), Zeitfestigkeit (DIN 743-4). Die Norm selbst ist nicht Teil dieser Anwendung.
      </footer>
    </div>
  )
}
