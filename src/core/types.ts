/**
 * Gemeinsame Typen für den nachvollziehbaren Rechengang.
 *
 * Jede berechnete Größe wird als `Quantity` zurückgegeben, zusammen mit der
 * Formel, den eingesetzten Zahlenwerten und der Fundstelle in der Norm. Die
 * Oberfläche kann daraus den Rechenweg Schritt für Schritt anzeigen.
 */

/** Beanspruchungsart: Zug/Druck, Biegung, Torsion */
export type LoadKind = 'zd' | 'b' | 't'

export const loadKindLabel: Record<LoadKind, string> = {
  zd: 'Zug/Druck',
  b: 'Biegung',
  t: 'Torsion',
}

export interface Quantity {
  symbol: string
  label: string
  value: number
  unit: string
  /** allgemeine Formel, z. B. "K1 = 1 − 0,26 · lg(deff / dB)" */
  formula?: string
  /** Formel mit eingesetzten Zahlen, z. B. "1 − 0,26 · lg(50 / 16)" */
  substitution?: string
  /** Fundstelle, z. B. "DIN 743-2, Gl. (12)" */
  ref?: string
  /** kurze Erläuterung, warum die Größe gebraucht wird oder was sie bedeutet */
  note?: string
}

export interface Check {
  label: string
  /** vorhandene Sicherheit */
  safety: number
  /** erforderliche Mindestsicherheit */
  required: number
  ok: boolean
  ref: string
}

export interface Step {
  id: string
  title: string
  /** Was in diesem Schritt passiert und warum, in ein bis drei Sätzen */
  explanation: string
  quantities: Quantity[]
  checks: Check[]
  notes: string[]
}
