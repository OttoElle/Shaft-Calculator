import type { ReactNode } from 'react'
import { notchLabel } from '../core/notches'
import { fmt } from './format'
import type { FormState } from './state'

/**
 * Schematische Skizze des Kerbquerschnitts (Längsschnitt, nicht maßstäblich bei sehr kleinen Radien).
 * Gezeichnet wird die obere Kontur; die untere ist gespiegelt.
 */
export function NotchSketch({ s, large = false }: { s: FormState; large?: boolean }) {
  const W = 420
  const H = 230
  const cy = H / 2
  const x0 = 30
  const x1 = W - 30
  const xm = W / 2
  const hasD = s.notch === 'shoulder' || s.notch === 'groove' || s.notch === 'ringGroove'
  const Dmax = Math.max(s.d, hasD ? s.D : s.d)
  const k = 150 / Dmax
  const yd = cy - (s.d / 2) * k
  const yD = cy - ((hasD ? s.D : s.d) / 2) * k
  const r = Math.max(s.r * k, 2.5)
  const depth = yd - yD

  let top = ''
  let under: ReactNode = null
  let extra: ReactNode = null
  switch (s.notch) {
    case 'shoulder': {
      const rr = Math.min(r, depth, xm - x0)
      top = `M${x0},${yD} L${xm},${yD} L${xm},${yd - rr} A${rr},${rr} 0 0 0 ${xm + rr},${yd} L${x1},${yd}`
      break
    }
    case 'groove': {
      const rr = Math.min(r, 60)
      const yTurn = Math.max(yD, yd - rr)
      top = `M${x0},${yD} L${xm - rr},${yD} L${xm - rr},${yTurn} A${rr},${rr} 0 0 0 ${xm + rr},${yTurn} L${xm + rr},${yD} L${x1},${yD}`
      break
    }
    case 'ringGroove': {
      const mm = Math.max(s.m * k, 6)
      top = `M${x0},${yD} L${xm - mm / 2},${yD} L${xm - mm / 2},${yd} L${xm + mm / 2},${yd} L${xm + mm / 2},${yD} L${x1},${yD}`
      break
    }
    case 'keyway': {
      const kw = Math.max(s.d * 0.06 * k, 4)
      top = `M${x0},${yd} L${x1},${yd}`
      under = (
        <>
          <rect className="hub" x={xm} y={yd - 28} width={x1 - xm} height={28} />
          <rect className="hub" x={xm} y={cy + (s.d / 2) * k} width={x1 - xm} height={28} />
        </>
      )
      extra = (
        <>
          <rect className="key" x={xm - 50} y={yd - kw * 0.5} width={x1 - xm + 30} height={kw * 1.5} />
          <text className="dim-text" x={x0 + 4} y={yd - 8}>
            Passfeder
          </text>
        </>
      )
      break
    }
    case 'pressFit':
      top = `M${x0},${yd} L${x1},${yd}`
      under = (
        <>
          <rect className="hub" x={xm} y={yd - 28} width={x1 - xm} height={28} />
          <rect className="hub" x={xm} y={cy + (s.d / 2) * k} width={x1 - xm} height={28} />
        </>
      )
      extra = (
        <text className="dim-text" x={x0 + 4} y={yd - 8}>
          Nabe; maßgebend ist die Nabenkante
        </text>
      )
      break
    case 'crossHole': {
      const rh = Math.max((s.holeD / 2) * k, 3)
      top = `M${x0},${yd} L${x1},${yd}`
      extra = (
        <>
          <circle className="hole" cx={xm} cy={cy} r={rh} />
          <text className="dim-text" x={xm + rh + 6} y={cy - rh - 4}>
            Querbohrung ⌀{fmt(s.holeD, 3)}
          </text>
        </>
      )
      break
    }
    case 'spline': {
      const pitch = 10
      let teeth = ''
      for (let x = xm; x + pitch <= x1; x += pitch) teeth += ` L${x + 2},${yd - 6} L${x + pitch - 2},${yd - 6} L${x + pitch},${yd}`
      top = `M${x0},${yd} L${xm},${yd}${teeth} L${x1},${yd}`
      break
    }
    case 'vNotch':
      top = `M${x0},${yD} L${xm - 8},${yD} L${xm},${yD + 14} L${xm + 8},${yD} L${x1},${yD}`
      break
    default:
      top = `M${x0},${yd} L${x1},${yd}`
  }

  const yBottomD = cy + ((hasD ? s.D : s.d) / 2) * k
  const yBottomd = cy + (s.d / 2) * k
  const leftY = s.notch === 'shoulder' || hasD || s.notch === 'vNotch' ? yD : yd
  const leftYb = 2 * cy - leftY
  const xDim = s.notch === 'shoulder' ? xm + 40 : s.notch === 'crossHole' ? xm + 60 : xm
  const di = s.di > 0 ? (s.di / 2) * k : 0

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`sketch${large ? ' large' : ''}`} role="img" aria-label={`Skizze ${notchLabel[s.notch]}`}>
      <defs>
        <marker id="dim-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="dim-head" />
        </marker>
      </defs>
      {under}
      <g>
        <path className="part" d={`${top} L${x1},${cy} L${x0},${cy} Z`} />
        <path className="part" d={`${top} L${x1},${cy} L${x0},${cy} Z`} transform={`translate(0 ${2 * cy}) scale(1 -1)`} />
        <path className="part" d={`M${x0},${leftY} L${x0},${leftYb}`} />
      </g>
      {extra}
      {di > 0 && (
        <>
          <line className="center dashed" x1={x0} x2={x1} y1={cy - di} y2={cy - di} />
          <line className="center dashed" x1={x0} x2={x1} y1={cy + di} y2={cy + di} />
        </>
      )}
      <line className="center" x1={x0 - 10} x2={x1 + 10} y1={cy} y2={cy} />

      {/* Bemaßung d am Kerbquerschnitt */}
      <line className="dimline" x1={xDim} x2={xDim} y1={yd} y2={yBottomd} markerStart="url(#dim-arrow)" markerEnd="url(#dim-arrow)" />
      <text className="dim-text" x={xDim + 6} y={cy + 16}>
        d = {fmt(s.d, 4)}
      </text>
      {hasD && (
        <>
          <line className="dimline" x1={x0 + 14} x2={x0 + 14} y1={yD} y2={yBottomD} markerStart="url(#dim-arrow)" markerEnd="url(#dim-arrow)" />
          <text className="dim-text" x={x0 + 20} y={cy - 6}>
            D = {fmt(s.D, 4)}
          </text>
        </>
      )}
      {hasD && (
        <text className="dim-text" x={xm + 12} y={yD - 8}>
          {s.notch === 'ringGroove' ? `m = ${fmt(s.m, 3)}, r = ${fmt(s.r, 3)}` : `r = ${fmt(s.r, 3)}`}
        </text>
      )}
      <text className="dim-text muted" x={x0} y={H - 6}>
        {notchLabel[s.notch]}
        {s.di > 0 ? `, Hohlwelle di = ${fmt(s.di, 3)}` : ''} (schematisch, Maße in mm)
      </text>
    </svg>
  )
}
