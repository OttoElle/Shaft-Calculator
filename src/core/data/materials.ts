/**
 * Werkstoff-Festigkeitswerte nach DIN 743-3:2024-07, Anhang A (Tabellen A.1 bis A.5).
 *
 * σB und σS sind Mindestwerte für den Bezugsdurchmesser dB. Die Umrechnung auf
 * den Bauteildurchmesser erfolgt mit dem technologischen Größeneinflussfaktor
 * K1(deff) nach DIN 743-2, dessen Gleichung von der Werkstoffgruppe abhängt.
 */

export type MaterialGroup =
  /** unlegierte Baustähle (A.1) und Feinkornbaustähle (A.2), nicht vergütet */
  | 'structural'
  /** Vergütungsstähle im vergüteten Zustand (A.4) */
  | 'quenchedTempered'
  /** Einsatzstähle außer Cr-Ni-Mo, blind- oder einsatzgehärtet (A.3) */
  | 'caseHardening'
  /** Cr-Ni-Mo-Einsatzstähle, blind- oder einsatzgehärtet (A.3) */
  | 'caseHardeningCrNiMo'
  /** Nitrierstähle (A.5) */
  | 'nitriding'

export const materialGroupLabel: Record<MaterialGroup, string> = {
  structural: 'Baustahl (nicht vergütet)',
  quenchedTempered: 'Vergütungsstahl (vergütet)',
  caseHardening: 'Einsatzstahl',
  caseHardeningCrNiMo: 'Cr-Ni-Mo-Einsatzstahl',
  nitriding: 'Nitrierstahl',
}

export interface Material {
  name: string
  group: MaterialGroup
  /** Zugfestigkeit σB(dB) in N/mm² */
  sigmaB: number
  /** Streckgrenze σS(dB) in N/mm² */
  sigmaS: number
  /** Bezugsdurchmesser für σB in mm */
  dB_B: number
  /** Bezugsdurchmesser für σS in mm */
  dB_S: number
  /** Herkunft der Werte */
  source: string
}

const structural = (name: string, sigmaB: number, sigmaS: number, table: string): Material => ({
  name, group: 'structural', sigmaB, sigmaS, dB_B: 100, dB_S: 16, source: `DIN 743-3, Tabelle ${table}`,
})
const qt = (name: string, sigmaB: number, sigmaS: number): Material => ({
  name, group: 'quenchedTempered', sigmaB, sigmaS, dB_B: 16, dB_S: 16, source: 'DIN 743-3, Tabelle A.4',
})
const caseH = (name: string, sigmaB: number, sigmaS: number, crNiMo = false): Material => ({
  name, group: crNiMo ? 'caseHardeningCrNiMo' : 'caseHardening', sigmaB, sigmaS, dB_B: 16, dB_S: 16,
  source: 'DIN 743-3, Tabelle A.3 (Kernfestigkeit)',
})
const nitr = (name: string, sigmaB: number, sigmaS: number): Material => ({
  name, group: 'nitriding', sigmaB, sigmaS, dB_B: 100, dB_S: 100, source: 'DIN 743-3, Tabelle A.5',
})

export const materials: Material[] = [
  // Tabelle A.1 unlegierte Baustähle nach DIN EN 10025-2
  structural('S185', 290, 185, 'A.1'),
  structural('S235', 360, 235, 'A.1'),
  structural('S275', 410, 275, 'A.1'),
  structural('S355', 470, 355, 'A.1'),
  structural('S460', 550, 460, 'A.1'),
  structural('S500', 580, 500, 'A.1'),
  structural('E295', 470, 295, 'A.1'),
  structural('E335', 570, 335, 'A.1'),
  structural('E360', 670, 360, 'A.1'),
  // Tabelle A.2 Feinkornbaustähle nach DIN EN 10025-3
  structural('S275N', 370, 275, 'A.2'),
  structural('S275NL', 370, 275, 'A.2'),
  structural('S355N', 470, 355, 'A.2'),
  structural('S355NL', 470, 355, 'A.2'),
  structural('S420N', 520, 420, 'A.2'),
  structural('S420NL', 520, 420, 'A.2'),
  structural('S460N', 540, 460, 'A.2'),
  structural('S460NL', 540, 460, 'A.2'),
  // Tabelle A.3 Einsatzstähle (Kernfestigkeit)
  caseH('C10E', 500, 310),
  caseH('17Cr3', 800, 545),
  caseH('18CrMoS4', 1100, 775),
  caseH('18CrNiMo7-6', 1200, 850, true),
  caseH('16MnCr5', 1000, 695),
  caseH('20MnCr5', 1200, 850),
  // Tabelle A.4 Vergütungsstähle
  qt('C25', 550, 370),
  qt('C30', 600, 400),
  qt('C35', 630, 430),
  qt('C40', 650, 460),
  qt('C45', 700, 490),
  qt('C50', 750, 520),
  qt('C55', 800, 550),
  qt('C60', 850, 580),
  qt('41Cr4', 1000, 800),
  qt('34CrMo4', 1000, 800),
  qt('42CrMo4', 1100, 900),
  qt('50CrMo4', 1100, 900),
  qt('36CrNiMo4', 1100, 900),
  qt('30CrNiMo8', 1030, 850),
  qt('34CrNiMo6', 1200, 1000),
  // Tabelle A.5 Nitrierstähle
  nitr('32CrAlMo7-10', 800, 600),
  nitr('34CrAlMo5-10', 800, 700),
  nitr('41CrAlMo7-10', 850, 650),
  nitr('34CrAlNi7-10', 900, 800),
  nitr('8CrMo16-5', 900, 720),
  nitr('24CrMo13-6', 900, 720),
  nitr('31CrMo12', 980, 785),
  nitr('20CrMoV5-7', 900, 800),
  nitr('31CrMoV9', 1000, 800),
  nitr('33CrMoV12-9', 1050, 850),
  nitr('40CrMoV13-9', 900, 720),
]

export function material(name: string): Material {
  const m = materials.find((x) => x.name === name)
  if (!m) throw new Error(`Unbekannter Werkstoff: ${name}`)
  return m
}
