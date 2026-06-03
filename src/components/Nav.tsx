'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLang, useTheme } from '@/components/AppShell'
import { ts } from '@/lib/strings'

const NAV = [
  { href:'/',                emoji:'🏠', key:'home'          },
  { href:'/workers',         emoji:'👷', key:'workers'       },
  { href:'/attendance',      emoji:'📋', key:'attendance'    },
  { href:'/sites',           emoji:'🏗️', key:'sites'         },
  { href:'/suppliers',       emoji:'🏪', key:'suppliers'     },
  { href:'/goods',           emoji:'📦', key:'goods'         },
  { href:'/money',           emoji:'💰', key:'money'         },
  { href:'/private-workers', emoji:'🔧', key:'privateWorkers'},
  { href:'/private-work',    emoji:'📋', key:'privateWork'   },
  { href:'/reports',         emoji:'📊', key:'reports'       },
  { href:'/trash',           emoji:'🗑️', key:'trash'         },
]

const BOTTOM_NAV = [
  { href:'/',           emoji:'🏠', key:'home'       },
  { href:'/workers',    emoji:'👷', key:'workers'    },
  { href:'/attendance', emoji:'📋', key:'attendance' },
  { href:'/sites',      emoji:'🏗️', key:'sites'      },
  { href:'/money',      emoji:'💰', key:'money'      },
]

export default function Nav() {
  const pathname  = usePathname()
  const router    = useRouter()
  const { lang, toggleLang } = useLang()
  const { theme, toggleTheme } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // FIX: close drawer first, then sign out + redirect, preventing navigation race
  const handleSignOut = async () => {
    setDrawerOpen(false)
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 border-b"
        style={{background:'rgb(var(--surface))', borderColor:'rgb(var(--border))'}}>
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl">🏗️</span>
          <span className="font-black text-sm" style={{color:'rgb(var(--text))'}}>
            {ts(lang,'appName')}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={toggleLang}
            className="px-2.5 py-1 rounded-xl text-xs font-bold border transition"
            style={{background:'rgb(var(--surface2))',borderColor:'rgb(var(--border))',color:'rgb(var(--text))'}}>
            {lang==='en'?'తెలుగు':'English'}
          </button>
          <button onClick={toggleTheme}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition"
            style={{background:'rgb(var(--surface2))'}}>
            {theme==='dark'?'☀️':'🌙'}
          </button>
          <button onClick={()=>setDrawerOpen(true)}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition"
            style={{background:'rgb(var(--surface2))'}}>
            <span className="text-base">☰</span>
          </button>
        </div>
      </header>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 flex border-t"
        style={{background:'rgb(var(--surface))', borderColor:'rgb(var(--border))'}}>
        {BOTTOM_NAV.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 transition"
              style={{color: active ? 'rgb(var(--accent))' : 'rgb(var(--muted))'}}>
              <span className="text-xl leading-none">{item.emoji}</span>
              <span className={`text-[10px] font-semibold leading-none ${active?'':'opacity-60'}`}>
                {ts(lang, item.key as Parameters<typeof ts>[1])}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={()=>setDrawerOpen(false)} />
          <div className="w-72 h-full overflow-y-auto flex flex-col shadow-2xl"
            style={{background:'rgb(var(--surface))'}}>
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b"
              style={{borderColor:'rgb(var(--border))'}}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏗️</span>
                <span className="font-black" style={{color:'rgb(var(--text))'}}>
                  {ts(lang,'appName')}
                </span>
              </div>
              <button onClick={()=>setDrawerOpen(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{background:'rgb(var(--surface2))',color:'rgb(var(--muted))'}}>
                ✕
              </button>
            </div>

            {/* Nav links */}
            <div className="flex-1 py-3">
              {NAV.map(item => {
                const active = pathname === item.href
                return (
                  <Link key={item.href} href={item.href}
                    onClick={()=>setDrawerOpen(false)}
                    className="flex items-center gap-3 px-5 py-3 transition"
                    style={{
                      background: active ? 'rgba(var(--accent),0.12)' : 'transparent',
                      color: active ? 'rgb(var(--accent))' : 'rgb(var(--text))',
                    }}>
                    <span className="text-xl w-7 text-center leading-none">{item.emoji}</span>
                    <span className={`text-sm ${active?'font-bold':'font-medium'}`}>
                      {ts(lang, item.key as Parameters<typeof ts>[1])}
                    </span>
                    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{background:'rgb(var(--accent))'}}/>}
                  </Link>
                )
              })}
            </div>

            {/* Drawer footer */}
            <div className="p-4 border-t space-y-2" style={{borderColor:'rgb(var(--border))'}}>
              <button onClick={toggleTheme}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition"
                style={{background:'rgb(var(--surface2))',color:'rgb(var(--text))'}}>
                <span>{theme==='dark'?'☀️':'🌙'}</span>
                <span className="text-sm font-medium">{theme==='dark'?ts(lang,'lightMode'):ts(lang,'darkMode')}</span>
              </button>
              {/* FIX: drawer closes before signOut to avoid navigation race */}
              <button onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition bg-red-50 dark:bg-red-900/20">
                <span>🚪</span>
                <span className="text-sm font-medium text-red-600 dark:text-red-400">{ts(lang,'signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
