// src/lib/pricing.ts
//
// SINGLE SOURCE OF TRUTH for subscription pricing. Every place in the app
// that displays or calculates a price must import from here — never hardcode
// ₹240, ₹2600, etc. directly. This file existing is what prevents the "five
// different stale prices in five different files" problem.
//
// If you ever change pricing, this is the only file that needs to change
// (plus the actual Razorpay Plan objects in the Razorpay dashboard, which
// these IDs point to).

export const PRICING = {
  monthly: {
    amountRupees: 240,
    planId: 'plan_T51AEj1AjNUiRd',
    label_en: '₹240/month',
    label_te: '₹240/నెల',
  },
  yearly: {
    amountRupees: 2600,
    planId: 'plan_T51Bjgb2DUSNCB',
    label_en: '₹2600/year',
    label_te: '₹2600/సంవత్సరం',
  },
} as const

export type BillingCycle = keyof typeof PRICING

// Effective monthly-equivalent for the yearly plan, used in MRR/ARPU math so
// a mix of monthly and yearly subscribers produces a sane revenue estimate
// instead of treating every "pro" user as if they pay the monthly price.
export const YEARLY_MONTHLY_EQUIVALENT = Math.round(PRICING.yearly.amountRupees / 12)

export function monthlyEquivalent(cycle: BillingCycle | null | undefined): number {
  if (cycle === 'yearly') return YEARLY_MONTHLY_EQUIVALENT
  return PRICING.monthly.amountRupees
}

export const TRIAL_DAYS = 30
