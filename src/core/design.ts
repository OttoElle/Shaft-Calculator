/**
 * Entwurfsberechnung: Wie dick muss die Welle mindestens sein?
 *
 * DIN 743 ist ein Nachweisverfahren, sie setzt einen bekannten Durchmesser voraus.
 * Für den Entwurf gibt es daher zwei Wege:
 *
 *  1. Überschlag (nicht genormt): Mindestdurchmesser aus einem Vergleichsmoment und
 *     einer zulässigen Spannung mit geschätztem Gesamteinflussfaktor. Das ist der
 *     übliche Lehrbuchansatz, wenn die Kerbgeometrie noch nicht feststeht.
 *  2. Rückwärtsrechnung nach DIN 743: Der vollständige Nachweis wird für verschiedene
 *     Durchmesser gerechnet, wobei die Kerbgeometrie maßstäblich mitwächst, bis die
 *     Mindestsicherheit gerade erreicht ist.
 */

import { calculate, type ShaftInput, type ShaftResult } from './calculate'
import type { Material } from './data/materials'
import { num } from './format'
import type { NotchInput } from './notches'
import type { Quantity, Step } from './types'

export interface EstimateInput {
  material: Material
  /** Biegemoment in N·m (bei umlaufender Welle die Amplitude) */
  Mb: number
  /** Torsionsmoment in N·m */
  T: number
  /** geschätzter Gesamteinflussfaktor Kσ (Standard 2,0) */
  Kest?: number
  /** Mindestsicherheit (Standard 1,2) */
  Smin?: number
  /** Anstrengungsverhältnis nach Bach (Standard 0,7: wechselnde Biegung, ruhende oder schwellende Torsion) */
  alpha0?: number
  /** Innendurchmesser bezogen auf den Außendurchmesser bei Hohlwellen (Standard 0) */
  k?: number
}

export interface EstimateResult {
  d: number
  step: Step
}

/** Überschlägiger Mindestdurchmesser über das Vergleichsmoment (nicht genormt) */
export function estimateDiameter(input: EstimateInput): EstimateResult {
  const { material: mat, Mb, T } = input
  const Kest = input.Kest ?? 2
  const Smin = input.Smin ?? 1.2
  const a0 = input.alpha0 ?? 0.7
  const k = input.k ?? 0
  const sigmaBW = 0.5 * mat.sigmaB
  const Mv = Math.sqrt(Mb ** 2 + 0.75 * (a0 * T) ** 2)
  const sZul = sigmaBW / (Kest * Smin)
  const hollow = 1 - k ** 4
  const d = Math.cbrt((32 * Mv * 1000) / (Math.PI * sZul * hollow))
  const quantities: Quantity[] = [
    {
      symbol: 'σbW(dB)',
      label: `Biegewechselfestigkeit ${mat.name}`,
      value: sigmaBW,
      unit: 'N/mm²',
      formula: 'σbW ≈ 0,5 · σB',
      substitution: `0,5 · ${num(mat.sigmaB)}`,
      ref: 'DIN 743-3, Gl. (1)',
    },
    {
      symbol: 'α0',
      label: 'Anstrengungsverhältnis nach Bach',
      value: a0,
      unit: '',
      note: 'Biegung und Torsion wirken unterschiedlich schädigend. Bei wechselnder Biegung und ruhender oder schwellender Torsion ist α0 ≈ 0,7 üblich, bei gleichartiger Beanspruchung α0 ≈ 1.',
    },
    {
      symbol: 'Mv',
      label: 'Vergleichsmoment',
      value: Mv,
      unit: 'N·m',
      formula: 'Mv = √(Mb² + 0,75 · (α0 · T)²)',
      substitution: `√(${num(Mb)}² + 0,75 · (${num(a0)} · ${num(T)})²)`,
      note: 'Fasst Biegung und Torsion nach der Gestaltänderungsenergiehypothese zu einem gleichwertigen Biegemoment zusammen.',
    },
    {
      symbol: 'Kσ,est',
      label: 'geschätzter Gesamteinflussfaktor',
      value: Kest,
      unit: '',
      note: 'Platzhalter für Kerbe, Größe und Oberfläche, solange die Gestalt noch nicht feststeht. Anhaltswerte aus DIN 743 Beiblatt 1: Absatz mit großem Radius etwa 1,8, Passfedernut oder Sicherungsringnut etwa 3,4.',
    },
    {
      symbol: 'σb,zul',
      label: 'zulässige Biegespannung',
      value: sZul,
      unit: 'N/mm²',
      formula: 'σb,zul = σbW / (Kσ,est · Smin)',
      substitution: `${num(sigmaBW)} / (${num(Kest)} · ${num(Smin)})`,
    },
    {
      symbol: "d'",
      label: 'überschlägiger Mindestdurchmesser',
      value: d,
      unit: 'mm',
      formula: k > 0 ? "d' = ∛(32 · Mv / (π · σb,zul · (1 − k⁴)))" : "d' = ∛(32 · Mv / (π · σb,zul))",
      substitution:
        k > 0
          ? `∛(32 · ${num(Mv)} · 1000 / (π · ${num(sZul)} · (1 − ${num(k)}⁴)))`
          : `∛(32 · ${num(Mv)} · 1000 / (π · ${num(sZul)}))`,
      note: 'Aus σb = Mv / Wb ≤ σb,zul mit Wb = π · d³ / 32 nach d aufgelöst.',
    },
  ]
  const notes = [
    'Dieser Überschlag ist nicht Teil der DIN 743. Er liefert einen Startwert für die Gestaltung; der Festigkeitsnachweis nach DIN 743 muss anschließend geführt werden.',
    'Mittelspannungen, Größeneinfluss und Fließgrenze sind hier nicht berücksichtigt.',
  ]
  if (T > 0 && Mb === 0)
    notes.push('Nur ein Torsionsmoment angegeben: Biegemomente aus Zahn- oder Riemenkräften sind in der Praxis meist maßgebend. Kσ,est oder Smin dann eher großzügig wählen.')
  return {
    d,
    step: {
      id: 'estimate',
      title: 'Überschlägiger Mindestdurchmesser (nicht genormt)',
      explanation:
        'Solange die genaue Gestalt der Welle noch offen ist, wird der Durchmesser mit einer stark vereinfachten Rechnung abgeschätzt: Biegung und Torsion werden zu einem Vergleichsmoment zusammengefasst und einer zulässigen Spannung gegenübergestellt, in der alle noch unbekannten Einflüsse pauschal stecken.',
      quantities,
      checks: [],
      notes,
    },
  }
}

// ---------------------------------------------------------------------------
// Rückwärtsrechnung nach DIN 743

function scaleNotch(n: NotchInput, f: number): NotchInput {
  switch (n.type) {
    case 'shoulder':
    case 'groove':
      return { ...n, D: n.D * f, r: n.r * f, t: n.t === undefined ? undefined : n.t * f }
    case 'crossHole':
      return { ...n, r: n.r * f }
    case 'ringGroove':
      return { ...n, D: n.D * f, m: n.m * f, r: n.r * f }
    default:
      return n
  }
}

/** Eingabe für Durchmesser d, Kerbgeometrie maßstäblich zum Referenzentwurf */
export function scaledInput(ref: ShaftInput, d: number): ShaftInput {
  const f = d / ref.d
  return {
    ...ref,
    d,
    di: ref.di === undefined ? undefined : ref.di * f,
    deff: ref.deff === undefined ? undefined : ref.deff * f,
    notch: scaleNotch(ref.notch, f),
  }
}

const governing = (r: ShaftResult) => Math.min(r.fatigue.safety, r.static.safety)

export interface MinimumDiameterResult {
  /** exakter Mindestdurchmesser, bei dem die kleinere Sicherheit gerade Smin erreicht */
  d: number
  /** auf ganze Millimeter aufgerundet */
  dRounded: number
  /** vollständiger Nachweis für dRounded */
  result: ShaftResult
  /** Stützstellen S(d) für Diagramm und Tabelle */
  curve: { d: number; SD: number; SF: number }[]
  step: Step
}

/**
 * Kleinster Durchmesser, für den beide Nachweise nach DIN 743 die Mindestsicherheit erreichen.
 * Die Kerbmaße (D, r, t, m, Bohrungsradius) und di werden im Verhältnis zu `ref.d` mitskaliert.
 */
export function minimumDiameter(ref: ShaftInput, dMin = 3, dMax = 1000): MinimumDiameterResult {
  if (ref.loads.type !== 'forces') throw new Error('Für die Rückwärtsrechnung müssen Kräfte und Momente angegeben sein.')
  const Smin = ref.Smin ?? 1.2
  const g = (d: number) => governing(calculate(scaledInput(ref, d))) - Smin

  // Klammer suchen: S wächst mit d (Widerstandsmoment ~ d³ gegenüber langsam fallendem K1, K2)
  let lo = dMin
  let hi = dMin
  while (g(hi) < 0 && hi < dMax) {
    lo = hi
    hi = Math.min(hi * 1.5, dMax)
  }
  if (g(hi) < 0) throw new Error(`Auch mit d = ${dMax} mm wird die Mindestsicherheit nicht erreicht.`)
  for (let i = 0; i < 60 && hi - lo > 1e-4; i++) {
    const mid = (lo + hi) / 2
    if (g(mid) < 0) lo = mid
    else hi = mid
  }
  const d = hi
  let dRounded = Math.ceil(d - 1e-9)
  while (g(dRounded) < 0) dRounded++
  const result = calculate(scaledInput(ref, dRounded))

  const curve: MinimumDiameterResult['curve'] = []
  const from = Math.max(dMin, d * 0.7)
  const to = d * 1.5
  for (let i = 0; i <= 16; i++) {
    const di = from + ((to - from) * i) / 16
    const r = calculate(scaledInput(ref, di))
    curve.push({ d: di, SD: r.fatigue.safety, SF: r.static.safety })
  }

  const SD = result.fatigue.safety
  const SF = result.static.safety
  const decisive = SD <= SF ? 'Dauerbruch' : 'bleibende Verformung'
  const scaled = scaledInput(ref, dRounded).notch
  const geom: Quantity[] = []
  if ('D' in scaled) geom.push({ symbol: 'D', label: 'mitskalierter Absatz- bzw. Außendurchmesser', value: scaled.D, unit: 'mm' })
  if ('r' in scaled) geom.push({ symbol: 'r', label: 'mitskalierter Radius', value: scaled.r, unit: 'mm' })

  return {
    d,
    dRounded,
    result,
    curve,
    step: {
      id: 'minimum',
      title: 'Mindestdurchmesser nach DIN 743',
      explanation:
        'Der vollständige Nachweis wird rückwärts gelöst: Der Durchmesser wird so lange verändert, bis die kleinere der beiden Sicherheiten genau die Mindestsicherheit erreicht. Die Kerbmaße wachsen dabei maßstäblich mit, das Verhältnis von Radius und Absatz zum Durchmesser bleibt also gleich.',
      quantities: [
        { symbol: 'Smin', label: 'Mindestsicherheit', value: Smin, unit: '' },
        { symbol: 'dmin', label: 'rechnerischer Mindestdurchmesser', value: d, unit: 'mm', note: `maßgebend: Nachweis gegen ${decisive}` },
        { symbol: 'd', label: 'gewählter Durchmesser (aufgerundet)', value: dRounded, unit: 'mm' },
        ...geom,
        { symbol: 'S (Dauerbruch)', label: `Sicherheit gegen Dauerbruch bei d = ${dRounded} mm`, value: SD, unit: '' },
        { symbol: 'S (Verformung)', label: `Sicherheit gegen bleibende Verformung bei d = ${dRounded} mm`, value: SF, unit: '' },
      ],
      checks: [result.fatigue, result.static],
      notes: [
        'Normmaße wie Sicherungsringnuten nach DIN 471 oder Passfedern nach DIN 6885 wachsen nicht genau linear mit dem Durchmesser. Für den gewählten Durchmesser die tatsächlichen Maße eintragen und den Nachweis erneut führen.',
      ],
    },
  }
}
