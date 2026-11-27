import { describe, expect, it } from 'vitest'
import { calculate, type ShaftResult } from './calculate'
import { material } from './data/materials'
import { technologicalSizeFactor } from './sizeFactors'

/** relative Abweichung prüfen */
const near = (actual: number, expected: number, tol = 0.01) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(tol)

/** Größe aus einem Rechenschritt holen */
const q = (res: ShaftResult, stepId: string, symbol: string) => {
  const step = res.steps.find((s) => s.id === stepId)
  const found = step?.quantities.find((x) => x.symbol === symbol)
  if (!found) throw new Error(`${symbol} nicht in Schritt ${stepId}`)
  return found.value
}

describe('DIN 743 Beiblatt 1, 5.2: abgesetzte Welle, Biegung und Torsion, Fall 1', () => {
  const res = calculate({
    material: material('34CrMo4'),
    d: 42,
    notch: { type: 'shoulder', D: 50, r: 5 },
    Rz: 5,
    loads: { type: 'stresses', sigmaBm: 500, sigmaBa: 50, tauTm: 100, tauTa: 30 },
    loadCase: 1,
  })
  const b = res.kinds.b!
  const t = res.kinds.t!

  it('Größeneinfluss K1', () => {
    near(res.K1B, 0.871, 0.001)
    near(res.K1S, 0.832, 0.001)
  })
  it('Kerbwirkung Biegung', () => {
    near(q(res, 'notch-b', 'ασ,b'), 1.557, 0.001)
    near(q(res, 'notch-b', "G',b"), 0.542, 0.002)
    near(q(res, 'notch-b', 'n,b'), 1.04, 0.002)
    near(b.notch.beta, 1.497, 0.002)
  })
  it('Gesamteinflussfaktor Biegung', () => {
    near(b.K2, 0.885, 0.001)
    near(b.KF, 0.902, 0.002)
    near(b.K, 1.8, 0.002)
  })
  it('Kerbwirkung und Gesamteinflussfaktor Torsion', () => {
    near(q(res, 'notch-t', 'ατ'), 1.283, 0.001)
    near(q(res, 'notch-t', "G',τ"), 0.23, 0.002)
    near(t.notch.beta, 1.25, 0.002)
    near(t.KF, 0.944, 0.002)
    near(t.K, 1.472, 0.002)
  })
  it('Bauteildauerfestigkeit', () => {
    near(res.sigmaMv, 529.1, 0.001)
    near(res.tauMv, 305.5, 0.001)
    near(b.WK, 241.9, 0.002)
    near(t.WK, 177.5, 0.002)
    near(b.psi, 0.1613, 0.003)
    near(t.psi, 0.1135, 0.003)
    near(b.ADK, 156.6, 0.003)
    near(t.ADK, 142.8, 0.003)
  })
  it('Sicherheit gegen Dauerbruch S = 2,62', () => near(res.fatigue.safety, 2.62, 0.005))
  it('Bauteilfließgrenzen und Sicherheit gegen bleibende Verformung S = 1,40', () => {
    near(b.FK, 838.7, 0.001)
    near(t.FK, 461.1, 0.001)
    near(res.static.safety, 1.4, 0.005)
  })
})

describe('DIN 743 Beiblatt 1, 5.3: Passfederverbindung, Umlaufbiegung und statische Torsion', () => {
  const res = calculate({
    material: material('42CrMo4'),
    d: 50,
    notch: { type: 'keyway', count: 1 },
    Rz: 12.5,
    loads: { type: 'forces', Mba: 1200, Mtm: 3000, Mbmax: 1800, Mtmax: 4500 },
    loadCase: 1,
  })
  const b = res.kinds.b!
  const t = res.kinds.t!

  it('Kerbwirkungszahl aus Tabelle 1 mit Umrechnung auf d', () => {
    near(q(res, 'notch-b', 'βσ(dBK)'), 2.95, 0.002)
    near(q(res, 'notch-b', 'K3(d)'), 0.94, 0.001)
    near(q(res, 'notch-b', 'K3(dBK)'), 0.947, 0.001)
    near(b.notch.beta, 2.972, 0.003)
  })
  it('Gesamteinflussfaktor', () => {
    near(b.K2, 0.873, 0.001)
    expect(b.KF).toBe(1)
    near(b.K, 3.404, 0.003)
  })
  it('Spannungen', () => {
    near(b.a, 97.8, 0.001)
    near(t.m, 122.2, 0.001)
    near(res.sigmaMv, 211.7, 0.001)
  })
  it('Sicherheit gegen Dauerbruch S = 1,27', () => {
    near(b.WK, 140.7, 0.003)
    near(b.psi, 0.0792, 0.003)
    near(b.ADK, 123.9, 0.003)
    near(res.fatigue.safety, 1.27, 0.005)
  })
  it('Sicherheit gegen bleibende Verformung S = 2,57', () => {
    near(b.FK, 898.6, 0.001)
    near(t.FK, 518.8, 0.001)
    near(res.static.safety, 2.57, 0.005)
  })
})

describe('DIN 743 Beiblatt 1, 5.4: Achse mit Sicherungsringnut, Biegung, Fall 2', () => {
  const res = calculate({
    material: material('E335'),
    d: 76.5,
    notch: { type: 'ringGroove', D: 80, m: 2.65, r: 0.25 },
    Rz: 25,
    loads: { type: 'forces', Mbm: 8000, Mba: 2500 },
    loadCase: 2,
  })
  const b = res.kinds.b!

  it('Größeneinfluss nach Gl. (10) und (11)', () => {
    expect(res.K1B).toBe(1)
    near(res.K1S, 0.897, 0.001)
  })
  it('Kerbwirkungszahl der Sicherungsringnut', () => {
    near(q(res, 'notch-b', 'ρ*'), 0.107, 0.005)
    near(q(res, 'notch-b', 'rf'), 0.56, 0.005)
    near(q(res, 'notch-b', 'βσ(dBK)'), 2.744, 0.003)
    near(q(res, 'notch-b', 'K3(d)'), 0.932, 0.001)
    near(q(res, 'notch-b', 'K3(dBK)'), 0.959, 0.001)
    near(b.notch.beta, 2.823, 0.003)
  })
  it('Gesamteinflussfaktor mit Rauheitsverhältnis Gl. (20)', () => {
    near(b.K2, 0.845, 0.001)
    near(b.KF, 0.989, 0.003)
    near(b.K, 3.352, 0.005)
  })
  it('Sicherheit gegen Dauerbruch S = 1,19', () => {
    near(b.m, 182, 0.002)
    near(b.a, 56.9, 0.002)
    near(b.WK, 85, 0.005)
    near(b.psi, 0.0806, 0.005)
    near(b.ADK, 67.6, 0.005)
    near(res.fatigue.safety, 1.19, 0.006)
  })
  it('Sicherheit gegen bleibende Verformung S = 1,66', () => {
    near(b.max, 238.9, 0.002)
    near(b.FK, 396.7, 0.002)
    near(res.static.safety, 1.66, 0.005)
  })
})

describe('Technologischer Größeneinflussfaktor K1 (DIN 743-2, Bild 13)', () => {
  it('Grenzen der Gleichungen (10) bis (14) sind stetig', () => {
    near(technologicalSizeFactor(299.99, 'structural', 'B').value, 0.89, 0.002)
    near(technologicalSizeFactor(299.99, 'structural', 'S').value, 0.75, 0.005)
    near(technologicalSizeFactor(299.99, 'quenchedTempered', 'B').value, 0.67, 0.002)
    near(technologicalSizeFactor(299.99, 'quenchedTempered', 'S').value, 0.57, 0.005)
    near(technologicalSizeFactor(149.99, 'caseHardening', 'B').value, 0.6, 0.005)
  })
  it('bis zum Bezugsdurchmesser K1 = 1', () => {
    expect(technologicalSizeFactor(16, 'quenchedTempered', 'B').value).toBe(1)
    expect(technologicalSizeFactor(100, 'nitriding', 'S').value).toBe(1)
    expect(technologicalSizeFactor(32, 'structural', 'S').value).toBe(1)
  })
})

describe('Plausibilität weiterer Kerbformen', () => {
  const base = {
    material: material('C45'),
    d: 40,
    Rz: 6.3,
    loads: { type: 'forces' as const, Mba: 400, Mtm: 300 },
    loadCase: 2 as const,
  }
  it.each([
    ['groove', { type: 'groove', D: 46, r: 1.5 }],
    ['crossHole', { type: 'crossHole', r: 3 }],
    ['pressFit', { type: 'pressFit' }],
    ['spline', { type: 'spline', kind: 'involute' }],
    ['vNotch', { type: 'vNotch' }],
    ['none', { type: 'none' }],
  ] as const)('%s liefert endliche Sicherheiten und β ≥ 1', (_, notch) => {
    const res = calculate({ ...base, notch })
    expect(Number.isFinite(res.fatigue.safety)).toBe(true)
    expect(Number.isFinite(res.static.safety)).toBe(true)
    expect(res.kinds.b!.notch.beta).toBeGreaterThanOrEqual(1)
    expect(res.kinds.t!.notch.beta).toBeGreaterThanOrEqual(1)
  })
  it('Querbohrung: α für Biegung nach Bild 12', () => {
    const res = calculate({ ...base, notch: { type: 'crossHole', r: 6 } })
    // 2r/d = 0,3: α = 3 + 1,4 · 0,3 − 2,8 · √0,3 = 1,886
    near(q(res, 'notch-b', 'ασ,b'), 1.886, 0.001)
  })
  it('zwei Passfedern erhöhen β um den Faktor 1,15', () => {
    const one = calculate({ ...base, notch: { type: 'keyway', count: 1 } })
    const two = calculate({ ...base, notch: { type: 'keyway', count: 2 } })
    near(two.kinds.b!.notch.beta / one.kinds.b!.notch.beta, 1.15, 1e-9)
  })
  it('Druckmittelspannung erhöht die ertragbare Amplitude (Fall 1)', () => {
    const tension = calculate({ ...base, notch: { type: 'none' }, loads: { type: 'forces', Fzdm: 50000, Fzda: 20000 }, loadCase: 1 })
    const compression = calculate({ ...base, notch: { type: 'none' }, loads: { type: 'forces', Fzdm: -50000, Fzda: 20000 }, loadCase: 1 })
    expect(compression.kinds.zd!.ADK).toBeGreaterThan(tension.kinds.zd!.ADK)
    expect(compression.sigmaMv).toBeLessThan(0)
    expect(compression.tauMv).toBe(0)
  })
})
