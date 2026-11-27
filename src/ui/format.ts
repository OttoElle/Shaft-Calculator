const nf = (digits: number) =>
  new Intl.NumberFormat('de-DE', { maximumSignificantDigits: digits, minimumSignificantDigits: Math.min(digits, 3) })

/** Zahl mit sinnvoller Genauigkeit; sehr kleine Werte (Nachgiebigkeiten) als Zehnerpotenz */
export function fmt(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return '–'
  if (value !== 0 && Math.abs(value) < 1e-3) {
    const exp = Math.floor(Math.log10(Math.abs(value)))
    const mant = value / 10 ** exp
    return `${nf(digits).format(mant)}·10${superscript(exp)}`
  }
  return nf(Math.abs(value) >= 10000 ? 6 : digits).format(value)
}

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
const superscript = (n: number) =>
  String(n)
    .split('')
    .map((c) => SUP[c] ?? c)
    .join('')

/** Formelzeichen "F_M,zul" als Text mit Index darstellen */
export function splitSymbol(symbol: string): [string, string] {
  const i = symbol.indexOf('_')
  return i < 0 ? [symbol, ''] : [symbol.slice(0, i), symbol.slice(i + 1)]
}

export const kN = (n: number) => `${fmt(n / 1000, 4)} kN`
