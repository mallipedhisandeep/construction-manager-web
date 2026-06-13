'use client'
import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from './Nav'
import type { Lang } from '@/lib/strings'

type Theme = 'light' | 'dark'
interface LangCtx  { lang: Lang; toggleLang: () => void }
interface ThemeCtx { theme: Theme; toggleTheme: () => void }
interface ToastCtx { showToast: (msg: string, type?: 'ok' | 'err') => void }
interface AppCtx   extends LangCtx, ThemeCtx, ToastCtx {}

const Ctx = createContext<AppCtx>({
  lang: 'en', toggleLang: () => {},
  theme: 'dark', toggleTheme: () => {},
  showToast: () => {},
})

export const useLang  = (): LangCtx  => { const c = useContext(Ctx); return { lang: c.lang, toggleLang: c.toggleLang } }
export const useTheme = (): ThemeCtx => { const c = useContext(Ctx); return { theme: c.theme, toggleTheme: c.toggleTheme } }
export const useToast = (): ToastCtx => { const c = useContext(Ctx); return { showToast: c.showToast } }

const PUBLIC_PATHS   = ['/login', '/signup', '/auth/callback', '/auth/confirm']
const PAYWALL_EXEMPT = ['/profile', '/subscribe', '/login', '/signup', '/auth/callback', '/auth/confirm']

type SubStatus = 'active' | 'trialing' | 'expired' | 'lifetime' | 'unknown'

async function getSubStatus(userId: string): Promise<SubStatus> {
  try {
    const { data } = await supabase
      .from('subscriptions')
      .select('plan,status,trial_ends_at,current_period_end')
      .eq('user_id', userId)
      .maybeSingle()
    if (!data) return 'unknown'
    if (data.plan === 'lifetime') return 'lifetime'
    if (data.plan === 'pro' && data.status === 'active') return 'active'
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
        <p className="text-3xl font-black mb-1" style={{ color:'rgb(var(--accent))' }}>₹200</p>
        <p className="text-sm mb-3" style={{ color:'rgb(var(--muted))' }}>
          {te ? 'నెలకు · అన్ని ఫీచర్లు' : 'per month · all features'}
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
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  } catch {}
  return 'dark'
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
  // FIX: start as 'checking' but render children immediately on public paths
  // so there's no white flash on login page
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
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!mounted) return
      if (user) {
        setAuthState('authed')
        const status = await getSubStatus(user.id)
        if (mounted) setSubStatus(status)
      } else {
        setAuthState('unauthed')
        if (!isPublicPath) router.replace('/login')
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (session) { setAuthState('authed') }
      else { setAuthState('unauthed'); if (!isPublicPath) router.replace('/login') }
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
  // This eliminates the white flash: children render right away with correct theme
  if (isPublicPath) {
    return (
      <Ctx.Provider value={{ lang, toggleLang, theme, toggleTheme, showToast }}>
        {toastEl}
        <main>{children}</main>
      </Ctx.Provider>
    )
  }

  // ── Protected paths ────────────────────────────────────────────────────────
  // FIX: Instead of a Splash screen (icon + spinner) while auth checks,
  // render nothing visible — body background is already set by CSS vars in
  // globals.css and the inline script in layout.tsx so there's no white flash.
  // A subtle full-screen bg div prevents any layout shift.
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

  const isPaywalled = subStatus === 'expired' && !isPaywallFree

  return (
    <Ctx.Provider value={{ lang, toggleLang, theme, toggleTheme, showToast }}>
      <Nav />
      {toastEl}
      {isPaywalled && (
        <PaywallScreen lang={lang} onGoToProfile={() => router.push('/profile')} />
      )}
      <main className="pt-14 pb-16">
        {children}
      </main>
    </Ctx.Provider>
  )
}
