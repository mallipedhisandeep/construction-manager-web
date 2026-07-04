'use client'
import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PRICING } from '@/lib/pricing'
import Nav from './Nav'
import type { Lang } from '@/lib/strings'

type Theme = 'light' | 'dark'
interface LangCtx  { lang: Lang; toggleLang: () => void }
interface ThemeCtx { theme: Theme; toggleTheme: () => void }
interface ToastCtx { showToast: (msg: string, type?: 'ok' | 'err') => void }
interface AppCtx   extends LangCtx, ThemeCtx, ToastCtx {}

const Ctx = createContext<AppCtx>({
  lang: 'en', toggleLang: () => {},
  theme: 'light', toggleTheme: () => {},
  showToast: () => {},
})

export const useLang  = (): LangCtx  => { const c = useContext(Ctx); return { lang: c.lang, toggleLang: c.toggleLang } }
export const useTheme = (): ThemeCtx => { const c = useContext(Ctx); return { theme: c.theme, toggleTheme: c.toggleTheme } }
export const useToast = (): ToastCtx => { const c = useContext(Ctx); return { showToast: c.showToast } }

const PUBLIC_PATHS   = ['/login', '/auth/callback', '/auth/confirm']
const PAYWALL_EXEMPT = ['/profile', '/subscribe', '/login', '/auth/callback', '/auth/confirm', '/support', '/admin']

// 'unknown' = no subscription row yet (new user, trigger delay, or existing user
// before monetization was added). Treat as 'trialing' so they are NOT paywalled.
type SubStatus = 'active' | 'trialing' | 'expired' | 'lifetime' | 'unknown'

async function getSubStatus(userId: string): Promise<SubStatus> {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('plan,status,trial_ends_at,current_period_end')
      .eq('user_id', userId)
      .maybeSingle()

    // RLS error or network error — don't block the user
    if (error) {
      console.warn('[AppShell] subscriptions query error (treating as trialing):', error.message)
      return 'unknown'
    }

    // No row yet (new user, trigger delay, or pre-monetization user)
    if (!data) return 'unknown'

    if (data.plan === 'lifetime') return 'lifetime'

    // 'pro' must ALSO have a current_period_end in the future — this is
    // what makes cancellation/non-renewal actually take effect once the
    // paid period ends, instead of 'active' alone granting access forever.
    // Mirrors public.has_active_access() in supabase_security_fix.sql —
    // if you change one, change both.
    if (data.plan === 'pro' && data.status === 'active') {
      if (data.current_period_end && new Date(data.current_period_end) > new Date()) return 'active'
      return 'expired'
    }

    if (data.trial_ends_at && new Date(data.trial_ends_at) > new Date()) return 'trialing'
    if (data.trial_ends_at && new Date(data.trial_ends_at) <= new Date()) return 'expired'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

// ── Paywall screen shown when trial has expired ───────────────────────────────
function PaywallScreen({ lang, onGoToProfile }: { lang: Lang; onGoToProfile: () => void }) {
  const te = lang === 'te'
  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center p-6"
      style={{ background:'rgb(var(--bg))' }}>
      <div className="text-6xl mb-4">⏰</div>
      <h1 className="text-2xl font-black text-center mb-2" style={{ color:'rgb(var(--text))' }}>
        {te ? 'ట్రయల్ ముగిసింది' : 'Trial Ended'}
      </h1>
      <p className="text-sm text-center mb-6 max-w-xs" style={{ color:'rgb(var(--muted))' }}>
        {te
          ? 'మీ 30-రోజుల ట్రయల్ ముగిసింది. యాప్ ఉపయోగించడం కొనసాగించడానికి సభ్యత్వం పొందండి.'
          : 'Your 30-day free trial has ended. Subscribe to continue using the app.'}
      </p>
      <div className="w-full max-w-xs card p-5 mb-4 text-center">
        <p className="text-2xl font-black mb-1" style={{ color:'rgb(var(--accent))' }}>
          {PRICING.monthly.label_en} <span className="text-sm font-medium" style={{ color:'rgb(var(--muted))' }}>{te ? 'లేదా' : 'or'}</span> {PRICING.yearly.label_en}
        </p>
        <p className="text-sm mb-3" style={{ color:'rgb(var(--muted))' }}>
          {te ? 'అన్ని ఫీచర్లు' : 'all features included'}
        </p>
        <button onClick={onGoToProfile} className="btn-primary w-full py-3 text-base font-black">
          {te ? '⭐ సభ్యత్వం పొందండి' : '⭐ Subscribe Now'}
        </button>
      </div>
      <button onClick={onGoToProfile} className="text-sm" style={{ color:'rgb(var(--muted))' }}>
        {te ? 'ప్రొఫైల్ చూడండి' : 'Go to Profile'}
      </button>
    </div>
  )
}

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved === 'light' || saved === 'dark') return saved
  } catch {}
  // Default is light mode — deliberately NOT following the device's
  // system dark-mode preference, so every new user sees the same
  // consistent light UI on first visit regardless of their phone's
  // theme setting. They can still switch to dark anytime via the
  // toggle, and that choice is what gets remembered above.
  return 'light'
}

function getInitialLang(): Lang {
  try {
    const saved = localStorage.getItem('lang')
    if (saved === 'en' || saved === 'te') return saved
  } catch {}
  return 'en'
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [lang,      setLangState]  = useState<Lang>('en')
  const [theme,     setThemeState] = useState<Theme>('dark')
  const [authState, setAuthState]  = useState<'checking'|'authed'|'unauthed'>('checking')
  const [subStatus, setSubStatus]  = useState<SubStatus>('unknown')
  const [hydrated,  setHydrated]   = useState(false)

  const [toast,    setToast]    = useState<{msg:string; type:'ok'|'err'} | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, type })
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }, [])

  const router   = useRouter()
  const pathname = usePathname()
  const isPublicPath  = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  const isPaywallFree = PAYWALL_EXEMPT.some(p => pathname.startsWith(p))

  useEffect(() => {
    const t = getInitialTheme()
    const l = getInitialLang()
    setThemeState(t)
    setLangState(l)
    document.documentElement.classList.toggle('dark', t === 'dark')
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme, hydrated])

  useEffect(() => {
    let mounted = true

    const checkAuth = async () => {
      try {
        // Use getSession first (cheaper, cached) then verify with getUser
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return

        if (session?.user) {
          setAuthState('authed')
          // Fetch subscription status in background — don't block render
          getSubStatus(session.user.id).then(status => {
            if (mounted) setSubStatus(status)
          })
        } else {
          setAuthState('unauthed')
          if (!isPublicPath) router.replace('/login')
        }
      } catch (err) {
        console.error('[AppShell] auth check failed:', err)
        if (mounted) {
          setAuthState('unauthed')
          if (!isPublicPath) router.replace('/login')
        }
      }
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (session?.user) {
        setAuthState('authed')
        getSubStatus(session.user.id).then(status => {
          if (mounted) setSubStatus(status)
        })
      } else {
        setAuthState('unauthed')
        if (!isPublicPath) router.replace('/login')
      }
    })

    return () => { mounted = false; subscription.unsubscribe() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleLang = useCallback(() => {
    setLangState(prev => {
      const next: Lang = prev === 'en' ? 'te' : 'en'
      localStorage.setItem('lang', next)
      return next
    })
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const next: Theme = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem('theme', next)
      return next
    })
  }, [])

  const toastEl = toast && (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-16 right-4 z-[200] max-w-[80vw] px-4 py-2.5 rounded-xl shadow-lg text-white text-sm font-semibold pointer-events-none transition-opacity"
      style={{ background: toast.type === 'ok' ? '#16a34a' : '#dc2626' }}>
      {toast.msg}
    </div>
  )

  // ── Public paths (login, callback etc) — render immediately, no auth gate ──
  if (isPublicPath) {
    return (
      <Ctx.Provider value={{ lang, toggleLang, theme, toggleTheme, showToast }}>
        {toastEl}
        <main>{children}</main>
      </Ctx.Provider>
    )
  }

  // ── Protected paths ────────────────────────────────────────────────────────
  if (authState === 'checking') {
    return (
      <Ctx.Provider value={{ lang, toggleLang, theme, toggleTheme, showToast }}>
        <div
          className="fixed inset-0 z-[100]"
          style={{ background: 'rgb(var(--bg))' }}
        />
      </Ctx.Provider>
    )
  }

  if (authState === 'unauthed') return null

  // 'unknown' = no subscription row yet — treat as allowed (not paywalled)
  const isPaywalled = subStatus === 'expired' && !isPaywallFree

  return (
    <Ctx.Provider value={{ lang, toggleLang, theme, toggleTheme, showToast }}>
      <Nav />
      {toastEl}
      {isPaywalled ? (
        <PaywallScreen lang={lang} onGoToProfile={() => router.push('/profile')} />
      ) : (
        <main className="pt-14 pb-16">
          {children}
        </main>
      )}
    </Ctx.Provider>
  )
}
