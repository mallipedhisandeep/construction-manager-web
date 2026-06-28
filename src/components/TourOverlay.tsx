'use client'
// src/components/TourOverlay.tsx
//
// Renders nothing until a tour is actively playing. When active, it:
//   0. Shows a language picker (English / Telugu) before anything else —
//      the whole tour plays in whichever language is chosen here.
//   1. Navigates the router to the current step's route (if not already there)
//   2. Polls the DOM for the step's selector to actually exist (real layout,
//      real data, may take a moment after navigation/data fetch)
//   3. Dims the rest of the screen, cuts a transparent "hole" over the
//      target element, and shows a caption near it
//   4. CONTINUOUSLY re-measures the target element's position every frame
//      (via requestAnimationFrame) so the spotlight stays correctly placed
//      even if the user scrolls, resizes, or the layout shifts — it never
//      relies on a single frozen snapshot.
//   5. Pauses the auto-advance countdown while the user is actively
//      scrolling, and only resumes once they stop — so a stray scroll
//      never eats into the time they have to read the caption.
//   6. Auto-advances to the next step after the step's durationMs of
//      actual idle (non-scrolling) time.
//   7. On the last step, marks the tour complete in Supabase and unmounts.
//
// The person can tap "Skip tour" at any point, or "Next" to move on
// immediately — this also marks it complete on the last step.

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TOUR_STEPS } from '@/lib/tourSteps'
import { seedTourDemoData, cleanupTourDemoData, type DemoRowRefs } from '@/lib/tourDemoData'

interface Rect { top: number; left: number; width: number; height: number }

const POLL_INTERVAL_MS = 100
const POLL_TIMEOUT_MS = 5000   // give up waiting for an element after this long and skip to the next step
const SCROLL_SETTLE_MS = 700   // how long the user must be still (no scroll/touch) before the countdown resumes

export function TourOverlay({ onDone }: { onDone: () => void }) {
  const router = useRouter()
  const pathname = usePathname()

  // Language is chosen explicitly before the tour starts — null means
  // "not chosen yet", which is what gates the language-picker screen.
  const [tourLang, setTourLang] = useState<'en' | 'te' | null>(null)
  const te = tourLang === 'te'

  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [navigating, setNavigating] = useState(true)
  const [seeding, setSeeding] = useState(true)
  const [progress, setProgress] = useState(0) // 0..1, how far through the current step's countdown we are

  const demoRefs = useRef<DemoRowRefs>({})
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rafRef = useRef<number | null>(null)
  const elRef = useRef<Element | null>(null)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isScrollingRef = useRef(false)
  const remainingMsRef = useRef(0)
  const lastTickRef = useRef(0)

  const step = TOUR_STEPS[stepIndex]
  const isLast = stepIndex === TOUR_STEPS.length - 1

  // Seed exactly one demo row per module before the tour starts, so steps
  // that spotlight Edit/Delete/Pay (which only render for an existing
  // item) have something real to act on even on a brand-new account.
  // Only runs once a language has actually been picked.
  useEffect(() => {
    if (!tourLang) return
    let mounted = true
    supabase.auth.getUser().then(async ({ data }) => {
      const userId = data.user?.id
      if (!userId) { if (mounted) setSeeding(false); return }
      const refs = await seedTourDemoData(userId)
      if (mounted) { demoRefs.current = refs; setSeeding(false) }
    })
    return () => { mounted = false }
  }, [tourLang])

  const finish = useCallback(async () => {
    const { data } = await supabase.auth.getUser()
    const userId = data.user?.id
    // Clean up demo rows FIRST — if marking has_seen succeeds but cleanup
    // fails silently, the user is left with permanent stray "Demo ..."
    // rows and no way for the tour to retry (it never plays again).
    await cleanupTourDemoData(demoRefs.current)
    if (userId) {
      await supabase.from('user_tour_status').upsert({ user_id: userId, has_seen: true, seen_at: new Date().toISOString() })
    }
    onDone()
  }, [onDone])

  const clearAllTimers = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    pollRef.current = null
    rafRef.current = null
    scrollTimerRef.current = null
  }, [])

  // Navigate to this step's route if we're not already there. Waits for a
  // language choice AND demo-data seeding to finish first, since early
  // steps may depend on the demo worker/site/supplier/contractor already
  // existing.
  useEffect(() => {
    if (!tourLang || !step || seeding) return
    setNavigating(true)
    setRect(null)
    elRef.current = null
    if (pathname !== step.route) {
      router.push(step.route)
    } else {
      setNavigating(false)
    }
  }, [stepIndex, step, pathname, router, seeding, tourLang])

  // Detect that navigation actually landed (pathname now matches route).
  useEffect(() => {
    if (step && pathname === step.route) setNavigating(false)
  }, [pathname, step])

  // The main per-step lifecycle: optionally pre-click something, find the
  // real spotlight target, then continuously track its live position and
  // run a pause-aware countdown until advancing.
  useEffect(() => {
    if (!tourLang || !step || navigating) return
    clearAllTimers()
    let cancelled = false

    const trackAndCountdown = (el: Element) => {
      elRef.current = el
      remainingMsRef.current = step.durationMs
      lastTickRef.current = performance.now()
      isScrollingRef.current = false
      setProgress(0)

      const tick = (now: number) => {
        if (cancelled) return
        const liveEl = elRef.current
        if (liveEl && liveEl.isConnected) {
          const r = liveEl.getBoundingClientRect()
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
        }

        const dt = now - lastTickRef.current
        lastTickRef.current = now

        // Only spend down the countdown while the user isn't actively
        // scrolling — a scroll just pauses the clock, it never resets it,
        // so a brief accidental scroll doesn't cost the person their
        // remaining reading time.
        if (!isScrollingRef.current) {
          remainingMsRef.current = Math.max(0, remainingMsRef.current - dt)
          setProgress(1 - remainingMsRef.current / step.durationMs)
        }

        if (remainingMsRef.current <= 0) {
          if (isLast) finish()
          else setStepIndex(i => i + 1)
          return
        }

        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    const beginPolling = () => {
      const start = Date.now()
      pollRef.current = setInterval(() => {
        if (cancelled) return
        const el = document.querySelector(step.selector)
        if (el) {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          // Scroll the element into view if it's off-screen, so the
          // spotlight is actually visible — then start tracking/counting
          // shortly after, giving the smooth-scroll animation time to settle.
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          setTimeout(() => { if (!cancelled) trackAndCountdown(el) }, 350)
          return
        }
        if (Date.now() - start > POLL_TIMEOUT_MS) {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          if (isLast) finish()
          else setStepIndex(i => i + 1)
        }
      }, POLL_INTERVAL_MS)
    }

    if (step.preClickSelector) {
      // The pre-click target (e.g. the demo worker's card, or the page's
      // own Add button so its real modal opens) may itself take a moment
      // to mount after navigation/data fetch — poll for IT first, click
      // it once found, then move on to polling for the real target.
      const clickStart = Date.now()
      const clickPoll = setInterval(() => {
        if (cancelled) return
        const clickEl = document.querySelector(step.preClickSelector!) as HTMLElement | null
        if (clickEl) {
          clearInterval(clickPoll)
          clickEl.click()
          setTimeout(beginPolling, step.preClickWaitMs ?? 450)
          return
        }
        if (Date.now() - clickStart > POLL_TIMEOUT_MS) {
          clearInterval(clickPoll)
          beginPolling()
        }
      }, POLL_INTERVAL_MS)
      pollRef.current = clickPoll
    } else {
      beginPolling()
    }

    return () => { cancelled = true; clearAllTimers() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, navigating, tourLang])

  // Pause-on-scroll: any scroll or touch-move marks "actively scrolling"
  // immediately, and a short settle timer clears that flag once movement
  // stops — this is what makes the countdown forgiving of accidental
  // scrolls instead of just silently mis-tracking position.
  useEffect(() => {
    if (!tourLang) return
    const markScrolling = () => {
      isScrollingRef.current = true
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = setTimeout(() => { isScrollingRef.current = false }, SCROLL_SETTLE_MS)
    }
    window.addEventListener('scroll', markScrolling, { passive: true, capture: true })
    window.addEventListener('touchmove', markScrolling, { passive: true })
    window.addEventListener('resize', markScrolling)
    return () => {
      window.removeEventListener('scroll', markScrolling, true)
      window.removeEventListener('touchmove', markScrolling)
      window.removeEventListener('resize', markScrolling)
    }
  }, [tourLang])

  useEffect(() => clearAllTimers, [clearAllTimers])

  // ── Language picker — shown before anything else ──────────────────────
  if (!tourLang) {
    return (
      <div className="fixed inset-0 z-[95] flex items-center justify-center p-6"
        style={{ background: 'rgba(0,0,0,0.85)' }}>
        <div className="w-full max-w-xs p-6 rounded-2xl text-center"
          style={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--border))' }}>
          <p className="text-2xl mb-2">👋</p>
          <p className="font-black text-base mb-1" style={{ color: 'rgb(var(--text))' }}>
            Welcome! Choose your language
          </p>
          <p className="font-black text-base mb-5" style={{ color: 'rgb(var(--text))' }}>
            స్వాగతం! మీ భాషను ఎంచుకోండి
          </p>
          <div className="flex flex-col gap-2.5">
            <button onClick={() => setTourLang('en')}
              className="w-full py-3 rounded-xl font-bold text-sm"
              style={{ background: 'rgb(var(--accent))', color: '#fff' }}>
              English
            </button>
            <button onClick={() => setTourLang('te')}
              className="w-full py-3 rounded-xl font-bold text-sm"
              style={{ background: 'rgb(var(--accent))', color: '#fff' }}>
              తెలుగు
            </button>
          </div>
          <button onClick={onDone} className="mt-4 text-xs font-bold" style={{ color: 'rgb(var(--muted))' }}>
            Skip for now / ఇప్పుడు దాటవేయండి
          </button>
        </div>
      </div>
    )
  }

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
      ? Math.max(12, rect.top - 150)
      : Math.min(window.innerHeight - 200, rect.top + rect.height + 16)
    : 0

  return (
    <>
      {/* Dimmer with a cut-out hole over the real target element. */}
      <div className="fixed inset-0 z-[90] pointer-events-none transition-opacity duration-300"
        style={{ background: 'rgba(0,0,0,0.65)', opacity: rect ? 1 : 0, ...dimStyle }} />

      {/* Glow ring around the spotlighted element — repositioned every
          animation frame via `rect`, so it tracks scrolling live. */}
      {rect && (
        <div className="fixed z-[91] rounded-xl pointer-events-none"
          style={{
            top: rect.top - 8, left: rect.left - 8,
            width: rect.width + 16, height: rect.height + 16,
            border: '3px solid rgb(var(--accent))',
            boxShadow: '0 0 0 4px rgba(var(--accent),0.25)',
          }} />
      )}

      {/* Caption card */}
      {rect && (
        <div className="fixed z-[92] left-1/2 -translate-x-1/2 w-[90vw] max-w-sm p-4 rounded-2xl shadow-2xl"
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
          <div className="flex items-center gap-2">
            <div className="flex gap-1 flex-1">
              {TOUR_STEPS.map((_, i) => (
                <div key={i} className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(var(--accent),0.15)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: 'rgb(var(--accent))',
                      width: i < stepIndex ? '100%' : i === stepIndex ? `${Math.round(progress * 100)}%` : '0%',
                    }}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() => { if (isLast) finish(); else setStepIndex(i => i + 1) }}
              className="text-xs font-bold flex-shrink-0 px-2 py-1 rounded-lg"
              style={{ background: 'rgba(var(--accent),0.12)', color: 'rgb(var(--accent))' }}>
              {te ? 'తదుపరి ›' : 'Next ›'}
            </button>
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
