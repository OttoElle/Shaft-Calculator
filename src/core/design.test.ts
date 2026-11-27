import { describe, expect, it } from 'vitest'
import { calculate, type ShaftInput } from './calculate'
import { material } from './data/materials'
import { estimateDiameter, minimumDiameter, scaledInput } from './design'

const near = (actual: number, expected: number, tol = 0.01) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(tol)

describe('Überschlägiger Mindestdurchmesser', () => {
  it('Vergleichsmoment und Durchmesser (Handrechnung)', () => {
    // Mv = √(1200² + 0,75 · (0,7 · 3000)²) = 2178,9 N·m
    // σzul = 550 / (2 · 1,2) = 229,2 N/mm², d = ∛(32 · 2 178 900 / (π · 229,2)) = 45,9 mm
    const { d, step } = estimateDiameter({ material: material('42CrMo4'), Mb: 1200, T: 3000 })
    near(step.quantities.find((q) => q.symbol === 'Mv')!.value, 2178.9, 0.001)
    near(d, 45.9, 0.003)
  })
  it('Hohlwelle wird dicker', () => {
    const voll = estimateDiameter({ material: material('C45'), Mb: 500, T: 800 }).d
    const hohl = estimateDiameter({ material: material('C45'), Mb: 500, T: 800, k: 0.6 }).d
    near(hohl / voll, (1 / (1 - 0.6 ** 4)) ** (1 / 3), 1e-9)
  })
})

describe('Mindestdurchmesser nach DIN 743 (Rückwärtsrechnung)', () => {
  const keyway: ShaftInput = {
    material: material('42CrMo4'),
    d: 50,
    notch: { type: 'keyway', count: 1 },
    Rz: 12.5,
    loads: { type: 'forces', Mba: 1200, Mtm: 3000, Mbmax: 1800, Mtmax: 4500 },
    loadCase: 1,
  }

  it('Beiblatt 1, 5.3: mit Smin = 1,27 ergibt sich wieder etwa d = 50 mm', () => {
    const res = minimumDiameter({ ...keyway, Smin: 1.27 })
    near(res.d, 50, 0.005)
  })

  it('bei dmin ist die maßgebende Sicherheit genau Smin, der gerundete Wert erfüllt den Nachweis', () => {
    const res = minimumDiameter(keyway)
    const at = calculate(scaledInput(keyway, res.d))
    near(Math.min(at.fatigue.safety, at.static.safety), 1.2, 1e-3)
    expect(res.dRounded).toBe(Math.ceil(res.d))
    expect(res.result.fatigue.ok && res.result.static.ok).toBe(true)
    expect(res.d).toBeLessThan(50)
  })

  it('Kerbgeometrie wird maßstäblich mitskaliert (Beiblatt 1, 5.2 mit Biegemomenten)', () => {
    const shoulder: ShaftInput = {
      material: material('34CrMo4'),
      d: 42,
      notch: { type: 'shoulder', D: 50, r: 5 },
      Rz: 5,
      loads: { type: 'forces', Mbm: 3636, Mba: 364, Mtm: 1455, Mta: 436 },
      loadCase: 1,
    }
    const res = minimumDiameter(shoulder)
    const n = scaledInput(shoulder, res.dRounded).notch
    if (n.type !== 'shoulder') throw new Error()
    near(n.D / res.dRounded, 50 / 42, 1e-9)
    near(n.r / res.dRounded, 5 / 42, 1e-9)
  })

  it('Spannungseingabe wird abgelehnt', () => {
    expect(() =>
      minimumDiameter({ ...keyway, loads: { type: 'stresses', sigmaBa: 100 } }),
    ).toThrow()
  })
})
