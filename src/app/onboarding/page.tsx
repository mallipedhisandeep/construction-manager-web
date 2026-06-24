'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { completeOnboarding } from '@/lib/onboarding'
import { useLang } from '@/components/AppShell'

const SLIDES = [
  {
    icon: '⚙️',
    title_te: '🏗️ నిర్మాణ నిర్వహణ సరళం చేయబడింది',
    title_en: '🏗️ Construction Management Simplified',
    desc_te: 'కార్మికులు, సైట్‌లు, నగదు — సభ్యత్వం లేకుండా కూడా ఉపయోగించండి.',
    desc_en: 'Workers, sites, cash flow — all in one place.',
  },
  {
    icon: '👷',
    title_te: '👷 కార్మికులు జోడించండి',
    title_en: '👷 Add Your Workers',
    desc_te: 'దైనిక హాజరు, వేతనాలు, మరియు పేమెంట్‌ల ట్రాక్ చేయండి.',
    desc_en: 'Track daily attendance, wages, and payments.',
  },
  {
    icon: '🏗️',
    title_te: '🏗️ సైట్‌లను సృష్టించండి',
    title_en: '🏗️ Create Sites',
    desc_te: 'ప్రతి ప్రాజెక్టు కోసం సైట్‌ను నిర్వహించండి.',
    desc_en: 'Organize each project with a site.',
  },
  {
    icon: '📋',
    title_te: '📋 హాజరు నిర్వహించండి',
    title_en: '📋 Manage Attendance',
    desc_te: 'రోజువారీ హాజరు నమోదు చేసి మీ టీమ్‌ను అనుసరించండి.',
    desc_en: 'Log daily attendance and track your team.',
  },
  {
    icon: '🚀',
    title_te: '🚀 ప్రారంభించండి!',
    title_en: '🚀 You\'re All Set!',
    desc_te: 'అన్ని ఫీచర్‌లను అన్వేషించండి మరియు సభ్యత్వం పొందండి.',
    desc_en: 'Explore all features and subscribe for Pro.',
  },
]

export default function OnboardingPage() {
  const { lang } = useLang()
  const router = useRouter()
  const [slide, setSlide] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)
    })
  }, [router])

  const handleNext = async () => {
    if (slide === SLIDES.length - 1) {
      if (userId) await completeOnboarding(userId)
      router.push('/')
    } else {
      setSlide(slide + 1)
    }
  }

  const handleSkip = async () => {
    if (userId) await completeOnboarding(userId)
    router.push('/')
  }

  const s = SLIDES[slide]
  const isLast = slide === SLIDES.length - 1

  return (
    <div
      className="w-full h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--bg)))' }}
    >
      <div className="text-7xl mb-8 animate-bounce">{s.icon}</div>
      <h1 className="text-3xl font-black text-center mb-4 text-white">{lang === 'te' ? s.title_te : s.title_en}</h1>
      <p className="text-lg text-center mb-12 text-white opacity-90 max-w-md">
        {lang === 'te' ? s.desc_te : s.desc_en}
      </p>

      <div className="flex gap-2 mb-8">
        {SLIDES.map((_, i) => (
          <div
            key={i}
            className="h-1 w-8 rounded-full transition-all"
            style={{ background: i <= slide ? 'rgb(var(--accent))' : 'rgba(255,255,255,0.3)' }}
          />
        ))}
      </div>

      <div className="flex gap-3 w-full max-w-sm">
        <button onClick={handleSkip} className="flex-1 py-3 rounded-xl font-bold text-white border-2 border-white">
          {lang === 'te' ? 'దాటవేయండి' : 'Skip'}
        </button>
        <button
          onClick={handleNext}
          className="flex-1 py-3 rounded-xl font-bold text-white"
          style={{ background: 'rgba(255,255,255,0.3)' }}
        >
          {isLast ? (lang === 'te' ? 'ముగించండి' : 'Done') : (lang === 'te' ? 'తదుపరి' : 'Next')} →
        </button>
      </div>
    </div>
  )
}
