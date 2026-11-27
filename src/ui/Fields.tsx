import { useEffect, useId, useState, type ReactNode } from 'react'
import { splitSymbol } from './format'

/**
 * Formelzeichen mit Index darstellen.
 * "F_M,zul" (Unterstrich) oder Schreibweise des Rechenkerns wie "σbWK", "K1,B(deff)", "βσ(dBK)":
 * erstes Zeichen (mit ' oder *) ist das Grundzeichen, der Rest bis zur Klammer der Index.
 */
export function Sym({ s }: { s: string }) {
  if (s.includes('_')) {
    const [base, sub] = splitSymbol(s)
    return (
      <span className="sym">
        {base}
        {sub && <sub>{sub}</sub>}
      </span>
    )
  }
  return <span className="sym">{symbolParts(s)}</span>
}

const CORE_SYM = /^([A-Za-zα-ωΑ-Ω])(['*]?)([^()\s/]*)(\((.*)\))?(.*)$/

function symbolParts(s: string): ReactNode {
  if (s.includes(' ') || s.includes('/') || s.startsWith('(')) return s
  const m = CORE_SYM.exec(s)
  if (!m) return s
  const [, base, mark, sub, paren, inner, rest] = m
  const idx = sub.replace(/^,/, '')
  return (
    <>
      {base}
      {mark}
      {idx && <sub>{idx}</sub>}
      {paren && <>({symbolParts(inner)})</>}
      {rest}
    </>
  )
}

const SYMBOL_RE = /([A-Za-zα-ωΦµ'])_([A-Za-z0-9,]+)/g

/** Text, in dem Formelzeichen wie "F_M,zul" mit Index dargestellt werden */
export function Rich({ text }: { text: ReactNode }) {
  if (typeof text !== 'string') return <>{text}</>
  const parts: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(SYMBOL_RE)) {
    const i = m.index ?? 0
    parts.push(text.slice(last, i))
    parts.push(
      <span key={i}>
        {m[1]}
        <sub>{m[2]}</sub>
      </span>,
    )
    last = i + m[0].length
  }
  parts.push(text.slice(last))
  return <>{parts}</>
}

const parse = (text: string): number | null => {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  const v = Number(t)
  return Number.isFinite(v) ? v : NaN
}

const show = (v: number | null) => (v === null ? '' : String(v).replace('.', ','))

interface NumberFieldProps {
  symbol: string
  label: string
  unit?: string
  value: number | null
  onChange: (v: number | null) => void
  hint?: ReactNode
  /** leeres Feld erlaubt (null), z.B. für optionale Überschreibungen */
  optional?: boolean
  placeholder?: string
}

export function NumberField({ symbol, label, unit, value, onChange, hint, optional, placeholder }: NumberFieldProps) {
  const id = useId()
  const [text, setText] = useState(show(value))
  useEffect(() => {
    // externe Änderungen (z.B. Beispiel laden) übernehmen
    setText((t) => (parse(t) === value ? t : show(value)))
  }, [value])
  const parsed = parse(text)
  const invalid = Number.isNaN(parsed) || (!optional && parsed === null)
  return (
    <div className="field">
      <label htmlFor={id}>
        <Sym s={symbol} /> <span className="label-text"><Rich text={label} /></span>
      </label>
      <div className={`input-wrap${invalid ? ' invalid' : ''}`}>
        <input
          id={id}
          inputMode="decimal"
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value)
            const v = parse(e.target.value)
            if (v === null ? optional : !Number.isNaN(v)) onChange(v)
          }}
        />
        {unit && <span className="unit">{unit}</span>}
      </div>
      {hint && <div className="hint"><Rich text={hint} /></div>}
    </div>
  )
}

interface SelectFieldProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  hint?: ReactNode
}

export function SelectField<T extends string>({ label, value, options, onChange, hint }: SelectFieldProps<T>) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>
        <span className="label-text"><Rich text={label} /></span>
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <div className="hint"><Rich text={hint} /></div>}
    </div>
  )
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="field">
      <span className="label-text"><Rich text={label} /></span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            type="button"
            key={o.value}
            role="radio"
            aria-checked={value === o.value}
            className={value === o.value ? 'active' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
