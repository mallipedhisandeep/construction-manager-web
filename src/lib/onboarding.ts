import { supabase } from '@/lib/supabase'

export const ONBOARDING_STEPS = [
  { key: 'welcome', page: '/', label: 'Welcome' },
  { key: 'workers', page: '/workers', label: 'Add Workers' },
  { key: 'sites', page: '/sites', label: 'Create Sites' },
  { key: 'attendance', page: '/attendance', label: 'Attendance' },
  { key: 'complete', page: '/', label: 'All Done!' },
] as const

export async function getOnboardingStatus(userId: string) {
  const { data } = await supabase.from('user_onboarding').select('completed,step').eq('user_id', userId).maybeSingle()
  return { completed: data?.completed ?? false, step: data?.step ?? 0 }
}

export async function updateOnboardingStep(userId: string, step: number) {
  await supabase.from('user_onboarding').upsert({ user_id: userId, step, updated_at: new Date().toISOString() })
}

export async function completeOnboarding(userId: string) {
  await supabase.from('user_onboarding').upsert({ user_id: userId, completed: true, step: ONBOARDING_STEPS.length, updated_at: new Date().toISOString() })
}
