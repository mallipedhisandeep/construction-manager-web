'use client'
import { useState, ReactNode } from 'react'
import { useLang } from '@/components/AppShell'

interface ModuleGuideProps {
  module: 'workers' | 'sites' | 'attendance' | 'money'
  children: ReactNode
}

const GUIDES: Record<string, any> = {
  workers: {
    title_en: 'Workers',
    title_te: 'కార్మికులు',
    intro_en: 'Track workers, attendance & payments',
    intro_te: 'కార్మికులు, హాజరు & చెల్లింపులను ట్రాక్ చేయండి',
    tips: [
      { en: 'Tap + to add a new worker', te: 'కొత్త కార్మికుడిని జోడించడానికి + నొక్కండి' },
      { en: 'Click name to view profile & mark attendance', te: 'హాజరు గుర్తించడానికి పేరుపై క్లిక్ చేయండి' },
      { en: 'Record payments to keep money accurate', te: 'డబ్బు ఖచ్చితమైనదిగా ఉండటానికి చెల్లింపులను రికార్డ్ చేయండి' },
    ],
  },
  sites: {
    title_en: 'Sites',
    title_te: 'సైట్‌లు',
    intro_en: 'Organize projects by location',
    intro_te: 'ప్రాజెక్టులను స్థానం ద్వారా నిర్వహించండి',
    tips: [
      { en: 'Each site = one construction project', te: 'ప్రతి సైట్ = ఒక నిర్మాణ ప్రాజెక్ట్' },
      { en: 'Assign workers to sites to track their work', te: 'సైట్‌లకు కార్మికులను నియమించండి' },
      { en: 'Add materials & expenses for each site', te: 'ప్రతి సైట్‌కు పదార్థాలు & ఖర్చులను జోడించండి' },
    ],
  },
  attendance: {
    title_en: 'Attendance',
    title_te: 'హాజరు',
    intro_en: 'Mark daily presence & share via WhatsApp',
    intro_te: 'రోజువారీ హాజరు & WhatsAppద్వారా పంపండి',
    tips: [
      { en: 'Check boxes to mark workers present today', te: 'ఈ రోజు కార్మికులను ఉంచడానికి బాక్సులను చెక్ చేయండి' },
      { en: 'Share attendance with workers via WhatsApp', te: 'హాజరుని WhatsAppద్వారా కార్మికులకు పంపండి' },
      { en: 'View attendance history & patterns', te: 'హాజరు చరిత్ర & నమూనాలను చూడండి' },
    ],
  },
  money: {
    title_en: 'Money Tracking',
    title_te: 'డబ్బు ట్రాకింగ్',
    intro_en: 'Track income, expenses & profit',
    intro_te: 'ఆదాయం, ఖర్చులు & లాభాన్ని ట్రాక్ చేయండి',
    tips: [
      { en: 'Record money in from clients', te: 'క్లయింట్‌ల నుండి డబ్బును రికార్డ్ చేయండి' },
      { en: 'Add all expenses (wages, materials, etc)', te: 'అన్ని ఖర్చులను జోడించండి' },
      { en: 'See profit/loss summary at bottom', te: 'దిగువ భాగంలో లాభ/నష్టం సమాచారం చూడండి' },
    ],
  },
}

export function ModuleGuide({ module, children }: ModuleGuideProps) {
  const { lang } = useLang()
  const te = lang === 'te'
  const guide = GUIDES[module]
  const [collapsed, setCollapsed] = useState(false)

  if (!guide) return <>{children}</>

  return (
    <div>
      {!collapsed && (
        <div className="mx-4 mb-4 p-4 rounded-xl" style={{ background: 'rgba(var(--accent),0.1)', border: '1px solid rgba(var(--accent),0.3)' }}>
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm font-black" style={{ color: 'rgb(var(--accent))' }}>
              💡 {te ? guide.title_te : guide.title_en}
            </p>
            <button onClick={() => setCollapsed(true)} className="text-xs" style={{ color: 'rgb(var(--muted))' }}>✕</button>
          </div>
          <p className="text-xs mb-3" style={{ color: 'rgb(var(--text))' }}>
            {te ? guide.intro_te : guide.intro_en}
          </p>
          <div className="space-y-1.5">
            {guide.tips.map((tip: any, i: number) => (
              <p key={i} className="text-xs flex gap-2" style={{ color: 'rgb(var(--text))' }}>
                <span>→</span>
                <span>{te ? tip.te : tip.en}</span>
              </p>
            ))}
          </div>
        </div>
      )}
      {collapsed && (
        <div className="mx-4 mb-4">
          <button onClick={() => setCollapsed(false)} className="text-xs font-bold" style={{ color: 'rgb(var(--accent))' }}>
            💡 Show guide
          </button>
        </div>
      )}
      {children}
    </div>
  )
}
