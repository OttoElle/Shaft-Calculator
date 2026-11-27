/**
 * Größeneinflussfaktoren nach DIN 743-2:2012-12, Abschnitt 6.
 */

import type { MaterialGroup } from './data/materials'
import { lg, num } from './format'
import type { LoadKind, Quantity } from './types'

/** Für welchen Kennwert K1 bestimmt wird: Zugfestigkeit (B) oder Streckgrenze (S) */
export type StrengthKind = 'B' | 'S'

interface K1Law {
  eq: string
  /** untere Grenze von deff, bis zu der K1 = 1 gilt */
  dLow: number
  /** obere Grenze des Gleichungsbereichs */
  dHigh: number
  /** konstanter Wert oberhalb dHigh (bis 500 mm) */
  constHigh: number
  /** Steigung und Bezugsgröße: K1 = 1 − a · lg(deff / ref) */
  a: number
  ref: number
  refText: string
}

const eq10: K1Law = { eq: '(10)', dLow: 100, dHigh: 300, constHigh: 0.89, a: 0.23, ref: 100, refText: '100 mm' }
const eq11: K1Law = { eq: '(11)', dLow: 32, dHigh: 300, constHigh: 0.75, a: 0.26, ref: 32, refText: '(2 · dB)' }
const eq12: K1Law = { eq: '(12)', dLow: 16, dHigh: 300, constHigh: 0.67, a: 0.26, ref: 16, refText: 'dB' }
const eq13: K1Law = { eq: '(13)', dLow: 16, dHigh: 150, constHigh: 0.6, a: 0.41, ref: 16, refText: 'dB' }
const eq14: K1Law = { eq: '(14)', dLow: 16, dHigh: 300, constHigh: 0.57, a: 0.34, ref: 16, refText: 'dB' }

function k1Law(group: MaterialGroup, kind: StrengthKind): K1Law {
  switch (group) {
    case 'structural':
      return kind === 'B' ? eq10 : eq11
    case 'nitriding':
      return eq10
    case 'quenchedTempered':
      return kind === 'B' ? eq12 : eq14
    case 'caseHardeningCrNiMo':
      return eq12
    case 'caseHardening':
      return eq13
  }
}

/** Technologischer Größeneinflussfaktor K1(deff), DIN 743-2, Gl. (10) bis (14) */
export function technologicalSizeFactor(
  deff: number,
  group: MaterialGroup,
  kind: StrengthKind,
): Quantity {
  const law = k1Law(group, kind)
  const label = kind === 'B' ? 'für die Zugfestigkeit' : 'für die Streckgrenze'
  const symbol = kind === 'B' ? 'K1,B(deff)' : 'K1,S(deff)'
  const ref = `DIN 743-2, Gl. ${law.eq}`
  const base = { symbol, label: `Technologischer Größeneinflussfaktor ${label}`, unit: '', ref }
  if (deff <= law.dLow) {
    return {
      ...base,
      value: 1,
      formula: `deff ≤ ${law.dLow} mm: K1 = 1`,
      note: 'Bis zu diesem Durchmesser wird die Festigkeit des Bezugsdurchmessers voll erreicht.',
    }
  }
  if (deff >= law.dHigh) {
    return {
      ...base,
      value: law.constHigh,
      formula: `deff ≥ ${law.dHigh} mm: K1 = ${num(law.constHigh)}`,
      note:
        deff > 500
          ? 'deff > 500 mm liegt außerhalb des Gültigkeitsbereichs; die Extrapolation ist mit dem Stahlhersteller abzustimmen.'
          : undefined,
    }
  }
  const value = 1 - law.a * lg(deff / law.ref)
  return {
    ...base,
    value,
    formula: `K1 = 1 − ${num(law.a)} · lg(deff / ${law.refText})`,
    substitution: `1 − ${num(law.a)} · lg(${num(deff)} mm / ${num(law.ref)} mm)`,
    note:
      'Große Querschnitte werden beim Vergüten bzw. Härten im Kern nicht so fest wie die kleine Probe, für die die Normwerte gelten.',
  }
}

/** Geometrischer Größeneinflussfaktor K2(d), DIN 743-2, Gl. (15) und (16) */
export function geometricSizeFactorK2(d: number, kind: LoadKind): Quantity {
  const base = {
    symbol: `K2(d)`,
    label: 'Geometrischer Größeneinflussfaktor',
    unit: '',
    note: 'Bei größeren Durchmessern ist das Spannungsgefälle flacher, die Biege- und Torsionswechselfestigkeit sinkt Richtung Zug/Druck-Wechselfestigkeit.',
  }
  if (kind === 'zd') {
    return { ...base, value: 1, formula: 'Zug/Druck: K2 = 1', ref: 'DIN 743-2, Gl. (15)', note: undefined }
  }
  if (d < 7.5) return { ...base, value: 1, formula: 'd < 7,5 mm: K2 = 1', ref: 'DIN 743-2, 6.1' }
  if (d >= 150) return { ...base, value: 0.8, formula: 'd ≥ 150 mm: K2 = 0,8', ref: 'DIN 743-2, Gl. (16)' }
  return {
    ...base,
    value: 1 - (0.2 * lg(d / 7.5)) / lg(20),
    formula: 'K2 = 1 − 0,2 · lg(d / 7,5 mm) / lg(20)',
    substitution: `1 − 0,2 · lg(${num(d)} mm / 7,5 mm) / lg(20)`,
    ref: 'DIN 743-2, Gl. (16)',
  }
}

/**
 * Geometrischer Größeneinflussfaktor K3(d), DIN 743-2, Gl. (17).
 * `alpha` ist die Formzahl oder ersatzweise die experimentelle Kerbwirkungszahl β(dBK).
 */
export function geometricSizeFactorK3(d: number, alpha: number, symbol = 'K3(d)'): Quantity {
  const base = {
    symbol,
    label: 'Geometrischer Größeneinflussfaktor der Kerbwirkung',
    unit: '',
    ref: 'DIN 743-2, Gl. (17)',
  }
  if (d < 7.5) return { ...base, value: 1, formula: 'd < 7,5 mm: K3 = 1' }
  if (d >= 150) {
    return {
      ...base,
      value: 1 - 0.2 * lg(alpha),
      formula: 'd ≥ 150 mm: K3 = 1 − 0,2 · lg(α)',
      substitution: `1 − 0,2 · lg(${num(alpha)})`,
    }
  }
  return {
    ...base,
    value: 1 - (0.2 * lg(alpha) * lg(d / 7.5)) / lg(20),
    formula: 'K3 = 1 − 0,2 · lg(α) · lg(d / 7,5 mm) / lg(20)',
    substitution: `1 − 0,2 · lg(${num(alpha)}) · lg(${num(d)} mm / 7,5 mm) / lg(20)`,
  }
}
