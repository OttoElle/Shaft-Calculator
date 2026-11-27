/**
 * Tragfähigkeitsnachweis für Wellen und Achsen nach DIN 743-1 bis -3
 * (Teil 1 und 2: 2012-12, Teil 3: 2024-07) für einen Kerbquerschnitt.
 *
 * Ablauf wie in DIN 743-1, Anhang B:
 *  1. Werkstoffkennwerte für den Bezugsdurchmesser (Teil 3)
 *  2. Technologischer Größeneinfluss K1(deff) (Teil 2)
 *  3. Kerbwirkungszahlen β (Teil 2)
 *  4. Gesamteinflussfaktoren Kσ, Kτ (Teil 1, Gl. (8), (9))
 *  5. Wirkende Spannungen (Teil 1, Tabellen 1 und 4)
 *  6. Bauteilfließgrenzen (Teil 1, Gl. (31), (32))
 *  7. Bauteildauerfestigkeit für die vorhandene Mittelspannung (Teil 1, Gl. (5) bis (24))
 *  8. Sicherheit gegen Dauerbruch (Teil 1, Gl. (2))
 *  9. Sicherheit gegen bleibende Verformung (Teil 1, Gl. (25))
 *
 * Einheiten: Längen in mm, Spannungen in N/mm², Kräfte in N, Momente in N·m.
 *
 * Nicht enthalten: Nachweis gegen Anriss bei harten Randschichten (Teil 1, 5.1.2),
 * Zeitfestigkeit (Teil 4).
 */

import { materialGroupLabel, type Material } from './data/materials'
import { num } from './format'
import {
  nominalSection,
  notchFactor,
  notchLabel,
  staticSupportFactor,
  yieldIncreaseFactor,
  type NotchInput,
  type NotchResult,
} from './notches'
import { geometricSizeFactorK2, technologicalSizeFactor } from './sizeFactors'
import { loadKindLabel, type Check, type LoadKind, type Quantity, type Step } from './types'

export type { NotchInput } from './notches'

/** Beanspruchungsfall nach DIN 743-1, 4.3 */
export type LoadCase = 1 | 2

/** Belastung als Schnittgrößen im Kerbquerschnitt */
export interface ForceLoads {
  type: 'forces'
  /** Axialkraft Mittelwert / Amplitude in N (Zug positiv) */
  Fzdm?: number
  Fzda?: number
  /** Biegemoment Mittelwert / Amplitude in N·m (bei Umlaufbiegung: Mbm = 0, Mba = Mb) */
  Mbm?: number
  Mba?: number
  /** Torsionsmoment Mittelwert / Amplitude in N·m */
  Mtm?: number
  Mta?: number
  /** Maximalwerte für den Nachweis gegen bleibende Verformung (Standard: Mittelwert + Amplitude) */
  Fzdmax?: number
  Mbmax?: number
  Mtmax?: number
}

/** Belastung direkt als Nennspannungen in N/mm² */
export interface StressLoads {
  type: 'stresses'
  sigmaZdm?: number
  sigmaZda?: number
  sigmaBm?: number
  sigmaBa?: number
  tauTm?: number
  tauTa?: number
  sigmaZdmax?: number
  sigmaBmax?: number
  tauTmax?: number
}

export interface ShaftInput {
  material: Material
  /** Wechselfestigkeiten für dB, falls experimentell bekannt (sonst DIN 743-3, Gl. (1) bis (3)) */
  sigmaZdW?: number
  sigmaBW?: number
  tauTW?: number

  /** Durchmesser im Kerbquerschnitt */
  d: number
  /** Innendurchmesser bei Hohlwellen (Standard 0) */
  di?: number
  /** für die Wärmebehandlung maßgebender Durchmesser (Standard: größter Durchmesser D) */
  deff?: number

  notch: NotchInput
  /** gemittelte Rautiefe Rz in µm im Kerbgrund */
  Rz: number
  /** Einflussfaktor der Oberflächenverfestigung (Standard 1) */
  KV?: number
  /** harte Randschicht (einsatzgehärtet, nitriert, flamm- oder induktionsgehärtet) */
  hardSurface?: boolean

  loads: ForceLoads | StressLoads
  loadCase: LoadCase
  /** Mindestsicherheit (Standard 1,2) */
  Smin?: number
}

export interface KindResult {
  kind: LoadKind
  notch: NotchResult
  K2: number
  KF: number
  K: number
  /** Werkstoffwechselfestigkeit für dB */
  W: number
  /** Bauteilwechselfestigkeit */
  WK: number
  psi: number
  /** Bauteilfließgrenze */
  FK: number
  /** ertragbare Amplitude */
  ADK: number
  /** Gleichung, nach der ADK bestimmt wurde */
  ADKeq: string
  /** vorhandene Spannungen */
  m: number
  a: number
  max: number
}

export interface ShaftResult {
  steps: Step[]
  kinds: Partial<Record<LoadKind, KindResult>>
  K1B: number
  K1S: number
  sigmaMv: number
  tauMv: number
  fatigue: Check
  static: Check
  warnings: string[]
}

const NM = 1000 // N·m → N·mm

const roughnessFactor = (Rz: number, sigmaBd: number) => {
  const RzEff = Math.max(Rz, 1)
  return Math.min(1, 1 - 0.22 * Math.log10(RzEff) * (Math.log10(sigmaBd / 20) - 1))
}

function stressSymbols(kind: LoadKind) {
  return kind === 'zd'
    ? { m: 'σzdm', a: 'σzda', max: 'σzdmax', W: 'σzdW', WK: 'σzdWK', psi: 'ψzdσK', FK: 'σzdFK', ADK: 'σzdADK', K: 'Kσ,zd', KF: 'KFσ' }
    : kind === 'b'
      ? { m: 'σbm', a: 'σba', max: 'σbmax', W: 'σbW', WK: 'σbWK', psi: 'ψbσK', FK: 'σbFK', ADK: 'σbADK', K: 'Kσ,b', KF: 'KFσ' }
      : { m: 'τtm', a: 'τta', max: 'τtmax', W: 'τtW', WK: 'τtWK', psi: 'ψτK', FK: 'τtFK', ADK: 'τtADK', K: 'Kτ', KF: 'KFτ' }
}

export function calculate(input: ShaftInput): ShaftResult {
  const { material: mat, d, notch } = input
  const di = input.di ?? 0
  const hollow = di > 0
  const hard = input.hardSurface ?? false
  const KV = input.KV ?? 1
  const Smin = input.Smin ?? 1.2
  const warnings: string[] = []
  const steps: Step[] = []

  const notchD = 'D' in notch ? notch.D : d
  const deff = input.deff ?? Math.max(d, notchD)

  // ------------------------------------------------------------------ 1 Werkstoff
  const W0 = {
    zd: input.sigmaZdW ?? 0.4 * mat.sigmaB,
    b: input.sigmaBW ?? 0.5 * mat.sigmaB,
    t: input.tauTW ?? 0.3 * mat.sigmaB,
  }
  steps.push({
    id: 'material',
    title: 'Werkstoffkennwerte',
    explanation:
      'Ausgangspunkt sind die Festigkeitswerte einer kleinen, glatten und polierten Probe mit dem Bezugsdurchmesser dB. Alle weiteren Schritte rechnen diese Werte auf das reale, gekerbte Bauteil um.',
    quantities: [
      { symbol: 'σB(dB)', label: `Zugfestigkeit ${mat.name} (${materialGroupLabel[mat.group]})`, value: mat.sigmaB, unit: 'N/mm²', ref: mat.source, note: `gilt für dB = ${mat.dB_B} mm` },
      { symbol: 'σS(dB)', label: 'Streckgrenze', value: mat.sigmaS, unit: 'N/mm²', ref: mat.source, note: `gilt für dB = ${mat.dB_S} mm` },
      wq('σzdW', 'Zug/Druck-Wechselfestigkeit', W0.zd, input.sigmaZdW, '0,4', '(2)', mat.sigmaB),
      wq('σbW', 'Biegewechselfestigkeit', W0.b, input.sigmaBW, '0,5', '(1)', mat.sigmaB),
      wq('τtW', 'Torsionswechselfestigkeit', W0.t, input.tauTW, '0,3', '(3)', mat.sigmaB),
    ],
    checks: [],
    notes: [],
  })

  // ------------------------------------------------------------------ 2 Größeneinfluss K1
  const k1B = technologicalSizeFactor(deff, mat.group, 'B')
  const k1S = technologicalSizeFactor(deff, mat.group, 'S')
  const K1B = k1B.value
  const K1S = k1S.value
  const sigmaBd = K1B * mat.sigmaB
  const sigmaSd = K1S * mat.sigmaS
  steps.push({
    id: 'k1',
    title: 'Technologischer Größeneinfluss',
    explanation:
      'Beim Vergüten oder Härten kühlt ein dicker Querschnitt im Kern langsamer ab und erreicht nicht die Festigkeit der kleinen Probe. K1 rechnet die Probenwerte auf die tatsächliche Bauteilgröße um. Maßgebend ist der Durchmesser bei der Wärmebehandlung deff, in der Regel der größte Durchmesser D.',
    quantities: [
      { symbol: 'deff', label: 'Für die Wärmebehandlung maßgebender Durchmesser', value: deff, unit: 'mm', ref: 'DIN 743-2, 6.2', formula: input.deff === undefined ? 'deff = D' : undefined },
      k1B,
      k1S,
      { symbol: 'σB(d)', label: 'Zugfestigkeit des Bauteils', value: sigmaBd, unit: 'N/mm²', formula: 'σB(d) = K1,B · σB(dB)', substitution: `${num(K1B)} · ${num(mat.sigmaB)}` },
      { symbol: 'σS(d)', label: 'Streckgrenze des Bauteils', value: sigmaSd, unit: 'N/mm²', formula: 'σS(d) = K1,S · σS(dB)', substitution: `${num(K1S)} · ${num(mat.sigmaS)}` },
    ],
    checks: [],
    notes: [],
  })

  // ------------------------------------------------------------------ 5 Spannungen (vorgezogen, um aktive Beanspruchungsarten zu kennen)
  const section = nominalSection(notch, d, di)
  const stresses = nominalStresses(input.loads, section)
  const active = (['zd', 'b', 't'] as LoadKind[]).filter(
    (k) => stresses[k].m !== 0 || stresses[k].a !== 0 || stresses[k].max !== 0,
  )
  if (active.length === 0) warnings.push('Es ist keine Belastung angegeben.')

  // ------------------------------------------------------------------ 3 Kerbwirkung, 4 Gesamteinflussfaktor
  const ctx = {
    d,
    sigmaBd,
    sigmaSd,
    hardSurface: hard,
    caseHardened: hard && (mat.group === 'caseHardening' || mat.group === 'caseHardeningCrNiMo'),
  }
  const kinds: Partial<Record<LoadKind, KindResult>> = {}
  const notchSteps: Step[] = []
  const kSteps: Step[] = []
  for (const kind of active) {
    const nr = notchFactor(notch, kind, ctx)
    notchSteps.push({
      id: `notch-${kind}`,
      title: `Kerbwirkungszahl ${loadKindLabel[kind]} (${notchLabel[notch.type]})`,
      explanation:
        nr.roughness.mode === 'rz' && notch.type !== 'none' && notch.type !== 'custom'
          ? 'Die Kerbe erhöht die örtliche Spannung um die Formzahl α. Weil der Werkstoff kleine, steil abfallende Spannungsspitzen besser erträgt, ist die wirksame Kerbwirkungszahl β = α / n kleiner als α.'
          : notch.type === 'none' || notch.type === 'custom'
            ? 'Kerbwirkungszahl für diesen Querschnitt.'
            : 'Für diese Kerbform gibt die Norm Kerbwirkungszahlen aus Versuchen an einer Probe mit dem Durchmesser dBK an. Sie werden mit K3 auf den Bauteildurchmesser umgerechnet.',
      quantities: nr.quantities,
      checks: [],
      notes: nr.notes,
    })

    const k2 = geometricSizeFactorK2(d, kind)
    const s = stressSymbols(kind)
    const kfQ: Quantity[] = []
    let KF: number
    if (nr.roughness.mode === 'one') {
      KF = 1
      kfQ.push({ symbol: s.KF, label: 'Einflussfaktor der Oberflächenrauheit', value: 1, unit: '', note: nr.roughness.reason, ref: 'DIN 743-2, 7' })
    } else {
      const kfs = roughnessFactor(input.Rz, sigmaBd)
      const kfQs: Quantity = {
        symbol: nr.roughness.mode === 'ratio' ? 'KFσ(Rz)' : 'KFσ',
        label: 'Einflussfaktor der Oberflächenrauheit',
        value: kfs,
        unit: '',
        formula: 'KFσ = 1 − 0,22 · lg(Rz / µm) · (lg(σB(d) / 20 N/mm²) − 1)',
        substitution: `1 − 0,22 · lg(${num(input.Rz)}) · (lg(${num(sigmaBd)} / 20) − 1)`,
        ref: 'DIN 743-2, Gl. (18)',
        note: 'Riefen der Oberfläche wirken wie viele kleine Kerben. Höherfeste Stähle reagieren darauf empfindlicher.',
      }
      let kf = kfs
      if (kind === 't') {
        kf = 0.575 * kfs + 0.425
        kfQ.push(kfQs, {
          symbol: nr.roughness.mode === 'ratio' ? 'KFτ(Rz)' : 'KFτ',
          label: 'Einflussfaktor der Oberflächenrauheit (Torsion)',
          value: kf,
          unit: '',
          formula: 'KFτ = 0,575 · KFσ + 0,425',
          substitution: `0,575 · ${num(kfs)} + 0,425`,
          ref: 'DIN 743-2, Gl. (19)',
        })
      } else kfQ.push(kfQs)
      if (nr.roughness.mode === 'ratio') {
        const RzB = nr.roughness.RzB
        const kfsB = roughnessFactor(RzB, sigmaBd)
        const kfB = kind === 't' ? 0.575 * kfsB + 0.425 : kfsB
        kfQ.push({
          symbol: `${s.KF}(RzB)`,
          label: `Rauheitsfaktor der Versuchsprobe (RzB = ${RzB} µm)`,
          value: kfB,
          unit: '',
          formula: kind === 't' ? 'wie oben mit Rz = RzB, dann 0,575 · KFσ + 0,425' : 'wie oben mit Rz = RzB',
          substitution: `1 − 0,22 · lg(${RzB}) · (lg(${num(sigmaBd)} / 20) − 1)`,
          ref: 'DIN 743-2, Gl. (18)',
        })
        KF = kf / kfB
        kfQ.push({
          symbol: s.KF,
          label: 'Einflussfaktor der Oberflächenrauheit (bezogen auf die Probe)',
          value: KF,
          unit: '',
          formula: `${s.KF} = ${s.KF}(Rz) / ${s.KF}(RzB)`,
          substitution: `${num(kf)} / ${num(kfB)}`,
          ref: `DIN 743-2, Gl. (${kind === 't' ? 21 : 20})`,
          note: 'Die Rauheit der Versuchsprobe steckt schon in β(dBK); es zählt nur der Unterschied zum Bauteil.',
        })
      } else KF = kf
    }
    const K = (nr.beta / k2.value + 1 / KF - 1) / KV
    kSteps.push({
      id: `k-${kind}`,
      title: `Gesamteinflussfaktor ${loadKindLabel[kind]}`,
      explanation:
        'Der Gesamteinflussfaktor fasst Kerbe, Bauteilgröße, Oberflächenrauheit und Oberflächenverfestigung zusammen. Um diesen Faktor ist die Wechselfestigkeit des Bauteils kleiner als die der polierten Probe.',
      quantities: [
        k2,
        ...kfQ,
        { symbol: 'KV', label: 'Einflussfaktor der Oberflächenverfestigung', value: KV, unit: '', ref: 'DIN 743-2, 8, Tabelle 4', note: KV === 1 ? 'keine Oberflächenverfestigung angesetzt' : undefined },
        {
          symbol: s.K,
          label: 'Gesamteinflussfaktor',
          value: K,
          unit: '',
          formula: `${s.K} = (β / K2(d) + 1 / ${s.KF} − 1) / KV`,
          substitution: `(${num(nr.beta)} / ${num(k2.value)} + 1 / ${num(KF)} − 1) / ${num(KV)}`,
          ref: `DIN 743-1, Gl. (${kind === 't' ? 9 : 8})`,
        },
      ],
      checks: [],
      notes: [],
    })
    kinds[kind] = {
      kind,
      notch: nr,
      K2: k2.value,
      KF,
      K,
      W: W0[kind],
      WK: 0,
      psi: 0,
      FK: 0,
      ADK: 0,
      ADKeq: '',
      ...stresses[kind],
    }
  }
  steps.push(...notchSteps, ...kSteps)

  // ------------------------------------------------------------------ 5 Spannungen
  steps.push({
    id: 'stresses',
    title: 'Wirkende Spannungen',
    explanation:
      'Die Norm rechnet mit Nennspannungen im Kerbquerschnitt, also ohne Spannungsspitze. Die Kerbwirkung steckt im Gesamteinflussfaktor. Jede Spannung wird in Mittelwert und Amplitude zerlegt; bei einer umlaufenden Welle mit feststehender Last ist die Biegung reine Wechselbeanspruchung (Mittelwert 0).',
    quantities: [
      section.A,
      section.Wb,
      section.Wt,
      ...active.flatMap((k) => stresses[k].quantities),
    ],
    checks: [],
    notes:
      input.loads.type === 'forces'
        ? ['Beim Nachweis gegen bleibende Verformung werden Zug/Druck- und Biegespannung betragsmäßig addiert (ungünstigste Randfaser).']
        : [],
  })

  // ------------------------------------------------------------------ 6 Bauteilfließgrenze
  const fkQ: Quantity[] = []
  for (const kind of active) {
    const r = kinds[kind]!
    const k2f = staticSupportFactor(kind, hollow, hard)
    const gF = yieldIncreaseFactor(r.notch, hard)
    const s = stressSymbols(kind)
    r.FK = (K1S * k2f.value * gF.value * mat.sigmaS) / (kind === 't' ? Math.sqrt(3) : 1)
    fkQ.push(k2f, gF, {
      symbol: s.FK,
      label: `Bauteilfließgrenze ${loadKindLabel[kind]}`,
      value: r.FK,
      unit: 'N/mm²',
      formula: kind === 't' ? 'τtFK = K1,S · K2F · γF · σS(dB) / √3' : `${s.FK} = K1,S · K2F · γF · σS(dB)`,
      substitution: `${num(K1S)} · ${num(k2f.value)} · ${num(gF.value)} · ${num(mat.sigmaS)}${kind === 't' ? ' / √3' : ''}`,
      ref: `DIN 743-1, Gl. (${kind === 't' ? 32 : 31})`,
    })
  }
  steps.push({
    id: 'yield',
    title: 'Bauteilfließgrenze',
    explanation:
      'Die Fließgrenze des Bauteils ist die Nennspannung, ab der sich größere Bereiche bleibend verformen. Sie wird für den Nachweis gegen bleibende Verformung gebraucht und begrenzt außerdem die ertragbare Dauerfestigkeit bei hohen Mittelspannungen. Bei Torsion gilt nach der Gestaltänderungsenergiehypothese τF = σF / √3.',
    quantities: fkQ,
    checks: [],
    notes: [],
  })

  // ------------------------------------------------------------------ 7 Bauteildauerfestigkeit
  const sN = (kinds.zd?.m ?? 0) + (kinds.b?.m ?? 0)
  const tm = kinds.t?.m ?? 0
  let sigmaMv: number
  const mvQ: Quantity[] = []
  if (sN >= 0) {
    sigmaMv = Math.sqrt(sN ** 2 + 3 * tm ** 2)
    mvQ.push({
      symbol: 'σmv',
      label: 'Vergleichsmittelspannung',
      value: sigmaMv,
      unit: 'N/mm²',
      formula: 'σmv = √((σzdm + σbm)² + 3 · τtm²)',
      substitution: `√(${num(sN)}² + 3 · ${num(tm)}²)`,
      ref: 'DIN 743-1, Gl. (23)',
      note: 'Die Mittelspannungen aller Beanspruchungsarten werden wie bei der Gestaltänderungsenergiehypothese zu einer Vergleichsspannung zusammengefasst.',
    })
  } else {
    const H = sN ** 3 / Math.abs(sN) + 3 * tm ** 2
    sigmaMv = Math.sign(H) * Math.sqrt(Math.abs(H))
    mvQ.push(
      { symbol: 'H', label: 'Hilfsgröße für negative Mittelspannung', value: H, unit: 'N²/mm⁴', formula: 'H = (σbm + σzdm)³ / |σbm + σzdm| + 3 · τtm²', substitution: `${num(sN)}³ / ${num(Math.abs(sN))} + 3 · ${num(tm)}²`, ref: 'DIN 743-1, 4.3' },
      { symbol: 'σmv', label: 'Vergleichsmittelspannung (Druckbereich)', value: sigmaMv, unit: 'N/mm²', formula: 'σmv = H / |H| · √|H|', ref: 'DIN 743-1, 4.3' },
    )
  }
  const tauMv = sigmaMv < 0 ? 0 : sigmaMv / Math.sqrt(3)
  mvQ.push({
    symbol: 'τmv',
    label: 'Vergleichsmittelspannung Torsion',
    value: tauMv,
    unit: 'N/mm²',
    formula: sigmaMv < 0 ? 'σmv < 0: τmv = 0' : 'τmv = σmv / √3',
    substitution: sigmaMv < 0 ? undefined : `${num(sigmaMv)} / √3`,
    ref: 'DIN 743-1, Gl. (24)',
  })

  const adkQ: Quantity[] = [...mvQ]
  const adkNotes: string[] = []
  const zdFK = K1S * 1 * (kinds.zd ? yieldIncreaseFactor(kinds.zd.notch, hard).value : 1) * mat.sigmaS
  for (const kind of active) {
    const r = kinds[kind]!
    const s = stressSymbols(kind)
    r.WK = (r.W * K1B) / r.K
    r.psi = r.WK / (2 * K1B * mat.sigmaB - r.WK)
    adkQ.push(
      {
        symbol: s.WK,
        label: `Bauteilwechselfestigkeit ${loadKindLabel[kind]}`,
        value: r.WK,
        unit: 'N/mm²',
        formula: `${s.WK} = ${s.W}(dB) · K1,B / ${s.K}`,
        substitution: `${num(r.W)} · ${num(K1B)} / ${num(r.K)}`,
        ref: `DIN 743-1, Gl. (${kind === 'zd' ? 5 : kind === 'b' ? 6 : 7})`,
        note: 'Die Wechselfestigkeit (Mittelspannung null), die das gekerbte Bauteil dauerhaft erträgt.',
      },
      {
        symbol: s.psi,
        label: 'Einflussfaktor der Mittelspannungsempfindlichkeit',
        value: r.psi,
        unit: '',
        formula: `${s.psi} = ${s.WK} / (2 · K1,B · σB(dB) − ${s.WK})`,
        substitution: `${num(r.WK)} / (2 · ${num(K1B)} · ${num(mat.sigmaB)} − ${num(r.WK)})`,
        ref: `DIN 743-1, Gl. (${kind === 'zd' ? 20 : kind === 'b' ? 21 : 22})`,
        note: 'Gibt an, wie stark eine Zug-Mittelspannung die ertragbare Amplitude verringert (Neigung der Dauerfestigkeitslinie im Haigh-Diagramm).',
      },
    )
    const mv = kind === 't' ? tauMv : sigmaMv
    const res = amplitudeStrength(kind, input.loadCase, r, mv, zdFK, sigmaBd)
    r.ADK = res.value
    r.ADKeq = res.ref
    adkQ.push({ ...res, symbol: s.ADK, label: `Ertragbare Amplitude ${loadKindLabel[kind]}`, unit: 'N/mm²' })
    if (res.condition) adkQ.push(res.condition)
    if (r.a === 0) adkNotes.push(`${loadKindLabel[kind]}: keine Amplitude vorhanden, geht nicht in die Sicherheit gegen Dauerbruch ein.`)
  }
  steps.push({
    id: 'adk',
    title: `Bauteildauerfestigkeit (Beanspruchungsfall ${input.loadCase})`,
    explanation:
      (input.loadCase === 1
        ? 'Fall 1: Bei einer Laststeigerung wächst nur die Amplitude, die Mittelspannung bleibt gleich (z. B. Vorspannung oder Eigengewicht als Mittellast). '
        : 'Fall 2: Bei einer Laststeigerung wachsen Mittelspannung und Amplitude im gleichen Verhältnis (z. B. Biegung und Torsion aus derselben Antriebskraft). ') +
      'Eine Zug-Mittelspannung verringert die ertragbare Amplitude; der Abfall wird durch ψ beschrieben und durch die Fließgrenze nach oben begrenzt.',
    quantities: adkQ,
    checks: [],
    notes: adkNotes,
  })

  // ------------------------------------------------------------------ 8 Sicherheit gegen Dauerbruch
  const ratio = (k: LoadKind) => (kinds[k] && kinds[k]!.a !== 0 ? kinds[k]!.a / kinds[k]!.ADK : 0)
  const rN = ratio('zd') + ratio('b')
  const rT = ratio('t')
  const SD = rN === 0 && rT === 0 ? Infinity : 1 / Math.sqrt(rN ** 2 + rT ** 2)
  const fatigue: Check = { label: 'Sicherheit gegen Dauerbruch', safety: SD, required: Smin, ok: SD >= Smin, ref: 'DIN 743-1, Gl. (1), (2)' }
  const termsN = (['zd', 'b'] as LoadKind[]).filter((k) => kinds[k] && kinds[k]!.a !== 0)
  steps.push({
    id: 'fatigue',
    title: 'Nachweis gegen Dauerbruch',
    explanation:
      'Die vorhandenen Amplituden werden mit den ertragbaren Amplituden verglichen. Normalspannungen (Zug/Druck und Biegung) werden addiert, Torsion wird quadratisch überlagert, wobei angenommen wird, dass alle Amplituden gleichphasig auftreten.',
    quantities: [
      {
        symbol: 'S',
        label: 'Sicherheit gegen Dauerbruch',
        value: SD,
        unit: '',
        formula: 'S = 1 / √((σzda / σzdADK + σba / σbADK)² + (τta / τtADK)²)',
        substitution:
          SD === Infinity
            ? undefined
            : `1 / √((${termsN.map((k) => `${num(kinds[k]!.a)} / ${num(kinds[k]!.ADK)}`).join(' + ') || '0'})² + (${rT ? `${num(kinds.t!.a)} / ${num(kinds.t!.ADK)}` : '0'})²)`,
        ref: 'DIN 743-1, Gl. (2) bis (4)',
      },
    ],
    checks: [fatigue],
    notes: [
      'Die Mindestsicherheit 1,2 deckt nur die Unsicherheiten des Rechenverfahrens ab. Unsichere Lastannahmen oder hohe Folgeschäden erfordern höhere, zu vereinbarende Werte (DIN 743-1, 4.1).',
    ],
  })

  // ------------------------------------------------------------------ 9 Sicherheit gegen bleibende Verformung
  const rmax = (k: LoadKind) => (kinds[k] ? Math.abs(kinds[k]!.max) / kinds[k]!.FK : 0)
  const sNmax = rmax('zd') + rmax('b')
  const sTmax = rmax('t')
  const SF = sNmax === 0 && sTmax === 0 ? Infinity : 1 / Math.sqrt(sNmax ** 2 + sTmax ** 2)
  const stat: Check = { label: 'Sicherheit gegen bleibende Verformung', safety: SF, required: Smin, ok: SF >= Smin, ref: 'DIN 743-1, 5.1, Gl. (25)' }
  const maxN = (['zd', 'b'] as LoadKind[]).filter((k) => kinds[k] && kinds[k]!.max !== 0)
  steps.push({
    id: 'static',
    title: 'Nachweis gegen bleibende Verformung',
    explanation:
      'Die größten im Betrieb auftretenden Nennspannungen (einschließlich Stößen und Anfahrspitzen) werden mit der Bauteilfließgrenze verglichen.',
    quantities: [
      {
        symbol: 'S',
        label: 'Sicherheit gegen bleibende Verformung',
        value: SF,
        unit: '',
        formula: 'S = 1 / √((σzdmax / σzdFK + σbmax / σbFK)² + (τtmax / τtFK)²)',
        substitution:
          SF === Infinity
            ? undefined
            : `1 / √((${maxN.map((k) => `${num(Math.abs(kinds[k]!.max))} / ${num(kinds[k]!.FK)}`).join(' + ') || '0'})² + (${sTmax ? `${num(Math.abs(kinds.t!.max))} / ${num(kinds.t!.FK)}` : '0'})²)`,
        ref: 'DIN 743-1, Gl. (25) bis (27)',
      },
    ],
    checks: [stat],
    notes: [
      ...(mat.sigmaB > 1300 || hard
        ? ['Bei harten Randschichten oder σB > 1300 N/mm² ist zusätzlich der Nachweis gegen Anriss nach DIN 743-1, 5.1.2 zu führen. Dieser ist noch nicht enthalten.']
        : []),
    ],
  })

  if (mat.sigmaB > 1300) warnings.push('σB > 1300 N/mm²: Duktilität und Anrissgefahr gesondert prüfen (DIN 743-1, 5.1).')
  if (d > 500 || deff > 500) warnings.push('Durchmesser über 500 mm liegen außerhalb des Gültigkeitsbereichs von K1(deff).')

  return { steps, kinds, K1B, K1S, sigmaMv, tauMv, fatigue, static: stat, warnings }
}

/** Werkstoffwechselfestigkeit als Größe */
function wq(symbol: string, label: string, value: number, override: number | undefined, factor: string, eq: string, sigmaB: number): Quantity {
  if (override !== undefined) return { symbol: `${symbol}(dB)`, label: `${label} (Eingabe)`, value, unit: 'N/mm²' }
  return {
    symbol: `${symbol}(dB)`,
    label,
    value,
    unit: 'N/mm²',
    formula: `${symbol} ≈ ${factor} · σB`,
    substitution: `${factor} · ${num(sigmaB)}`,
    ref: `DIN 743-3, Gl. ${eq}`,
  }
}

interface StressSet {
  m: number
  a: number
  max: number
  quantities: Quantity[]
}

function nominalStresses(loads: ForceLoads | StressLoads, section: ReturnType<typeof nominalSection>): Record<LoadKind, StressSet> {
  const out = {} as Record<LoadKind, StressSet>
  const defs: { kind: LoadKind; W: Quantity; factor: number; unitF: string }[] = [
    { kind: 'zd', W: section.A, factor: 1, unitF: 'N' },
    { kind: 'b', W: section.Wb, factor: NM, unitF: 'N·m' },
    { kind: 't', W: section.Wt, factor: NM, unitF: 'N·m' },
  ]
  for (const { kind, W, factor, unitF } of defs) {
    const s = stressSymbols(kind)
    const q: Quantity[] = []
    let m: number
    let a: number
    let max: number
    if (loads.type === 'forces') {
      const key = kind === 'zd' ? 'Fzd' : kind === 'b' ? 'Mb' : 'Mt'
      const Fm = (loads[`${key}m` as keyof ForceLoads] as number | undefined) ?? 0
      const Fa = Math.abs((loads[`${key}a` as keyof ForceLoads] as number | undefined) ?? 0)
      const FmaxIn = loads[`${key}max` as keyof ForceLoads] as number | undefined
      const Fmax = FmaxIn ?? (kind === 'zd' ? Fm + Math.sign(Fm || 1) * Fa : Math.abs(Fm) + Fa)
      m = (Fm * factor) / W.value
      a = (Fa * factor) / W.value
      max = (Fmax * factor) / W.value
      const conv = factor === NM ? ' · 1000' : ''
      if (Fm !== 0 || Fa !== 0 || Fmax !== 0) {
        q.push(
          { symbol: s.m, label: `Mittelspannung ${loadKindLabel[kind]}`, value: m, unit: 'N/mm²', formula: `${s.m} = ${key}m / ${W.symbol}`, substitution: `${num(Fm)} ${unitF}${conv} / ${num(W.value)} mm${W.unit.slice(-1)}`, ref: 'DIN 743-1, Tabelle 1' },
          { symbol: s.a, label: `Spannungsamplitude ${loadKindLabel[kind]}`, value: a, unit: 'N/mm²', formula: `${s.a} = ${key}a / ${W.symbol}`, substitution: `${num(Fa)} ${unitF}${conv} / ${num(W.value)} mm${W.unit.slice(-1)}`, ref: 'DIN 743-1, Tabelle 1' },
          {
            symbol: s.max, label: `Maximalspannung ${loadKindLabel[kind]}`, value: max, unit: 'N/mm²',
            formula: `${s.max} = ${key}max / ${W.symbol}`,
            substitution: `${num(Fmax)} ${unitF}${conv} / ${num(W.value)} mm${W.unit.slice(-1)}`,
            ref: 'DIN 743-1, Tabelle 4',
            note: FmaxIn === undefined ? `${key}max nicht angegeben, angenommen als Mittelwert + Amplitude.` : undefined,
          },
        )
      }
    } else {
      const pre = kind === 'zd' ? 'sigmaZd' : kind === 'b' ? 'sigmaB' : 'tauT'
      m = (loads[`${pre}m` as keyof StressLoads] as number | undefined) ?? 0
      a = Math.abs((loads[`${pre}a` as keyof StressLoads] as number | undefined) ?? 0)
      const maxIn = loads[`${pre}max` as keyof StressLoads] as number | undefined
      max = maxIn ?? (kind === 'zd' ? m + Math.sign(m || 1) * a : Math.abs(m) + a)
      if (m !== 0 || a !== 0 || max !== 0) {
        q.push(
          { symbol: s.m, label: `Mittelspannung ${loadKindLabel[kind]} (Eingabe)`, value: m, unit: 'N/mm²' },
          { symbol: s.a, label: `Spannungsamplitude ${loadKindLabel[kind]} (Eingabe)`, value: a, unit: 'N/mm²' },
          { symbol: s.max, label: `Maximalspannung ${loadKindLabel[kind]}`, value: max, unit: 'N/mm²', formula: maxIn === undefined ? `${s.max} = |${s.m}| + ${s.a}` : undefined },
        )
      }
    }
    out[kind] = { m, a, max, quantities: q }
  }
  return out
}

interface AmplitudeResult {
  value: number
  formula: string
  substitution: string
  ref: string
  note?: string
  condition?: Quantity
}

/**
 * Ertragbare Amplitude der Bauteildauerfestigkeit für die vorhandene Mittelspannung,
 * DIN 743-1, Gl. (10) bis (19) und Tabelle A.1.
 */
function amplitudeStrength(
  kind: LoadKind,
  loadCase: LoadCase,
  r: KindResult,
  mv: number,
  sigmaDFK: number,
  sigmaBd: number,
): AmplitudeResult {
  const s = stressSymbols(kind)
  const mvS = kind === 't' ? 'τmv' : 'σmv'
  const eqNo = (base: number) => base + (kind === 'zd' ? 0 : kind === 'b' ? 1 : 2)
  const eqF = (zdb: number, t: number) => (kind === 't' ? t : zdb)
  const { WK, psi, FK, a } = r

  if (loadCase === 1) {
    if (kind !== 't' && mv < 0) {
      const grenz = (WK - sigmaDFK) * (1 - WK / (2 * sigmaBd))
      if (mv < grenz) {
        return {
          value: mv + sigmaDFK,
          formula: `${s.ADK} = σmv + σdFK`,
          substitution: `${num(mv)} + ${num(sigmaDFK)}`,
          ref: 'DIN 743-1, Tabelle A.1 (Fall 1)',
          note: `Druckmittelspannung unter σmv,grenz = ${num(grenz)} N/mm²: Begrenzung durch die Druckfließgrenze σdFK.`,
        }
      }
    }
    const limit = (FK - WK) / (1 - psi)
    const condition: Quantity = {
      symbol: `${mvS},grenz`,
      label: 'Grenze für die Gültigkeit der Mittelspannungsgeraden',
      value: limit,
      unit: 'N/mm²',
      formula: `(${s.FK} − ${s.WK}) / (1 − ${s.psi})`,
      substitution: `(${num(FK)} − ${num(WK)}) / (1 − ${num(psi)})`,
      ref: 'DIN 743-1, 4.3 (Fall 1)',
      note: mv <= limit ? `${mvS} = ${num(mv)} ≤ ${num(limit)}: Gleichung (${eqNo(10)}) gilt.` : `${mvS} = ${num(mv)} > ${num(limit)}: Begrenzung durch die Fließgrenze.`,
    }
    if (mv <= limit) {
      return {
        value: WK - psi * mv,
        formula: `${s.ADK} = ${s.WK} − ${s.psi} · ${mvS}`,
        substitution: `${num(WK)} − ${num(psi)} · ${num(mv)}`,
        ref: `DIN 743-1, Gl. (${eqNo(10)})`,
        condition,
      }
    }
    return {
      value: FK - mv,
      formula: `${s.ADK} = ${s.FK} − ${mvS}`,
      substitution: `${num(FK)} − ${num(mv)}`,
      ref: `DIN 743-1, Gl. (${eqF(13, 14)})`,
      condition,
    }
  }

  // Fall 2
  if (a === 0) {
    // ohne Amplitude ist das Verhältnis σmv/σa unbestimmt; Wert nur zur Information nach Fall 1
    const v = Math.min(WK - psi * mv, FK - mv)
    return {
      value: v,
      formula: `${s.ADK} = ${s.WK} − ${s.psi} · ${mvS}`,
      substitution: `${num(WK)} − ${num(psi)} · ${num(mv)}`,
      ref: `DIN 743-1, Gl. (${eqNo(10)})`,
      note: 'Ohne Amplitude ist σmv/σa nicht definiert; der Wert ist nur informativ.',
    }
  }
  const q = mv / a
  if (kind !== 't' && q < 0) {
    const grenz = (WK - sigmaDFK) / (psi * sigmaDFK + WK)
    if (q < grenz) {
      return {
        value: (sigmaDFK * a) / (a - mv),
        formula: `${s.ADK} = σdFK · ${s.a} / (${s.a} − σmv)`,
        substitution: `${num(sigmaDFK)} · ${num(a)} / (${num(a)} − ${num(mv)})`,
        ref: 'DIN 743-1, Tabelle A.1 (Fall 2)',
        note: `σmv/σa unter (σmv/σa)grenz = ${num(grenz)}: Begrenzung durch die Druckfließgrenze σdFK.`,
      }
    }
  }
  const den = WK - FK * psi
  const limit = den > 0 ? (FK - WK) / den : Infinity
  const condition: Quantity = {
    symbol: `(${mvS} / ${s.a})grenz`,
    label: 'Grenze für die Gültigkeit der Mittelspannungsgeraden',
    value: limit,
    unit: '',
    formula: `(${s.FK} − ${s.WK}) / (${s.WK} − ${s.FK} · ${s.psi})`,
    substitution: `(${num(FK)} − ${num(WK)}) / (${num(WK)} − ${num(FK)} · ${num(psi)})`,
    ref: 'DIN 743-1, 4.3 (Fall 2)',
    note: q <= limit ? `${mvS} / ${s.a} = ${num(q)} ≤ ${num(limit)}: Gleichung (${eqNo(15)}) gilt.` : `${mvS} / ${s.a} = ${num(q)} > ${num(limit)}: Begrenzung durch die Fließgrenze.`,
  }
  if (q <= limit) {
    return {
      value: WK / (1 + psi * q),
      formula: `${s.ADK} = ${s.WK} / (1 + ${s.psi} · ${mvS} / ${s.a})`,
      substitution: `${num(WK)} / (1 + ${num(psi)} · ${num(mv)} / ${num(a)})`,
      ref: `DIN 743-1, Gl. (${eqNo(15)})`,
      condition,
    }
  }
  return {
    value: FK / (1 + q),
    formula: `${s.ADK} = ${s.FK} / (1 + ${mvS} / ${s.a})`,
    substitution: `${num(FK)} / (1 + ${num(mv)} / ${num(a)})`,
    ref: `DIN 743-1, Gl. (${eqF(18, 19)})`,
    condition,
  }
}
