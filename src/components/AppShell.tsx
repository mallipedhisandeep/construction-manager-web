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

// Public routes that never need auth or subscription check
const PUBLIC_PATHS     = ['/login', '/signup', '/auth/callback', '/auth/confirm']
// Routes exempt from paywall (user can always access these even if subscription expired)
const PAYWALL_EXEMPT   = ['/profile', '/subscribe', '/login', '/signup', '/auth/callback', '/auth/confirm']

// ── Subscription check ────────────────────────────────────────────────────────
type SubStatus = 'active' | 'trialing' | 'expired' | 'lifetime' | 'unknown'

async function getSubStatus(userId: string): Promise<SubStatus> {
  try {
    const { data } = await supabase
      .from('subscriptions')
      .select('plan,status,trial_ends_at,current_period_end')
      .eq('user_id', userId)
      .maybeSingle()
    if (!data) return 'unknown'           // table not set up yet → don't block
    if (data.plan === 'lifetime') return 'lifetime'
    if (data.plan === 'pro' && data.status === 'active') return 'active'
    if (data.trial_ends_at && new Date(data.trial_ends_at) > new Date()) return 'trialing'
    if (data.trial_ends_at && new Date(data.trial_ends_at) <= new Date()) return 'expired'
    return 'unknown'
  } catch {
    // If subscriptions table doesn't exist yet, never block access
    return 'unknown'
  }
}

function Splash() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundImage:'url(/login-bg.jpg)', backgroundSize:'cover', backgroundPosition:'center center', backgroundRepeat:'no-repeat' }}>
      <div className="absolute inset-0"
        style={{ background:'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.45) 50%, rgba(4,3,1,0.92) 100%)' }}/>
      <div className="relative z-10 flex flex-col items-center gap-5">
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center"
          style={{ background:'linear-gradient(135deg,rgba(212,140,40,0.18),rgba(212,140,40,0.06))', border:'1.5px solid rgba(212,140,40,0.4)', boxShadow:'0 0 60px rgba(212,140,40,0.18), 0 8px 40px rgba(0,0,0,0.55)' }}>
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <text x="1" y="40" fontFamily="Georgia,serif" fontWeight="900" fontSize="36" fill="#cccccc">C</text>
            <text x="27" y="40" fontFamily="Georgia,serif" fontWeight="900" fontSize="34" fill="#d48c28">M</text>
          </svg>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-xl font-black tracking-widest uppercase" style={{ color:'#e8e3d8', letterSpacing:'0.16em' }}>Construction</p>
          <p className="text-sm font-bold tracking-[0.32em] uppercase" style={{ color:'rgba(212,140,40,0.85)' }}>Manager</p>
        </div>
        <div className="mt-1 relative w-8 h-8">
          <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor:'#d48c28', borderRightColor:'rgba(212,140,40,0.2)', animationDuration:'0.9s' }}/>
        </div>
      </div>
    </div>
  )
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
        <button
          onClick={onGoToProfile}
          className="btn-primary w-full py-3 text-base font-black">
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
        // Check subscription in parallel — don't block rendering
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

  // Toast element reused in both public and private renders
  const toastEl = toast && (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-16 right-4 z-[200] max-w-[80vw] px-4 py-2.5 rounded-xl shadow-lg text-white text-sm font-semibold pointer-events-none transition-opacity"
      style={{ background: toast.type === 'ok' ? '#16a34a' : '#dc2626' }}>
      {toast.msg}
    </div>
  )

  if (isPublicPath) {
    return (
      <Ctx.Provider value={{ lang, toggleLang, theme, toggleTheme, showToast }}>
        {toastEl}
        <main>{children}</main>
      </Ctx.Provider>
    )
  }

  if (authState === 'checking') return <Splash />
  if (authState === 'unauthed') return null

  // ── Paywall: only block if subscription is confirmed expired ─────────────
  // 'unknown' = table not set up or network error → never block (safe default)
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
