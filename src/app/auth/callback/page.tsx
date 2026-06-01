'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/')
      else router.replace('/login')
    })
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center"
      style={{background:'linear-gradient(160deg, #0a0e16 0%, #111827 100%)'}}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16 rounded-full flex items-center justify-center"
          style={{background:'rgba(212,140,40,0.1)',border:'2px solid rgba(212,140,40,0.3)'}}>
          <span style={{fontSize:'1.8rem'}}>🏗️</span>
          <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
            style={{borderTopColor:'#d48c28',borderRightColor:'rgba(212,140,40,0.3)'}}/>
        </div>
        <p className="text-sm font-medium tracking-widest uppercase" style={{color:'rgba(212,140,40,0.8)'}}>
          లాగిన్ అవుతోంది...
        </p>
      </div>
    </div>
  )
}
