/** Zahl mit Dezimalkomma und 4 signifikanten Stellen für eingesetzte Werte */
export function num(x: number, digits = 4): string {
  if (!Number.isFinite(x)) return x > 0 ? '∞' : '−∞'
  if (x === 0) return '0'
  const rounded = Number(x.toPrecision(digits))
  const s = Math.abs(rounded) >= 1e6 ? rounded.toExponential(2) : String(rounded)
  return s.replace('-', '−').replace('.', ',')
}

/** dekadischer Logarithmus */
export const lg = Math.log10
