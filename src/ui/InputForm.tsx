import { materialGroupLabel, materials, type MaterialGroup } from '../core/data/materials'
import { notchLabel } from '../core/notches'
import { NumberField, Rich, Segmented, SelectField } from './Fields'
import { CUSTOM, usesD, type FormState, type NotchType } from './state'

interface Props {
  state: FormState
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void
}

const groups: MaterialGroup[] = ['structural', 'quenchedTempered', 'caseHardening', 'caseHardeningCrNiMo', 'nitriding']

const notchHints: Partial<Record<NotchType, string>> = {
  shoulder: 'Formzahl aus der Geometrie, Kerbwirkungszahl über die Stützzahl (DIN 743-2, 4.3). Beim Freistich ist d der Durchmesser im Freistichgrund.',
  groove: 'Formzahl aus der Geometrie, Kerbwirkungszahl über die Stützzahl (DIN 743-2, 4.3).',
  crossHole: 'Nennspannung mit dem um die Bohrung geschwächten Querschnitt (DIN 743-2, Bild 12).',
  keyway: 'Versuchswerte nach DIN 743-2, Tabelle 1 für das Ende des Nabensitzes, umgerechnet auf d.',
  pressFit: 'Versuchswerte nach DIN 743-2, Tabelle 1 für das Ende des Nabensitzes, umgerechnet auf d.',
  spline: 'Versuchswerte nach DIN 743-2, Bild 1. d ist der Fußkreisdurchmesser.',
  vNotch: 'Versuchswerte nach DIN 743-2, Bild 2 (r = 0,1 mm, t/d = 0,05 bis 0,2).',
  ringGroove: 'Rechtecknut für Sicherungsringe nach DIN 471; d ist der Nutgrunddurchmesser (DIN 743-2, 4.2.4).',
  custom: 'Kerbwirkungszahlen für den Bauteildurchmesser, z. B. aus FEM oder Versuch.',
}

export function InputForm({ state: s, set }: Props) {
  const num = (key: keyof FormState) => (v: number | null) => set(key, (v ?? 0) as never)
  const opt = (key: keyof FormState) => (v: number | null) => set(key, v as never)

  return (
    <form className="inputs" onSubmit={(e) => e.preventDefault()}>
      <fieldset>
        <legend>Werkstoff</legend>
        <SelectField
          label="Werkstoff nach DIN 743-3"
          value={s.material}
          options={[
            ...groups.flatMap((g) =>
              materials.filter((m) => m.group === g).map((m) => ({ value: m.name, label: `${m.name} (${materialGroupLabel[g]})` })),
            ),
            { value: CUSTOM, label: 'eigener Werkstoff …' },
          ]}
          onChange={(v) => set('material', v)}
        />
        {s.material === CUSTOM && (
          <>
            <SelectField
              label="Werkstoffgruppe (bestimmt K_1)"
              value={s.customGroup}
              options={groups.map((g) => ({ value: g, label: materialGroupLabel[g] }))}
              onChange={(v) => set('customGroup', v)}
            />
            <div className="grid2">
              <NumberField symbol="σ_B(d_B)" label="Zugfestigkeit" unit="N/mm²" value={s.customSigmaB} onChange={num('customSigmaB')} />
              <NumberField symbol="σ_S(d_B)" label="Streckgrenze" unit="N/mm²" value={s.customSigmaS} onChange={num('customSigmaS')} />
            </div>
          </>
        )}
      </fieldset>

      <fieldset>
        <legend>Querschnitt und Kerbe</legend>
        <SelectField
          label="Kerbform"
          value={s.notch}
          options={(Object.keys(notchLabel) as NotchType[]).map((k) => ({ value: k, label: notchLabel[k] }))}
          onChange={(v) => set('notch', v)}
          hint={notchHints[s.notch]}
        />
        <div className="grid2">
          <NumberField symbol="d" label="Durchmesser im Kerbquerschnitt" unit="mm" value={s.d} onChange={num('d')} />
          <NumberField symbol="d_i" label="Innendurchmesser (Hohlwelle)" unit="mm" value={s.di} onChange={num('di')} />
        </div>
        {usesD(s.notch) && (
          <div className="grid2">
            <NumberField symbol="D" label={s.notch === 'ringGroove' ? 'Wellendurchmesser' : 'großer Durchmesser'} unit="mm" value={s.D} onChange={num('D')} />
            <NumberField symbol="r" label={s.notch === 'ringGroove' ? 'Radius im Nutgrund' : 'Kerbradius'} unit="mm" value={s.r} onChange={num('r')} />
          </div>
        )}
        {(s.notch === 'shoulder' || s.notch === 'groove') && (
          <NumberField
            symbol="t"
            label="Kerbtiefe (leer = (D − d) / 2)"
            unit="mm"
            value={s.t}
            onChange={opt('t')}
            optional
            placeholder={String((s.D - s.d) / 2).replace('.', ',')}
          />
        )}
        {s.notch === 'ringGroove' && <NumberField symbol="m" label="Nutbreite" unit="mm" value={s.m} onChange={num('m')} />}
        {s.notch === 'crossHole' && <NumberField symbol="d_L" label="Bohrungsdurchmesser" unit="mm" value={s.holeD} onChange={num('holeD')} />}
        {s.notch === 'keyway' && (
          <Segmented
            label="Anzahl Passfedern"
            value={String(s.keyCount) as '1' | '2'}
            options={[
              { value: '1', label: 'eine' },
              { value: '2', label: 'zwei' },
            ]}
            onChange={(v) => set('keyCount', Number(v) as 1 | 2)}
          />
        )}
        {s.notch === 'spline' && (
          <SelectField
            label="Profil"
            value={s.spline}
            options={[
              { value: 'straight', label: 'Keilwelle' },
              { value: 'serration', label: 'Kerbzahnwelle' },
              { value: 'involute', label: 'Zahnwelle mit Evolventenverzahnung' },
            ]}
            onChange={(v) => set('spline', v)}
          />
        )}
        {s.notch === 'custom' && (
          <>
            <div className="grid3">
              <NumberField symbol="β_σ,zd" label="Zug/Druck" value={s.betaZd} onChange={num('betaZd')} />
              <NumberField symbol="β_σ,b" label="Biegung" value={s.betaB} onChange={num('betaB')} />
              <NumberField symbol="β_τ" label="Torsion" value={s.betaT} onChange={num('betaT')} />
            </div>
            <Segmented
              label="Umdrehungskerbe (für γ_F)"
              value={s.revolution ? 'yes' : 'no'}
              options={[
                { value: 'yes', label: 'ja' },
                { value: 'no', label: 'nein' },
              ]}
              onChange={(v) => set('revolution', v === 'yes')}
            />
          </>
        )}
      </fieldset>

      <fieldset>
        <legend>Oberfläche</legend>
        <div className="grid2">
          <NumberField symbol="R_z" label="Rautiefe im Kerbgrund" unit="µm" value={s.Rz} onChange={num('Rz')} hint="geschliffen etwa 1 bis 4, gedreht 6,3 bis 25, Walzhaut 200" />
          <NumberField symbol="K_V" label="Oberflächenverfestigung" value={s.KV} onChange={num('KV')} hint="1 ohne Verfestigung; Richtwerte DIN 743-2, Tabelle 4" />
        </div>
        <Segmented
          label="Harte Randschicht (einsatzgehärtet, nitriert, randschichtgehärtet)"
          value={s.hardSurface ? 'yes' : 'no'}
          options={[
            { value: 'no', label: 'nein' },
            { value: 'yes', label: 'ja' },
          ]}
          onChange={(v) => set('hardSurface', v === 'yes')}
        />
      </fieldset>

      <fieldset>
        <legend>Belastung im Kerbquerschnitt</legend>
        <p className="hint">
          <Rich text="Mittelwert und Amplitude der Schnittgrößen. Bei einer umlaufenden Welle mit feststehender Last ist das Biegemoment reine Amplitude (M_bm = 0)." />
        </p>
        <div className="grid3 load-grid">
          <span />
          <span className="col-head">Mittelwert</span>
          <span className="col-head">Amplitude</span>
          <span className="row-head">Zugkraft in kN</span>
          <NumberField symbol="F_zdm" label="" value={s.Fzdm} onChange={num('Fzdm')} />
          <NumberField symbol="F_zda" label="" value={s.Fzda} onChange={num('Fzda')} />
          <span className="row-head">Biegemoment in N·m</span>
          <NumberField symbol="M_bm" label="" value={s.Mbm} onChange={num('Mbm')} />
          <NumberField symbol="M_ba" label="" value={s.Mba} onChange={num('Mba')} />
          <span className="row-head">Torsionsmoment in N·m</span>
          <NumberField symbol="M_tm" label="" value={s.Mtm} onChange={num('Mtm')} />
          <NumberField symbol="M_ta" label="" value={s.Mta} onChange={num('Mta')} />
        </div>
        <details className="advanced">
          <summary>Maximalwerte (Stöße, Anfahren)</summary>
          <p className="hint">Für den Nachweis gegen bleibende Verformung. Leer bedeutet Mittelwert + Amplitude.</p>
          <div className="grid3">
            <NumberField symbol="F_zd,max" label="kN" value={s.Fzdmax} onChange={opt('Fzdmax')} optional />
            <NumberField symbol="M_b,max" label="N·m" value={s.Mbmax} onChange={opt('Mbmax')} optional />
            <NumberField symbol="M_t,max" label="N·m" value={s.Mtmax} onChange={opt('Mtmax')} optional />
          </div>
        </details>
        <Segmented
          label="Beanspruchungsfall (DIN 743-1, 4.3)"
          value={String(s.loadCase) as '1' | '2'}
          options={[
            { value: '1', label: 'Fall 1: Mittelspannung konstant' },
            { value: '2', label: 'Fall 2: Verhältnis konstant' },
          ]}
          onChange={(v) => set('loadCase', Number(v) as 1 | 2)}
        />
        <p className="hint">
          {s.loadCase === 1
            ? 'Fall 1: Bei Überlast wächst nur die Amplitude, z. B. bei konstanter Vorspannung oder Gewichtskraft als Mittellast.'
            : 'Fall 2: Mittelwert und Amplitude wachsen gemeinsam, z. B. wenn Biegung und Torsion aus derselben Antriebskraft stammen. Im Zweifel bei Zug-Mittelspannung Fall 2 wählen.'}
        </p>
      </fieldset>

      <fieldset>
        <legend>Sicherheit und Sonstiges</legend>
        <div className="grid2">
          <NumberField symbol="S_min" label="Mindestsicherheit" value={s.Smin} onChange={num('Smin')} hint="1,2 nach DIN 743-1; höher bei unsicheren Lasten" />
          <NumberField
            symbol="d_eff"
            label="Durchmesser bei Wärmebehandlung"
            unit="mm"
            value={s.deff}
            onChange={opt('deff')}
            optional
            placeholder="= D"
            hint="leer = größter Durchmesser"
          />
        </div>
      </fieldset>
    </form>
  )
}
