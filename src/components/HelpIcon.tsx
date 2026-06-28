'use client'
// src/components/HelpIcon.tsx
//
// THE single in-app help system. A small "?" icon sits next to a button,
// input, or section. Tap/hover it to see a short explanation in the
// current language. Never auto-shows, never blocks the screen, never
// repeats itself uninvited — purely opt-in, every time, forever.
//
// Usage:
//   <div className="flex items-center gap-1.5">
//     <button onClick={addWorker}>+ Add Worker</button>
//     <HelpIcon textKey="workers.addWorker" />
//   </div>

import { useState, useRef, useEffect } from 'react'
import { useLang } from '@/components/AppShell'
import { HELP_TEXT, type HelpKey } from '@/lib/helpText'

export function HelpIcon({ textKey, size = 'sm' }: { textKey: HelpKey; size?: 'sm' | 'md' }) {
  const { lang } = useLang()
  const te = lang === 'te'
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const entry = HELP_TEXT[textKey]

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  if (!entry) {
    // Missing help text is a content bug, not a crash — fail quietly in
    // production, loudly in dev console, and never render a broken icon.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[HelpIcon] No help text registered for key: ${textKey}`)
    }
    return null
  }

  const dim = size === 'md' ? 'w-5 h-5 text-[11px]' : 'w-4 h-4 text-[10px]'

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        onMouseEnter={() => setOpen(true)}
        aria-label={te ? 'సహాయం' : 'Help'}
        className={`${dim} rounded-full flex items-center justify-center font-bold flex-shrink-0 transition-colors`}
        style={{
          background: open ? 'rgb(var(--accent))' : 'rgba(var(--accent),0.15)',
          color: open ? '#fff' : 'rgb(var(--accent))',
        }}>
        ?
      </button>

      {open && (
        <div
          role="tooltip"
          onMouseLeave={() => setOpen(false)}
          className="absolute z-[60] left-1/2 -translate-x-1/2 top-full mt-2 w-64 p-3 rounded-xl text-left shadow-lg"
          style={{
            background: 'rgb(var(--surface))',
            border: '1px solid rgb(var(--border))',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}>
          <p className="text-xs font-black mb-1" style={{ color: 'rgb(var(--accent))' }}>
            {te ? entry.title_te : entry.title_en}
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'rgb(var(--text))' }}>
            {te ? entry.body_te : entry.body_en}
          </p>
        </div>
      )}
    </div>
  )
}
