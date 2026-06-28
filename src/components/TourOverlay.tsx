'use client'
// src/components/TourOverlay.tsx
//
// Renders nothing until a tour is actively playing. When active, it:
//   1. Navigates the router to the current step's route (if not already there)
//   2. Polls the DOM for the step's selector to actually exist (real layout,
//      real data, may take a moment after navigation/data fetch)
//   3. Dims the rest of the screen, cuts a transparent "hole" over the
//      target element, and shows a caption near it
//   4. Auto-advances to the next step after the step's durationMs
//   5. On the last step, marks the tour complete in Supabase and unmounts
//
// The person can tap "Skip tour" at any point — this also marks it
// complete so it never auto-plays again.

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useLang } from '@/components/AppShell'
import { supabase } from '@/lib/supabase'
import { TOUR_STEPS } from '@/lib/tourSteps'
import { seedTourDemoData, cleanupTourDemoData, type DemoRowRefs } from '@/lib/tourDemoData'

interface Rect { top: number; left: number; width: number; height: number }

const POLL_INTERVAL_MS = 100
const POLL_TIMEOUT_MS = 4000 // give up waiting for an element after this long and skip to the next step

export function TourOverlay({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const { lang } = useLang()
  const te = lang === 'te'

  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [navigating, setNavigating] = useState(true)
  const [seeding, setSeeding] = useState(true)
  const demoRefs = useRef<DemoRowRefs>({})
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const step = TOUR_STEPS[stepIndex]
  const isLast = stepIndex === TOUR_STEPS.length - 1

  // Seed exactly one demo row per module before the tour starts, so steps
  // that spotlight Edit/Delete/Pay (which only render for an existing
  // item) have something real to act on even on a brand-new account.
  // Runs once, before any navigation/polling begins.
  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(async ({ data }) => {
      const userId = data.user?.id
      if (!userId) { if (mounted) setSeeding(false); return }
      const refs = await seedTourDemoData(userId)
      if (mounted) { demoRefs.current = refs; setSeeding(false) }
    })
    return () => { mounted = false }
  }, [])

  const finish = useCallback(async () => {
    const { data } = await supabase.auth.getUser()
    const userId = data.user?.id
    // Clean up demo rows FIRST — if marking has_seen succeeds but cleanup
    // fails silently, the user is left with permanent stray "Demo ..."
    // rows and no way for the tour to retry (it never plays again). Doing
    // cleanup before the has_seen write means a failure here is at least
    // visible in the console immediately rather than swallowed forever.
    await cleanupTourDemoData(demoRefs.current)
    if (userId) {
      await supabase.from('user_tour_status').upsert({ user_id: userId, has_seen: true, seen_at: new Date().toISOString() })
    }
    onDone()
  }, [onDone])

  const clearTimers = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (advanceRef.current) clearTimeout(advanceRef.current)
    pollRef.current = null
    advanceRef.current = null
  }, [])

  // Navigate to this step's route if we're not already there. Waits for
  // demo-data seeding to finish first, since early steps may depend on
  // the demo worker/site/supplier/contractor already existing.
  useEffect(() => {
    if (!step || seeding) return
    setNavigating(true)
    setRect(null)
    if (pathname !== step.route) {
      router.push(step.route)
    } else {
      setNavigating(false)
    }
  }, [stepIndex, step, pathname, router, seeding])

  // Once on the right route: optionally click a "pre-click" element first
  // (e.g. open a demo row's detail view), wait briefly for it to render,
  // then poll for the actual spotlight target and start the auto-advance
  // timer once it's found.
  useEffect(() => {
    if (!step || navigating) return
    clearTimers()

    let cancelled = false

    const beginPolling = () => {
      const start = Date.now()
      pollRef.current = setInterval(() => {
        if (cancelled) return
        const el = document.querySelector(step.selector)
        if (el) {
          const r = el.getBoundingClientRect()
          setRect({ top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height })
          // Scroll the element into view if it's off-screen, so the spotlight
          // is actually visible rather than highlighting something below the fold.
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null

          advanceRef.current = setTimeout(() => {
            if (isLast) finish()
            else setStepIndex(i => i + 1)
          }, step.durationMs)
          return
        }
        if (Date.now() - start > POLL_TIMEOUT_MS) {
          // Element never showed up (slow data load, missing demo row, etc)
          // — don't get stuck forever, just move on.
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          if (isLast) finish()
          else setStepIndex(i => i + 1)
        }
      }, POLL_INTERVAL_MS)
    }

    if (step.preClickSelector) {
      // The pre-click target (e.g. the demo worker's card) may itself take
      // a moment to mount after navigation/data fetch — poll for IT first,
      // click it once found, then move on to polling for the real target.
      const clickStart = Date.now()
      const clickPoll = setInterval(() => {
        if (cancelled) return
        const clickEl = document.querySelector(step.preClickSelector!) as HTMLElement | null
        if (clickEl) {
          clearInterval(clickPoll)
          clickEl.click()
          setTimeout(beginPolling, step.preClickWaitMs ?? 400)
          return
        }
        if (Date.now() - clickStart > POLL_TIMEOUT_MS) {
          clearInterval(clickPoll)
          // Pre-click target never appeared (e.g. demo seeding failed) —
          // fall through to polling for the real target anyway, which will
          // itself time out and advance if it's also missing.
          beginPolling()
        }
      }, POLL_INTERVAL_MS)
      pollRef.current = clickPoll
    } else {
      beginPolling()
    }

    return () => { cancelled = true; clearTimers() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, navigating])

  // Detect that navigation actually landed (pathname now matches route).
  useEffect(() => {
    if (step && pathname === step.route) setNavigating(false)
  }, [pathname, step])

  useEffect(() => clearTimers, [clearTimers])

  if (!step) return null

  const dimStyle = rect
    ? {
        clipPath: `polygon(
          0 0, 0 100%, 100% 100%, 100% 0, 0 0,
          ${rect.left - 8}px ${rect.top - 8}px,
          ${rect.left - 8}px ${rect.top + rect.height + 8}px,
          ${rect.left + rect.width + 8}px ${rect.top + rect.height + 8}px,
          ${rect.left + rect.width + 8}px ${rect.top - 8}px,
          ${rect.left - 8}px ${rect.top - 8}px
        )`,
      }
    : {}

  const captionTop = rect
    ? step.placement === 'top'
      ? Math.max(12, rect.top - 140)
      : rect.top + rect.height + 16
    : 0

  return (
    <>
      {/* Dimmer with a cut-out hole over the real target element */}
      <div className="fixed inset-0 z-[90] pointer-events-none transition-opacity duration-300"
        style={{ background: 'rgba(0,0,0,0.65)', opacity: rect ? 1 : 0, ...dimStyle }} />

      {/* Glow ring around the spotlighted element */}
      {rect && (
        <div className="fixed z-[91] rounded-xl pointer-events-none animate-pulse"
          style={{
            top: rect.top - 8, left: rect.left - 8,
            width: rect.width + 16, height: rect.height + 16,
            border: '3px solid rgb(var(--accent))',
            boxShadow: '0 0 0 4px rgba(var(--accent),0.25)',
          }} />
      )}

      {/* Caption card */}
      {rect && (
        <div className="fixed z-[92] left-1/2 -translate-x-1/2 w-[88vw] max-w-sm p-4 rounded-2xl shadow-2xl"
          style={{
            top: captionTop,
            background: 'rgb(var(--surface))',
            border: '1px solid rgb(var(--border))',
          }}>
          <div className="flex items-start justify-between mb-1.5">
            <p className="font-black text-sm" style={{ color: 'rgb(var(--accent))' }}>
              {te ? step.title_te : step.title_en}
            </p>
            <button onClick={finish} className="text-xs font-bold flex-shrink-0 ml-3" style={{ color: 'rgb(var(--muted))' }}>
              {te ? 'దాటవేయండి ✕' : 'Skip tour ✕'}
            </button>
          </div>
          <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgb(var(--text))' }}>
            {te ? step.body_te : step.body_en}
          </p>
          <div className="flex gap-1">
            {TOUR_STEPS.map((_, i) => (
              <div key={i} className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(var(--accent),0.15)' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    background: 'rgb(var(--accent))',
                    width: i < stepIndex ? '100%' : i === stepIndex ? '100%' : '0%',
                    transition: i === stepIndex ? `width ${step.durationMs}ms linear` : 'none',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading state while navigating between pages / waiting for the element */}
      {!rect && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-8 h-8 border-4 rounded-full animate-spin"
            style={{ borderColor: 'rgb(var(--accent))', borderTopColor: 'transparent' }} />
        </div>
      )}
    </>
  )
}
