import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  title: string
  hint?: ReactNode
  /** Inhalt; `large` ist true in der vergrößerten Ansicht */
  children: (large: boolean) => ReactNode
  footer?: ReactNode
}

/** Karte mit Button, der den Inhalt in einem großen Dialog zeigt */
export function Expandable({ title, hint, children, footer }: Props) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <section className="card expandable">
      <div className="card-head">
        <h2>{title}</h2>
        <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label={`${title} vergrößern`}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          <span>Vergrößern</span>
        </button>
      </div>
      {hint && <p className="hint">{hint}</p>}
      {children(false)}
      {footer}

      <dialog
        ref={dialog}
        className="zoom"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false)
        }}
      >
        {open && (
          <div className="zoom-body">
            <div className="card-head">
              <h2>{title}</h2>
              <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Schließen">
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                  <path d="M3 3l10 10M13 3L3 13" fill="none" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                <span>Schließen</span>
              </button>
            </div>
            {hint && <p className="hint">{hint}</p>}
            <div className="zoom-content">{children(true)}</div>
            {footer}
          </div>
        )}
      </dialog>
    </section>
  )
}
