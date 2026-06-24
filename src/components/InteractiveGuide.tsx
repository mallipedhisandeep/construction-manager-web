'use client'
import { useState, useEffect, ReactNode } from 'react'
import { useLang } from '@/components/AppShell'

export interface GuideStep {
  id: string
  selector: string
  title_en: string
  title_te: string
  desc_en: string
  desc_te: string
  action_en?: string
  action_te?: string
}

interface InteractiveGuideProps {
  steps: GuideStep[]
  children: ReactNode
  onComplete?: () => void
}

export function InteractiveGuide({ steps, children, onComplete }: InteractiveGuideProps) {
  const { lang } = useLang()
  const te = lang === 'te'
  const [current, setCurrent] = useState(0)
  const [enabled, setEnabled] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, height: 0 })

  const step = steps[current]
  const isLast = current === steps.length - 1

  useEffect(() => {
    if (!enabled || !step) return

    const updatePos = () => {
      const el = document.querySelector(step.selector)
      if (el) {
        const rect = el.getBoundingClientRect()
        setPos({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        })
      }
    }

    updatePos()
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos)
    return () => {
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos)
    }
  }, [enabled, step])

  const handleNext = () => {
    if (isLast) {
      setEnabled(false)
      onComplete?.()
    } else {
      setCurrent(current + 1)
    }
  }

  if (!enabled || !step) {
    return (
      <>
        {children}
        <button
          onClick={() => { setCurrent(0); setEnabled(true) }}
          className="fixed bottom-6 right-6 px-4 py-2 rounded-lg font-bold text-sm z-40"
          style={{ background: 'rgb(var(--accent))', color: '#fff' }}>
          💡 Guide
        </button>
      </>
    )
  }

  const tooltipX = pos.left + pos.width / 2
  const tooltipY = pos.top - 20

  return (
    <>
      {children}

      {/* Overlay dimmer */}
      <div
        className="fixed inset-0 z-40 pointer-events-none"
        style={{
          background: 'rgba(0,0,0,0.6)',
          clipPath: `polygon(
            0 0, 0 100%, 100% 100%, 100% 0, 0 0,
            ${pos.left - 8}px ${pos.top - 8}px,
            ${pos.left - 8}px ${pos.top + pos.height + 8}px,
            ${pos.left + pos.width + 8}px ${pos.top + pos.height + 8}px,
            ${pos.left + pos.width + 8}px ${pos.top - 8}px,
            ${pos.left - 8}px ${pos.top - 8}px
          )`,
        }}
      />

      {/* Highlight box */}
      <div
        className="fixed z-40 border-2 pointer-events-none rounded-lg animate-pulse"
        style={{
          top: pos.top - 8,
          left: pos.left - 8,
          width: pos.width + 16,
          height: pos.height + 16,
          borderColor: 'rgb(var(--accent))',
        }}
      />

      {/* Tooltip */}
      <div
        className="fixed z-50 p-4 rounded-xl max-w-xs pointer-events-auto"
        style={{
          top: tooltipY,
          left: Math.max(12, Math.min(tooltipX - 160, window.innerWidth - 180)),
          transform: 'translateY(-100%)',
          background: 'rgb(var(--accent))',
          color: '#fff',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        }}>
        <div className="flex items-start justify-between mb-2">
          <p className="font-black text-sm">{te ? step.title_te : step.title_en}</p>
          <button
            onClick={() => setEnabled(false)}
            className="text-lg leading-none opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>

        <p className="text-xs mb-3 opacity-90">{te ? step.desc_te : step.desc_en}</p>

        {step.action_en && (
          <p className="text-xs font-bold mb-3" style={{ color: 'rgba(255,255,255,0.7)' }}>
            → {te ? step.action_te : step.action_en}
          </p>
        )}

        <div className="flex gap-2 items-center">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className="h-1 w-2 rounded-full"
                style={{
                  background: i <= current ? '#fff' : 'rgba(255,255,255,0.3)',
                }}
              />
            ))}
          </div>
          <button
            onClick={handleNext}
            className="ml-auto px-3 py-1 text-xs font-bold rounded-lg"
            style={{ background: 'rgba(255,255,255,0.25)' }}>
            {isLast ? (te ? 'ముగించండి' : 'Done') : (te ? 'తదుపరి' : 'Next')} →
          </button>
        </div>
      </div>
    </>
  )
}
