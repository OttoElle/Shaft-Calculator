import type { LoadCase, ShaftInput } from '../core/calculate'
import { material as materialByName, type Material, type MaterialGroup } from '../core/data/materials'
import type { NotchInput, SplineKind } from '../core/notches'

export type NotchType = NotchInput['type']

/** Zustand der Eingabemaske. Längen in mm, Kräfte in kN, Momente in N·m. */
export interface FormState {
  material: string
  /** eigener Werkstoff */
  customGroup: MaterialGroup
  customSigmaB: number
  customSigmaS: number

  d: number
  di: number
  /** leer = größter Durchmesser */
  deff: number | null

  notch: NotchType
  D: number
  r: number
  /** leer = (D − d) / 2 */
  t: number | null
  m: number
  holeD: number
  keyCount: 1 | 2
  spline: SplineKind
  betaZd: number
  betaB: number
  betaT: number
  revolution: boolean

  Rz: number
  KV: number
  hardSurface: boolean

  Fzdm: number
  Fzda: number
  Mbm: number
  Mba: number
  Mtm: number
  Mta: number
  Fzdmax: number | null
  Mbmax: number | null
  Mtmax: number | null
  loadCase: LoadCase
  Smin: number

  /** Entwurf */
  Kest: number
  alpha0: number
}

export const CUSTOM = '__custom__'

export const DEFAULT_STATE: FormState = {
  material: 'C45',
  customGroup: 'quenchedTempered',
  customSigmaB: 700,
  customSigmaS: 490,
  d: 40,
  di: 0,
  deff: null,
  notch: 'shoulder',
  D: 48,
  r: 2,
  t: null,
  m: 2.15,
  holeD: 6,
  keyCount: 1,
  spline: 'involute',
  betaZd: 2,
  betaB: 2,
  betaT: 1.6,
  revolution: true,
  Rz: 6.3,
  KV: 1,
  hardSurface: false,
  Fzdm: 0,
  Fzda: 0,
  Mbm: 0,
  Mba: 400,
  Mtm: 500,
  Mta: 0,
  Fzdmax: null,
  Mbmax: null,
  Mtmax: null,
  loadCase: 2,
  Smin: 1.2,
  Kest: 2,
  alpha0: 0.7,
}

export interface Example {
  id: string
  label: string
  state: FormState
}

/** Beispiele aus DIN 743 Beiblatt 1 */
export const EXAMPLES: Example[] = [
  {
    id: '5.2',
    label: 'Bbl. 1, 5.2: abgesetzte Welle',
    // Spannungen aus dem Beiblatt in Momente umgerechnet: Wb = 7 274 mm³, Wt = 14 547 mm³
    state: {
      ...DEFAULT_STATE,
      material: '34CrMo4',
      d: 42,
      di: 0,
      notch: 'shoulder',
      D: 50,
      r: 5,
      t: null,
      Rz: 5,
      Mbm: 3636.8,
      Mba: 363.7,
      Mtm: 1454.7,
      Mta: 436.4,
      loadCase: 1,
      Kest: 1.8,
    },
  },
  {
    id: '5.3',
    label: 'Bbl. 1, 5.3: Passfederverbindung',
    state: {
      ...DEFAULT_STATE,
      material: '42CrMo4',
      d: 50,
      notch: 'keyway',
      keyCount: 1,
      Rz: 12.5,
      Mbm: 0,
      Mba: 1200,
      Mtm: 3000,
      Mta: 0,
      Mbmax: 1800,
      Mtmax: 4500,
      loadCase: 1,
      Kest: 3.4,
    },
  },
  {
    id: '5.4',
    label: 'Bbl. 1, 5.4: Sicherungsringnut',
    state: {
      ...DEFAULT_STATE,
      material: 'E335',
      d: 76.5,
      notch: 'ringGroove',
      D: 80,
      m: 2.65,
      r: 0.25,
      Rz: 25,
      Mbm: 8000,
      Mba: 2500,
      Mtm: 0,
      Mta: 0,
      loadCase: 2,
      Kest: 3.4,
    },
  },
]

export function selectedMaterial(s: FormState): Material {
  if (s.material === CUSTOM) {
    const dB = s.customGroup === 'structural' || s.customGroup === 'nitriding' ? 100 : 16
    return {
      name: 'eigener Werkstoff',
      group: s.customGroup,
      sigmaB: s.customSigmaB,
      sigmaS: s.customSigmaS,
      dB_B: dB,
      dB_S: s.customGroup === 'structural' ? 16 : dB,
      source: 'Eingabe',
    }
  }
  return materialByName(s.material)
}

export function notchInput(s: FormState): NotchInput {
  const t = s.t ?? undefined
  switch (s.notch) {
    case 'none':
      return { type: 'none' }
    case 'shoulder':
      return { type: 'shoulder', D: s.D, r: s.r, t }
    case 'groove':
      return { type: 'groove', D: s.D, r: s.r, t }
    case 'crossHole':
      return { type: 'crossHole', r: s.holeD / 2 }
    case 'keyway':
      return { type: 'keyway', count: s.keyCount }
    case 'pressFit':
      return { type: 'pressFit' }
    case 'spline':
      return { type: 'spline', kind: s.spline }
    case 'vNotch':
      return { type: 'vNotch' }
    case 'ringGroove':
      return { type: 'ringGroove', D: s.D, m: s.m, r: s.r }
    case 'custom':
      return { type: 'custom', betaZd: s.betaZd, betaB: s.betaB, betaT: s.betaT, revolution: s.revolution }
  }
}

export function toInput(s: FormState): ShaftInput {
  return {
    material: selectedMaterial(s),
    d: s.d,
    di: s.di > 0 ? s.di : undefined,
    deff: s.deff ?? undefined,
    notch: notchInput(s),
    Rz: s.Rz,
    KV: s.KV,
    hardSurface: s.hardSurface,
    loads: {
      type: 'forces',
      Fzdm: s.Fzdm * 1000,
      Fzda: s.Fzda * 1000,
      Mbm: s.Mbm,
      Mba: s.Mba,
      Mtm: s.Mtm,
      Mta: s.Mta,
      Fzdmax: s.Fzdmax === null ? undefined : s.Fzdmax * 1000,
      Mbmax: s.Mbmax ?? undefined,
      Mtmax: s.Mtmax ?? undefined,
    },
    loadCase: s.loadCase,
    Smin: s.Smin,
  }
}

export const usesD = (n: NotchType) => n === 'shoulder' || n === 'groove' || n === 'ringGroove'
export const usesR = (n: NotchType) => n === 'shoulder' || n === 'groove' || n === 'ringGroove'

/** Plausibilitätsprüfung, liefert Fehlermeldungen */
export function validate(s: FormState): string[] {
  const e: string[] = []
  const pos = (v: number, name: string) => {
    if (!(v > 0)) e.push(`${name} muss größer als 0 sein.`)
  }
  pos(s.d, 'Der Durchmesser d')
  if (s.di < 0) e.push('Der Innendurchmesser darf nicht negativ sein.')
  if (s.di >= s.d) e.push('Der Innendurchmesser muss kleiner als d sein.')
  if (s.material === CUSTOM) {
    pos(s.customSigmaB, 'Die Zugfestigkeit')
    pos(s.customSigmaS, 'Die Streckgrenze')
    if (s.customSigmaS > s.customSigmaB) e.push('Die Streckgrenze darf nicht größer als die Zugfestigkeit sein.')
  }
  if (usesD(s.notch) && !(s.D > s.d)) e.push('D muss größer als d sein.')
  if (usesR(s.notch)) pos(s.r, 'Der Radius r')
  if (s.notch === 'ringGroove') pos(s.m, 'Die Nutbreite m')
  if (s.notch === 'crossHole') {
    pos(s.holeD, 'Der Bohrungsdurchmesser')
    if (s.holeD >= s.d) e.push('Die Querbohrung muss kleiner als d sein.')
  }
  if (s.notch === 'custom' && [s.betaZd, s.betaB, s.betaT].some((b) => !(b >= 1)))
    e.push('Kerbwirkungszahlen müssen mindestens 1 sein.')
  if (s.t !== null && usesD(s.notch) && !(s.t > 0)) e.push('Die Kerbtiefe t muss größer als 0 sein.')
  pos(s.Rz, 'Die Rautiefe Rz')
  pos(s.KV, 'K_V')
  pos(s.Smin, 'Die Mindestsicherheit')
  if (s.deff !== null && !(s.deff > 0)) e.push('d_eff muss größer als 0 sein.')
  if ([s.Fzdm, s.Fzda, s.Mbm, s.Mba, s.Mtm, s.Mta, s.Fzdmax ?? 0, s.Mbmax ?? 0, s.Mtmax ?? 0].every((v) => v === 0))
    e.push('Bitte mindestens eine Belastung eingeben.')
  return e
}
