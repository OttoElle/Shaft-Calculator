/**
 * Kerbwirkungszahlen nach DIN 743-2:2012-12, Abschnitte 4 und 5.
 *
 * Zwei Wege führen zur Kerbwirkungszahl β:
 *  - Kerben mit bekannter Formzahl (Absatz, Rundnut, Freistich, Querbohrung):
 *    β = α / n mit Stützzahl n aus dem bezogenen Spannungsgefälle G' (Verfahren von Stieler)
 *  - experimentell bestimmte Kerbwirkungszahlen (Passfeder, Pressverband, Keilwelle,
 *    Spitzkerbe, Sicherungsringnut): β(dBK) für den Probendurchmesser dBK, umgerechnet
 *    auf den Bauteildurchmesser mit K3(dBK) / K3(d)
 */

import { num } from './format'
import { geometricSizeFactorK3 } from './sizeFactors'
import type { LoadKind, Quantity } from './types'

export type SplineKind = 'straight' | 'serration' | 'involute'

export type NotchInput =
  | { type: 'none' }
  /** Wellenabsatz, auch Absatz mit Freistich (d = Durchmesser im Freistichgrund) */
  | { type: 'shoulder'; D: number; r: number; t?: number }
  /** umlaufende Rundnut */
  | { type: 'groove'; D: number; r: number; t?: number }
  /** Querbohrung mit Bohrungsradius r */
  | { type: 'crossHole'; r: number }
  /** Passfedernut, eine oder zwei Passfedern */
  | { type: 'keyway'; count: 1 | 2 }
  /** Pressverband (Nabenkante) */
  | { type: 'pressFit' }
  /** Keilwelle, Kerbzahnwelle oder Zahnwelle mit Evolventenverzahnung */
  | { type: 'spline'; kind: SplineKind }
  /** umlaufende Spitzkerbe */
  | { type: 'vNotch' }
  /** umlaufende Rechtecknut für Sicherungsringe nach DIN 471 */
  | { type: 'ringGroove'; D: number; m: number; r: number }
  /** eigene Kerbwirkungszahlen, z. B. aus FEM oder Versuch */
  | { type: 'custom'; betaZd: number; betaB: number; betaT: number; revolution: boolean }

export const notchLabel: Record<NotchInput['type'], string> = {
  none: 'ungekerbte Welle',
  shoulder: 'Absatz (auch mit Freistich)',
  groove: 'umlaufende Rundnut',
  crossHole: 'Querbohrung',
  keyway: 'Passfedernut',
  pressFit: 'Pressverband',
  spline: 'Keil-, Kerbzahn- oder Zahnwelle',
  vNotch: 'Spitzkerbe',
  ringGroove: 'Sicherungsringnut (Rechtecknut)',
  custom: 'eigene Kerbwirkungszahlen',
}

export interface NotchContext {
  /** Durchmesser im Kerbquerschnitt */
  d: number
  /** Zugfestigkeit des Bauteils σB(d) = K1 · σB(dB) */
  sigmaBd: number
  /** Streckgrenze des Bauteils σS(d) = K1 · σS(dB) */
  sigmaSd: number
  /** harte Randschicht (Einsatzhärten, Nitrieren, Flamm-/Induktionshärten) */
  hardSurface: boolean
  /** einsatzgehärteter Einsatzstahl (für Keil- und Zahnwellen β = 1) */
  caseHardened: boolean
}

export type RoughnessMode =
  /** K_F nach Gl. (18)/(19) aus Rz */
  | { mode: 'rz' }
  /** K_F = 1, weil im experimentellen β bereits enthalten */
  | { mode: 'one'; reason: string }
  /** K_F = K_F(Rz) / K_F(RzB), Gl. (20)/(21) */
  | { mode: 'ratio'; RzB: number }

export interface NotchResult {
  kind: LoadKind
  beta: number
  /** Wert, mit dem γF nach DIN 743-1 Tabelle 2 bestimmt wird (α, ersatzweise β) */
  gammaBasis: number
  /** Umdrehungskerbe (für γF nach DIN 743-1 Tabelle 2) */
  revolution: boolean
  roughness: RoughnessMode
  quantities: Quantity[]
  notes: string[]
}

const sym = (base: string, kind: LoadKind) => `${base}${kind === 't' ? 'τ' : 'σ'}`
const sub = (kind: LoadKind) => (kind === 'zd' ? ',zd' : kind === 'b' ? ',b' : '')

// ---------------------------------------------------------------------------
// Kerben mit bekannter Formzahl

/** Formzahlkonstanten nach DIN 743-2, Tabelle 3 */
const formConstants = {
  groove: { zd: { A: 0.22, B: 1.37, C: 0, z: 0 }, b: { A: 0.2, B: 2.75, C: 0, z: 0 }, t: { A: 0.7, B: 10.3, C: 0, z: 0 } },
  shoulder: { zd: { A: 0.62, B: 3.5, C: 0, z: 0 }, b: { A: 0.62, B: 5.8, C: 0.2, z: 3 }, t: { A: 3.4, B: 19, C: 1, z: 2 } },
}

/** Stützzahl n nach DIN 743-2, Gl. (5) bzw. (6) */
function supportNumber(Gp: number, alpha: number, ctx: NotchContext, kind: LoadKind): Quantity {
  const s = `n${sub(kind)}${kind === 't' ? ',τ' : ''}`
  if (ctx.hardSurface) {
    const n = 1 + Math.sqrt(Gp) * 10 ** -0.7
    return {
      symbol: s,
      label: 'Stützzahl (harte Randschicht)',
      value: Math.min(n, alpha),
      unit: '',
      formula: "n = 1 + √(G' · mm) · 10^(−0,7)",
      substitution: `1 + √${num(Gp)} · 10^(−0,7)`,
      ref: 'DIN 743-2, Gl. (6)',
      note: n > alpha ? 'n > α, daher n = α gesetzt (Bild 4, Anmerkung 1).' : undefined,
    }
  }
  const n = 1 + Math.sqrt(Gp) * 10 ** -(0.33 + ctx.sigmaSd / 712)
  return {
    symbol: s,
    label: 'Stützzahl',
    value: Math.min(n, alpha),
    unit: '',
    formula: "n = 1 + √(G' · mm) · 10^−(0,33 + σS(d) / 712 N/mm²)",
    substitution: `1 + √${num(Gp)} · 10^−(0,33 + ${num(ctx.sigmaSd)} / 712)`,
    ref: 'DIN 743-2, Gl. (5)',
    note:
      (n > alpha ? 'n > α, daher n = α gesetzt (Bild 4, Anmerkung 1). ' : '') +
      'Der Werkstoff „stützt“ die Kerbspitze: Weil die Spannung von der Oberfläche nach innen schnell abfällt, wirkt die Spannungsspitze weniger schädigend als α vermuten lässt.',
  }
}

function formNotch(
  shape: 'shoulder' | 'groove',
  notch: { D: number; r: number; t?: number },
  kind: LoadKind,
  ctx: NotchContext,
): NotchResult {
  const { d } = ctx
  const { D, r } = notch
  const t = notch.t ?? (D - d) / 2
  const c = formConstants[shape][kind]
  const notes: string[] = []
  const figure = { shoulder: { zd: 8, b: 9, t: 10 }, groove: { zd: 5, b: 6, t: 7 } }[shape][kind]

  const rt = r / t
  const rd = r / d
  const dD = d / D
  const denom = c.A * rt + 2 * c.B * rd * (1 + 2 * rd) ** 2 + c.C * rt ** c.z * dD
  const alpha = 1 + 1 / Math.sqrt(denom)
  if (rt < 0.03) notes.push('r/t < 0,03: außerhalb des Gültigkeitsbereichs der Formzahlgleichung.')
  if (dD > 0.98) notes.push('d/D > 0,98: außerhalb des Gültigkeitsbereichs der Formzahlgleichung.')
  if (alpha > 6) notes.push('α > 6: außerhalb des Gültigkeitsbereichs der Formzahlgleichung.')
  if (c.C === 0 && rt > 1 && kind !== 't' && shape === 'shoulder')
    notes.push('Für r/t > 1 liefert Gl. (9) ohne C-Glied etwas zu große Formzahlen (sichere Seite).')

  const cTerm = c.C ? ` + ${num(c.C)} · (r/t)^${c.z} · d/D` : ''
  const cSub = c.C ? ` + ${num(c.C)} · ${num(rt)}^${c.z} · ${num(dD)}` : ''
  const alphaQ: Quantity = {
    symbol: sym('α', kind) + sub(kind),
    label: `Formzahl (${shape === 'shoulder' ? 'Absatz' : 'Rundnut'})`,
    value: alpha,
    unit: '',
    formula: `α = 1 + 1 / √(${num(c.A)} · r/t + ${num(2 * c.B)} · r/d · (1 + 2 · r/d)²${cTerm})`,
    substitution: `1 + 1 / √(${num(c.A)} · ${num(rt)} + ${num(2 * c.B)} · ${num(rd)} · (1 + 2 · ${num(rd)})²${cSub})`,
    ref: `DIN 743-2, Gl. (9), Tabelle 3, Bild ${figure}`,
    note: 'Die Formzahl gibt an, um wie viel die örtliche Spannung im Kerbgrund bei rein elastischem Verhalten über der Nennspannung liegt.',
  }

  const phi = dD > 0.67 && r > 0 ? 1 / (4 * Math.sqrt(t / r) + 2) : 0
  const phiQ: Quantity = {
    symbol: 'φ',
    label: 'Hilfsgröße für das Spannungsgefälle',
    value: phi,
    unit: '',
    formula: dD > 0.67 ? 'φ = 1 / (4 · √(t/r) + 2)' : 'd/D ≤ 0,67: φ = 0',
    substitution: dD > 0.67 ? `1 / (4 · √(${num(t)} / ${num(r)}) + 2)` : undefined,
    ref: 'DIN 743-2, Tabelle 2',
  }
  const k = shape === 'shoulder' ? (kind === 't' ? 1.15 : 2.3) : kind === 't' ? 1 : 2
  const Gp = kind === 't' ? k / r : (k * (1 + phi)) / r
  const GpQ: Quantity = {
    symbol: "G'" + sub(kind) + (kind === 't' ? ',τ' : ''),
    label: 'Bezogenes Spannungsgefälle',
    value: Gp,
    unit: '1/mm',
    formula: kind === 't' ? `G' = ${num(k)} / r` : `G' = ${num(k)} · (1 + φ) / r`,
    substitution: kind === 't' ? `${num(k)} / ${num(r)} mm` : `${num(k)} · (1 + ${num(phi)}) / ${num(r)} mm`,
    ref: 'DIN 743-2, Tabelle 2',
    note: 'Wie schnell die Spannung vom Kerbgrund ins Innere abfällt, bezogen auf die Spannungsspitze. Je schärfer die Kerbe, desto größer G\'.',
  }
  const nQ = supportNumber(Gp, alpha, ctx, kind)
  const beta = alpha / nQ.value
  const betaQ: Quantity = {
    symbol: sym('β', kind) + sub(kind),
    label: 'Kerbwirkungszahl',
    value: beta,
    unit: '',
    formula: 'β = α / n',
    substitution: `${num(alpha)} / ${num(nQ.value)}`,
    ref: 'DIN 743-2, Gl. (4)',
    note: 'Um diesen Faktor sinkt die Wechselfestigkeit durch die Kerbe gegenüber dem glatten Stab.',
  }
  const quantities = [
    { symbol: 't', label: 'Kerbtiefe', value: t, unit: 'mm', formula: notch.t === undefined ? 't = (D − d) / 2' : undefined },
    { symbol: 'r/t', label: 'Verhältnis Radius zu Kerbtiefe', value: rt, unit: '' },
    { symbol: 'r/d', label: 'Verhältnis Radius zu Durchmesser', value: rd, unit: '' },
    { symbol: 'd/D', label: 'Durchmesserverhältnis', value: dD, unit: '' },
    alphaQ,
  ]
  if (kind !== 't') quantities.push(phiQ)
  quantities.push(GpQ, nQ, betaQ)
  return { kind, beta, gammaBasis: alpha, revolution: true, roughness: { mode: 'rz' }, quantities, notes }
}

function crossHole(notch: { r: number }, kind: LoadKind, ctx: NotchContext): NotchResult {
  const { d } = ctx
  const { r } = notch
  const x = (2 * r) / d
  let alpha: number
  let aFormula: string
  let aSub: string
  let Gp: number
  let gFormula: string
  let gSub: string
  if (kind === 'zd') {
    alpha = 3 - x
    aFormula = 'α = 3 − 2r/d'
    aSub = `3 − ${num(x)}`
    Gp = 2.3 / r
    gFormula = "G' = 2,3 / r"
    gSub = `2,3 / ${num(r)} mm`
  } else if (kind === 'b') {
    alpha = 3 + 1.4 * x - 2.8 * Math.sqrt(x)
    aFormula = 'α = 3 + 1,4 · (2r/d) − 2,8 · √(2r/d)'
    aSub = `3 + 1,4 · ${num(x)} − 2,8 · √${num(x)}`
    Gp = 2.3 / r + 2 / d
    gFormula = "G' = 2,3 / r + 2 / d"
    gSub = `2,3 / ${num(r)} mm + 2 / ${num(d)} mm`
  } else {
    alpha = 2.023 - 1.125 * Math.sqrt(x)
    aFormula = 'α = 2,023 − 1,125 · √(2r/d)'
    aSub = `2,023 − 1,125 · √${num(x)}`
    Gp = 1.15 / r + 2 / d
    gFormula = "G' = 1,15 / r + 2 / d"
    gSub = `1,15 / ${num(r)} mm + 2 / ${num(d)} mm`
  }
  const notes: string[] = []
  if (x > 0.3) notes.push('2r/d > 0,3 liegt außerhalb des Diagrammbereichs von Bild 12.')
  const nQ = supportNumber(Gp, alpha, ctx, kind)
  const beta = alpha / nQ.value
  return {
    kind,
    beta,
    gammaBasis: alpha,
    revolution: false,
    roughness: { mode: 'rz' },
    notes,
    quantities: [
      { symbol: '2r/d', label: 'bezogener Bohrungsdurchmesser', value: x, unit: '' },
      { symbol: sym('α', kind) + sub(kind), label: 'Formzahl (Querbohrung)', value: alpha, unit: '', formula: aFormula, substitution: aSub, ref: 'DIN 743-2, Bild 12' },
      { symbol: "G'" + sub(kind), label: 'Bezogenes Spannungsgefälle', value: Gp, unit: '1/mm', formula: gFormula, substitution: gSub, ref: 'DIN 743-2, Bild 12' },
      nQ,
      { symbol: sym('β', kind) + sub(kind), label: 'Kerbwirkungszahl', value: beta, unit: '', formula: 'β = α / n', substitution: `${num(alpha)} / ${num(nQ.value)}`, ref: 'DIN 743-2, Gl. (4)' },
    ],
  }
}

// ---------------------------------------------------------------------------
// experimentell bestimmte Kerbwirkungszahlen

interface Experimental {
  betaDBK: Quantity[]
  /** β(dBK) für die Umrechnung */
  betaRef: number
  dBK: number
  roughness: RoughnessMode
  revolution: boolean
  /** Faktor nach der Umrechnung (zwei Passfedern) */
  postFactor?: { value: number; text: string }
  /** Obergrenze für β (Sicherungsringnut) */
  cap?: number
  notes: string[]
}

function experimental(e: Experimental, kind: LoadKind, d: number): NotchResult {
  const s = sym('β', kind) + sub(kind)
  const k3d = geometricSizeFactorK3(d, e.betaRef, 'K3(d)')
  const k3BK = geometricSizeFactorK3(e.dBK, e.betaRef, 'K3(dBK)')
  k3d.note = 'Bei experimentell bestimmten Kerbwirkungszahlen ersetzt β(dBK) die Formzahl in Gl. (17).'
  let beta = (e.betaRef * k3BK.value) / k3d.value
  const quantities: Quantity[] = [
    ...e.betaDBK,
    { symbol: 'dBK', label: 'Kerb-Bezugsdurchmesser (Probendurchmesser)', value: e.dBK, unit: 'mm' },
    k3d,
    k3BK,
    {
      symbol: s,
      label: 'Kerbwirkungszahl für den Bauteildurchmesser',
      value: beta,
      unit: '',
      formula: 'β = β(dBK) · K3(dBK) / K3(d)',
      substitution: `${num(e.betaRef)} · ${num(k3BK.value)} / ${num(k3d.value)}`,
      ref: 'DIN 743-2, Gl. (3)',
      note: 'Die Versuchswerte gelten für die Probe mit dBK; bei einem anderen Durchmesser ändert sich die Kerbwirkung mit dem Spannungsgefälle.',
    },
  ]
  if (e.postFactor) {
    beta *= e.postFactor.value
    quantities.push({
      symbol: s,
      label: e.postFactor.text,
      value: beta,
      unit: '',
      formula: `β = ${num(e.postFactor.value)} · β`,
      ref: 'DIN 743-2, Tabelle 1',
    })
  }
  const notes = [...e.notes]
  if (e.cap !== undefined && beta > e.cap) {
    notes.push(`β = ${num(beta)} > ${num(e.cap)}: nach DIN 743-2, 4.2.4 wird mit β = ${num(e.cap)} gerechnet.`)
    beta = e.cap
  }
  return {
    kind,
    beta,
    gammaBasis: e.betaRef,
    revolution: e.revolution,
    roughness: e.roughness,
    quantities,
    notes,
  }
}

const oneKF = (reason: string): RoughnessMode => ({ mode: 'one', reason })

function keyway(count: 1 | 2, kind: LoadKind, ctx: NotchContext): NotchResult {
  const sB = ctx.sigmaBd
  const bs = 3.0 * (sB / 1000) ** 0.38
  const bsQ: Quantity = {
    symbol: 'βσ(dBK)',
    label: 'Kerbwirkungszahl der Probe (Biegung, Zug/Druck)',
    value: bs,
    unit: '',
    formula: 'βσ(dBK) = 3,0 · (σB(d) / 1000 N/mm²)^0,38',
    substitution: `3,0 · (${num(sB)} / 1000)^0,38`,
    ref: 'DIN 743-2, Tabelle 1',
    note: 'Richtwert aus Versuchen an Passfederverbindungen; gilt für das Ende des Nabensitzes.',
  }
  const quantities = [bsQ]
  let betaRef = bs
  if (kind === 't') {
    betaRef = 0.56 * bs + 0.1
    quantities.push({
      symbol: 'βτ(dBK)',
      label: 'Kerbwirkungszahl der Probe (Torsion)',
      value: betaRef,
      unit: '',
      formula: 'βτ(dBK) = 0,56 · βσ(dBK) + 0,1',
      substitution: `0,56 · ${num(bs)} + 0,1`,
      ref: 'DIN 743-2, Tabelle 1',
    })
  }
  return experimental(
    {
      betaDBK: quantities,
      betaRef,
      dBK: 40,
      roughness: oneKF('Bei den Kerbwirkungszahlen nach Tabelle 1 ist KF = 1 zu setzen.'),
      revolution: false,
      postFactor: count === 2 ? { value: 1.15, text: 'Kerbwirkungszahl bei zwei Passfedern' } : undefined,
      notes: [
        'Die Tabellenwerte sind Richtwerte. Bei reiner Umlaufbiegung (τtm/σba = 0) sind Tragfähigkeitsminderungen bis Faktor 1,3 möglich, bei τtm/σba > 0,5 steigt die Belastbarkeit (DIN 743-2, Tabelle 1, Fußnote a).',
      ],
    },
    kind,
    ctx.d,
  )
}

function pressFit(kind: LoadKind, ctx: NotchContext): NotchResult {
  const sB = ctx.sigmaBd
  const bs = 2.7 * (sB / 1000) ** 0.43
  const quantities: Quantity[] = [
    {
      symbol: 'βσ(dBK)',
      label: 'Kerbwirkungszahl der Probe (Biegung, Zug/Druck)',
      value: bs,
      unit: '',
      formula: 'βσ(dBK) = 2,7 · (σB(d) / 1000 N/mm²)^0,43',
      substitution: `2,7 · (${num(sB)} / 1000)^0,43`,
      ref: 'DIN 743-2, Tabelle 1',
    },
  ]
  let betaRef = bs
  if (kind === 't') {
    betaRef = 0.65 * bs
    quantities.push({
      symbol: 'βτ(dBK)',
      label: 'Kerbwirkungszahl der Probe (Torsion)',
      value: betaRef,
      unit: '',
      formula: 'βτ(dBK) = 0,65 · βσ(dBK)',
      substitution: `0,65 · ${num(bs)}`,
      ref: 'DIN 743-2, Tabelle 1',
    })
  }
  return experimental(
    {
      betaDBK: quantities,
      betaRef,
      dBK: 40,
      roughness: oneKF('Bei den Kerbwirkungszahlen nach Tabelle 1 ist KF = 1 zu setzen.'),
      revolution: false,
      notes: ['Richtwerte für das Ende des Nabensitzes. Gefügte Teile hoher Pressung sind gesondert zu prüfen (Tribokorrosion), siehe DIN 7190.'],
    },
    kind,
    ctx.d,
  )
}

function spline(kind: SplineKind, load: LoadKind, ctx: NotchContext): NotchResult {
  const name = { straight: 'Keilwelle', serration: 'Kerbzahnwelle', involute: 'Zahnwelle mit Evolventenverzahnung' }[kind]
  if (ctx.caseHardened) {
    return {
      kind: load,
      beta: 1,
      gammaBasis: 1,
      revolution: false,
      roughness: oneKF('Für Keil- und Zahnwellen ist KF = 1.'),
      quantities: [
        { symbol: sym('β', load) + sub(load), label: `Kerbwirkungszahl (${name}, einsatzgehärtet)`, value: 1, unit: '', ref: 'DIN 743-2, 4.2.2' },
      ],
      notes: ['Bei einsatzgehärteten Einsatzstählen gilt β = 1 und KV = 1 (DIN 743-2, 4.2.2).'],
    }
  }
  const sB = ctx.sigmaBd
  const bStar = Math.exp(4.2e-7 * sB ** 2)
  const quantities: Quantity[] = [
    {
      symbol: 'βτ*(dBK)',
      label: 'Hilfsgröße der Kerbwirkungszahl',
      value: bStar,
      unit: '',
      formula: 'βτ*(dBK) = exp(4,2 · 10⁻⁷ · (σB(d) / N/mm²)²)',
      substitution: `exp(4,2 · 10⁻⁷ · ${num(sB)}²)`,
      ref: 'DIN 743-2, 4.2.2, Bild 1',
    },
  ]
  let factor: number
  if (load === 't') factor = kind === 'involute' ? 0.75 : 1
  else factor = { straight: 0.45, serration: 0.65, involute: 0.49 }[kind]
  const betaRef = 1 + factor * (bStar - 1)
  quantities.push({
    symbol: sym('β', load) + '(dBK)',
    label: `Kerbwirkungszahl der Probe (${name})`,
    value: betaRef,
    unit: '',
    formula: factor === 1 ? 'βτ(dBK) = βτ*(dBK)' : `β(dBK) = 1 + ${num(factor)} · (βτ*(dBK) − 1)`,
    substitution: factor === 1 ? undefined : `1 + ${num(factor)} · (${num(bStar)} − 1)`,
    ref: 'DIN 743-2, 4.2.2',
  })
  return experimental(
    {
      betaDBK: quantities,
      betaRef,
      dBK: 29,
      roughness: oneKF('Für Keil- und Zahnwellen ist KF = 1.'),
      revolution: false,
      notes: [
        ...(load === 'zd' ? ['Für Zug/Druck gelten näherungsweise die Werte für Biegung.'] : []),
        'Die Werte gelten für die Welle ohne Nabeneinfluss; bei steifer Nabe können die Kerbwirkungszahlen deutlich größer sein.',
      ],
    },
    load,
    ctx.d,
  )
}

function vNotch(kind: LoadKind, ctx: NotchContext): NotchResult {
  const x = ctx.sigmaBd / 100
  const bBend = 0.0923 * x + 0.985
  let betaRef: number
  const quantities: Quantity[] = []
  if (kind === 'zd') {
    betaRef = 0.109 * x + 1.074
    quantities.push({
      symbol: 'βσ(dBK)', label: 'Kerbwirkungszahl der Probe (Zug/Druck)', value: betaRef, unit: '',
      formula: 'βσ(dBK) = 0,109 · σB(d) / 100 N/mm² + 1,074', substitution: `0,109 · ${num(x)} + 1,074`, ref: 'DIN 743-2, 4.2.3, Bild 2',
    })
  } else {
    quantities.push({
      symbol: 'βσ(dBK)', label: 'Kerbwirkungszahl der Probe (Biegung)', value: bBend, unit: '',
      formula: 'βσ(dBK) = 0,0923 · σB(d) / 100 N/mm² + 0,985', substitution: `0,0923 · ${num(x)} + 0,985`, ref: 'DIN 743-2, 4.2.3, Bild 2',
    })
    betaRef = bBend
    if (kind === 't') {
      betaRef = 0.8 * bBend
      quantities.push({
        symbol: 'βτ(dBK)', label: 'Kerbwirkungszahl der Probe (Torsion)', value: betaRef, unit: '',
        formula: 'βτ(dBK) = 0,80 · βσ,Biegung(dBK)', substitution: `0,80 · ${num(bBend)}`, ref: 'DIN 743-2, 4.2.3',
      })
    }
  }
  return experimental(
    {
      betaDBK: quantities,
      betaRef,
      dBK: 15,
      roughness: { mode: 'ratio', RzB: 20 },
      revolution: true,
      notes: ['Gilt für Kerbradius r = 0,1 mm und t/d = 0,05 bis 0,20.'],
    },
    kind,
    ctx.d,
  )
}

function ringGroove(notch: { D: number; m: number; r: number }, kind: LoadKind, ctx: NotchContext): NotchResult {
  const { d } = ctx
  const { D, m, r } = notch
  const t = (D - d) / 2
  const rho = 10 ** -(0.514 + 0.00152 * ctx.sigmaSd)
  const rf = kind === 't' ? r + rho : r + 2.9 * rho
  const q = Math.sqrt(t / rf)
  let bStar: number
  let bFormula: string
  let bSub: string
  if (kind === 'zd') {
    bStar = 0.9 * (1.27 + 1.17 * q)
    bFormula = 'βσ*(dBK) = 0,9 · (1,27 + 1,17 · √(t / rf))'
    bSub = `0,9 · (1,27 + 1,17 · √(${num(t)} / ${num(rf)}))`
  } else if (kind === 'b') {
    bStar = 0.9 * (1.14 + 1.08 * q)
    bFormula = 'βσ*(dBK) = 0,9 · (1,14 + 1,08 · √(t / rf))'
    bSub = `0,9 · (1,14 + 1,08 · √(${num(t)} / ${num(rf)}))`
  } else {
    bStar = 1.48 + 0.45 * q
    bFormula = 'βτ*(dBK) = 1,48 + 0,45 · √(t / rf)'
    bSub = `1,48 + 0,45 · √(${num(t)} / ${num(rf)})`
  }
  const mt = m / t
  const betaRef = mt >= 1.4 ? bStar : bStar * 1.08 * mt ** -0.2
  const s = kind === 't' ? 'τ' : 'σ'
  const quantities: Quantity[] = [
    { symbol: 't', label: 'Nuttiefe', value: t, unit: 'mm', formula: 't = (D − d) / 2', substitution: `(${num(D)} − ${num(d)}) / 2` },
    {
      symbol: 'ρ*', label: 'Strukturradius nach Neuber', value: rho, unit: 'mm',
      formula: 'ρ* = 10^−(0,514 + 0,00152 · σS(d) / N/mm²) mm', substitution: `10^−(0,514 + 0,00152 · ${num(ctx.sigmaSd)})`,
      ref: 'DIN 743-2, 4.2.4, Bild 3',
      note: 'Werkstoffkenngröße: Je fester der Stahl, desto kleiner ρ* und desto empfindlicher reagiert er auf scharfe Kerben.',
    },
    {
      symbol: 'rf', label: 'korrigierter Rundungsradius', value: rf, unit: 'mm',
      formula: kind === 't' ? 'rf = r + ρ*' : 'rf = r + 2,9 · ρ*',
      substitution: kind === 't' ? `${num(r)} + ${num(rho)}` : `${num(r)} + 2,9 · ${num(rho)}`,
      ref: 'DIN 743-2, 4.2.4',
    },
    { symbol: `β${s}*(dBK)`, label: 'Hilfsgröße der Kerbwirkungszahl', value: bStar, unit: '', formula: bFormula, substitution: bSub, ref: 'DIN 743-2, 4.2.4' },
    { symbol: 'm/t', label: 'Verhältnis Nutbreite zu Nuttiefe', value: mt, unit: '' },
    {
      symbol: `β${s}(dBK)`, label: 'Kerbwirkungszahl der Probe', value: betaRef, unit: '',
      formula: mt >= 1.4 ? `m/t ≥ 1,4: β(dBK) = β*(dBK)` : `m/t < 1,4: β(dBK) = β*(dBK) · 1,08 · (m/t)^−0,2`,
      substitution: mt >= 1.4 ? undefined : `${num(bStar)} · 1,08 · ${num(mt)}^−0,2`,
      ref: 'DIN 743-2, 4.2.4',
    },
  ]
  return experimental(
    {
      betaDBK: quantities,
      betaRef,
      dBK: 30,
      roughness: { mode: 'ratio', RzB: 20 },
      revolution: true,
      cap: kind === 't' ? 2.5 : 4,
      notes: ['Werden wesentliche Axialkräfte über die Nutflanke eingeleitet, ist gesondert zu rechnen (DIN 743-2, 4.2.4).'],
    },
    kind,
    ctx.d,
  )
}

/** Kerbwirkungszahl β für eine Beanspruchungsart */
export function notchFactor(notch: NotchInput, kind: LoadKind, ctx: NotchContext): NotchResult {
  switch (notch.type) {
    case 'none':
      return {
        kind,
        beta: 1,
        gammaBasis: 1,
        revolution: false,
        roughness: { mode: 'rz' },
        quantities: [{ symbol: sym('β', kind) + sub(kind), label: 'Kerbwirkungszahl (ungekerbt)', value: 1, unit: '' }],
        notes: [],
      }
    case 'shoulder':
    case 'groove':
      return formNotch(notch.type, notch, kind, ctx)
    case 'crossHole':
      return crossHole(notch, kind, ctx)
    case 'keyway':
      return keyway(notch.count, kind, ctx)
    case 'pressFit':
      return pressFit(kind, ctx)
    case 'spline':
      return spline(notch.kind, kind, ctx)
    case 'vNotch':
      return vNotch(kind, ctx)
    case 'ringGroove':
      return ringGroove(notch, kind, ctx)
    case 'custom': {
      const beta = kind === 'zd' ? notch.betaZd : kind === 'b' ? notch.betaB : notch.betaT
      return {
        kind,
        beta,
        gammaBasis: beta,
        revolution: notch.revolution,
        roughness: { mode: 'rz' },
        quantities: [{ symbol: sym('β', kind) + sub(kind), label: 'Kerbwirkungszahl (Eingabe)', value: beta, unit: '' }],
        notes: [],
      }
    }
  }
}

/** Querschnittswerte für die Nennspannung im Kerbquerschnitt */
export interface Section {
  A: Quantity
  Wb: Quantity
  Wt: Quantity
}

export function nominalSection(notch: NotchInput, d: number, di: number): Section {
  if (notch.type === 'crossHole') {
    const r = notch.r
    return {
      A: { symbol: 'A', label: 'Nennquerschnitt (mit Querbohrung)', value: (Math.PI * d ** 2) / 4 - 2 * r * d, unit: 'mm²', formula: 'A = π · d² / 4 − 2 · r · d', ref: 'DIN 743-2, Bild 12' },
      Wb: { symbol: 'Wb', label: 'Biegewiderstandsmoment (mit Querbohrung)', value: (Math.PI * d ** 3) / 32 - (r * d ** 2) / 3, unit: 'mm³', formula: 'Wb = π · d³ / 32 − r · d² / 3', ref: 'DIN 743-2, Bild 12' },
      Wt: { symbol: 'Wt', label: 'Torsionswiderstandsmoment (mit Querbohrung)', value: (Math.PI * d ** 3) / 16 - (r * d ** 2) / 3, unit: 'mm³', formula: 'Wt = π · d³ / 16 − r · d² / 3', ref: 'DIN 743-2, Bild 12' },
    }
  }
  const hollow = di > 0
  return {
    A: {
      symbol: 'A', label: 'Querschnittsfläche', value: (Math.PI / 4) * (d ** 2 - di ** 2), unit: 'mm²',
      formula: hollow ? 'A = π / 4 · (d² − di²)' : 'A = π · d² / 4',
      substitution: hollow ? `π / 4 · (${num(d)}² − ${num(di)}²)` : `π · ${num(d)}² / 4`,
      ref: 'DIN 743-1, Tabelle 1',
    },
    Wb: {
      symbol: 'Wb', label: 'Biegewiderstandsmoment', value: ((Math.PI / 32) * (d ** 4 - di ** 4)) / d, unit: 'mm³',
      formula: hollow ? 'Wb = π / 32 · (d⁴ − di⁴) / d' : 'Wb = π · d³ / 32',
      substitution: hollow ? `π / 32 · (${num(d)}⁴ − ${num(di)}⁴) / ${num(d)}` : `π · ${num(d)}³ / 32`,
      ref: 'DIN 743-1, Tabelle 1',
    },
    Wt: {
      symbol: 'Wt', label: 'Torsionswiderstandsmoment', value: ((Math.PI / 16) * (d ** 4 - di ** 4)) / d, unit: 'mm³',
      formula: hollow ? 'Wt = π / 16 · (d⁴ − di⁴) / d' : 'Wt = π · d³ / 16',
      substitution: hollow ? `π / 16 · (${num(d)}⁴ − ${num(di)}⁴) / ${num(d)}` : `π · ${num(d)}³ / 16`,
      ref: 'DIN 743-1, Tabelle 1',
    },
  }
}

/** Erhöhungsfaktor der Fließgrenze γF, DIN 743-1, Tabelle 2 */
export function yieldIncreaseFactor(n: NotchResult, hardSurface: boolean): Quantity {
  const base = { symbol: n.kind === 't' ? 'γF,τ' : 'γF,σ', label: 'Erhöhungsfaktor der Fließgrenze', unit: '', ref: 'DIN 743-1, Tabelle 2' }
  if (n.kind === 't') return { ...base, value: 1, formula: 'Torsion: γF = 1' }
  if (hardSurface) return { ...base, value: 1, formula: 'harte Randschicht: γF = 1' }
  if (!n.revolution) return { ...base, value: 1, formula: 'keine Umdrehungskerbe: γF = 1' }
  const a = n.gammaBasis
  const value = a <= 1.5 ? 1 : a <= 2 ? 1.05 : a <= 3 ? 1.1 : 1.15
  const range = a <= 1.5 ? 'bis 1,5' : a <= 2 ? '1,5 bis 2,0' : a <= 3 ? '2,0 bis 3,0' : 'über 3,0'
  return {
    ...base,
    value,
    formula: `α bzw. β = ${num(a)} (${range}): γF = ${num(value)}`,
    note: 'An Umdrehungskerben herrscht ein mehrachsiger Spannungszustand, der das Fließen behindert und die Fließgrenze des Bauteils anhebt.',
  }
}

/** Statische Stützwirkung K2F, DIN 743-1, Tabelle 3 */
export function staticSupportFactor(kind: LoadKind, hollow: boolean, hardSurface: boolean): Quantity {
  const base = { symbol: kind === 't' ? 'K2F,τ' : 'K2F,σ', label: 'Statische Stützwirkung', unit: '', ref: 'DIN 743-1, Tabelle 3' }
  if (hardSurface) return { ...base, value: 1, formula: 'harte Randschicht: K2F = 1' }
  const table = hollow ? { zd: 1, b: 1.1, t: 1 } : { zd: 1, b: 1.2, t: 1.2 }
  return {
    ...base,
    value: table[kind],
    formula: `${hollow ? 'Hohlwelle' : 'Vollwelle'}, ${kind === 'zd' ? 'Zug/Druck' : kind === 'b' ? 'Biegung' : 'Torsion'}: K2F = ${num(table[kind])}`,
    note: kind === 'zd' ? undefined : 'Bei Biegung und Torsion fließt zuerst nur die Randfaser; der noch elastische Kern trägt mit, bevor sich das Bauteil bleibend verformt.',
  }
}

