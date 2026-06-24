'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const GUIDE_CONTENT = {
  en: {
    title: 'Construction Manager — Complete Guide',
    intro: 'Learn how to use every feature in 5 minutes',
    sections: [
      {
        icon: '👷',
        title: 'Workers Module',
        steps: [
          'Add each worker with name, phone, and wage rates for different shift types',
          'Mark daily attendance for workers (present/absent)',
          'Track all payments and wage history for each worker',
          'Share attendance summaries via WhatsApp instantly',
        ],
      },
      {
        icon: '🏗️',
        title: 'Sites Module',
        steps: [
          'Create a site for each construction project',
          'Assign workers to specific sites',
          'Upload documents (photos, blueprints, contracts)',
          'Track site expenses and payments separately',
        ],
      },
      {
        icon: '📋',
        title: 'Attendance Module',
        steps: [
          'Mark attendance for any date (past or present)',
          'See attendance patterns and history over time',
          'Generate reports by worker or by site',
          'Share daily attendance with workers via WhatsApp',
        ],
      },
      {
        icon: '💰',
        title: 'Money Tracking',
        steps: [
          'Record all money IN from clients and projects',
          'Track all money OUT (wages, materials, travel, rent)',
          'See profit/loss summary at the bottom',
          'Filter by this month or all time',
        ],
      },
      {
        icon: '🔔',
        title: 'Enable Notifications',
        steps: [
          'Go to Profile → Tap "Turn on" under Reminders',
          'You\'ll get alerts when your subscription expires in 3 days',
          'Notifications work even when the app is closed',
          'Tap the alert to renew your subscription instantly',
        ],
      },
      {
        icon: '⭐',
        title: 'Go Pro with Subscription',
        steps: [
          'Free trial gives you 7-30 days to try everything',
          'Subscribe for ₹240/month or ₹2500/year after trial ends',
          'Pro keeps all your data safe and lets you add unlimited workers',
          'Cancel anytime — access continues until your period ends',
        ],
      },
    ],
  },
  te: {
    title: 'నిర్మాణ నిర్వాహకుడు — సంపూర్ణ గైడ్',
    intro: '5 నిమిషాల్లో ప్రతిটి ఫీచర్‌ను ఎలా ఉపయోగించాలో తెలుసుకోండి',
    sections: [
      {
        icon: '👷',
        title: 'కార్మికుల మాడ్యూల్',
        steps: [
          'ప్రతిটి కార్మికుడిని పేరు, ఫోన్ మరియు పేరు రేట్‌లతో జోడించండి',
          'కార్మికుల దైనిక హాజరును గుర్తించండి (ఉంది/లేనిది)',
          'ప్రతిটి కార్మికి కోసం అన్ని చెల్లింపులు మరియు వేతన చరిత్రను ట్రాక్ చేయండి',
          'హాజరు సారాంశాలను WhatsApp ద్వారా తక్షణమే పంపండి',
        ],
      },
      {
        icon: '🏗️',
        title: 'సైట్‌ల మాడ్యూల్',
        steps: [
          'ప్రతిটి నిర్మాణ ప్రాజెక్ట్‌కు సైట్‌ను సృష్టించండి',
          'నిర్దిష్ట సైట్‌లకు కార్మికులను నియమించండి',
          'డాక్యుమెంట్‌లను అప్‌లోడ్ చేయండి (ఫోటోలు, నీలప్రింట్‌లు, ఒప్పందాలు)',
          'సైట్ ఖర్చులు మరియు చెల్లింపులను విడిగా ట్రాక్ చేయండి',
        ],
      },
      {
        icon: '📋',
        title: 'హాజరు మాడ్యూల్',
        steps: [
          'ఏదైనా తేదీకి హాజరును గుర్తించండి (గత లేదా ప్రస్తుతం)',
          'కాలక్రమేణా హాజరు నమూనాలు మరియు చరిత్రను చూడండి',
          'కార్మికుడు లేదా సైట్‌ ద్వారా నివేదికలను సృష్టించండి',
          'కార్మికులకు WhatsApp ద్వారా దైనిక హాజరు పంపండి',
        ],
      },
      {
        icon: '💰',
        title: 'డబ్బు ట్రాకింగ్',
        steps: [
          'ఖాతాదారుల నుండి మరియు ప్రాజెక్టుల నుండి అన్ని డబ్బు రికార్డ్ చేయండి',
          'అన్ని డబ్బు OUT ట్రాక్ చేయండి (వేతనాలు, పదార్థాలు, ఖర్చులు)',
          'దిగువ భాగంలో లాభ/నష్ట సారాంశం చూడండి',
          'ఈ నెల లేదా అన్ని సమయాల ద్వారా ఫిల్టర్ చేయండి',
        ],
      },
      {
        icon: '🔔',
        title: 'నోటిఫికేషన్‌లను ఆన్ చేయండి',
        steps: [
          'ప్రొఫైల్ → రిమైండర్‌ల క్రింద "ఆన్ చేయండి"ని నొక్కండి',
          'మీ సభ్యత్వం 3 రోజుల్లో ఆపేసినప్పుడు మీరు సতর్కతలను పొందుతారు',
          'యాప్ మూసివున్నప్పటికీ నోటిఫికేషన్‌లు పనిచేస్తాయి',
          'మీ సభ్యత్వాన్ని తక్షణమే పునరుద్ధరించడానికి అలర్ట్‌ని నొక్కండి',
        ],
      },
      {
        icon: '⭐',
        title: 'సభ్యత్వంతో ప్రో వెళ్లండి',
        steps: [
          'ఉచిత ట్రయల్ 7-30 రోజుల వరకు ప్రతిదీ ప్రయత్నించడానికి ఇస్తుంది',
          'ట్రయల్ ముగిసిన తర్వాత సభ్యత్వం పొందండి ₹240/నెల లేదా ₹2500/సంవత్సరం',
          'ప్రో మీ ఉపసంహరణను సురక్షితంగా ఉంచుతుంది మరియు అపరిమిత కార్మికులను జోడించడానికి అనుమతిస్తుంది',
          'ఎప్పుడైనా రద్దు చేయండి — ఆ వ్యవధి ముగిసే వరకు ఆ నిర్ణయ క్రమం కొనసాగుతుంది',
        ],
      },
    ],
  },
}

interface FullAppGuideProps {
  onComplete: () => void
}

export function FullAppGuide({ onComplete }: FullAppGuideProps) {
  const [lang, setLang] = useState<'en' | 'te' | null>(null)
  const [section, setSection] = useState(0)
  const [showAgainQuestion, setShowAgainQuestion] = useState(false)

  const content = lang ? GUIDE_CONTENT[lang] : null
  const sections = content?.sections || []
  const isLast = section === sections.length - 1

  const handleNext = async () => {
    if (isLast) {
      setShowAgainQuestion(true)
    } else {
      setSection(section + 1)
    }
  }

  const handleShowAgainChoice = async (showAgain: boolean) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user && lang) {
      await supabase.from('user_guide_status').upsert({
        user_id: user.id,
        guide_lang: lang,
        show_again: showAgain,
        seen_at: new Date().toISOString(),
      })
    }
    onComplete()
  }

  if (!lang) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #d48c28, #b8860b)' }}>
        <div className="text-center">
          <div className="text-6xl mb-4">🏗️</div>
          <h1 className="text-3xl font-black mb-2 text-white">Construction Manager</h1>
          <p className="text-white text-sm mb-8 opacity-90">Choose your language to get started</p>

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => setLang('en')}
              className="px-8 py-4 rounded-xl font-bold text-white text-lg"
              style={{ background: 'rgba(255,255,255,0.25)' }}>
              🇬🇧 English
            </button>
            <button
              onClick={() => setLang('te')}
              className="px-8 py-4 rounded-xl font-bold text-white text-lg"
              style={{ background: 'rgba(255,255,255,0.25)' }}>
              🇮🇳 తెలుగు
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (showAgainQuestion) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.7)' }}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-sm text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-black mb-2">You're All Set!</h2>
          <p className="text-sm mb-6 opacity-70">You can access this guide anytime from the profile page.</p>

          <div className="flex gap-3">
            <button
              onClick={() => handleShowAgainChoice(false)}
              className="flex-1 py-3 rounded-xl font-bold text-sm"
              style={{ background: 'rgba(0,0,0,0.1)' }}>
              Don't show again
            </button>
            <button
              onClick={() => handleShowAgainChoice(true)}
              className="flex-1 py-3 rounded-xl font-bold text-sm text-white"
              style={{ background: 'rgb(var(--accent))' }}>
              Save to read again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const currentSection = sections[section]
  if (!currentSection) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: 'rgb(var(--bg))' }}>
      <div className="min-h-screen flex flex-col p-6 pb-24">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <h1 className="text-3xl font-black mb-2">{content.title}</h1>
          <p className="text-sm opacity-70">{content.intro}</p>
          <div className="flex justify-center gap-1 mt-4">
            {sections.map((_, i) => (
              <div
                key={i}
                className="h-1.5 w-2.5 rounded-full transition-all"
                style={{
                  background: i <= section ? 'rgb(var(--accent))' : 'rgba(0,0,0,0.1)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Current Section */}
        <div className="mb-8 flex-1">
          <div className="text-5xl mb-4 text-center">{currentSection.icon}</div>
          <h2 className="text-2xl font-black mb-6 text-center">{currentSection.title}</h2>

          <div className="space-y-3">
            {currentSection.steps.map((step, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white"
                  style={{ background: 'rgb(var(--accent))' }}>
                  {i + 1}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'rgb(var(--text))' }}>
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {section > 0 && (
            <button
              onClick={() => setSection(section - 1)}
              className="flex-1 py-3 rounded-xl font-bold"
              style={{ background: 'rgba(0,0,0,0.1)' }}>
              ← Back
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 py-3 rounded-xl font-bold text-white"
            style={{ background: 'rgb(var(--accent))' }}>
            {isLast ? 'Finish →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
