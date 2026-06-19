// ─── Single source of truth for all dropdown/filter values ───────────────────
// Previously these were copy-pasted across workers, attendance, goods, reports etc.
// Now change here once → updates everywhere.

export const WORK_TYPES  = ['Centring', 'Brickwork'] as const
export const STATES      = ['Telangana', 'Andhra', 'Bihar'] as const
export const ROLES       = ['Mason', 'Helper'] as const
export const SHIFTS      = ['6-6', '10-6', '6-10', '6-2', '10-2', '2-6', 'Absent'] as const
export const SHIFT_LABELS: Record<string, string> = {
  '6-6':  '6AM – 6PM',
  '10-6': '10AM – 6PM',
  '6-10': '6AM – 10AM',
  '6-2':  '6AM – 2PM',
  '10-2': '10AM – 2PM',
  '2-6':  '2PM – 6PM',
  'Absent': 'Absent',
}
export const PAYMENT_MODES  = ['Cash', 'Online', 'Cheque', 'None'] as const
export const GENDERS         = ['Male', 'Female'] as const
export const SITE_STATUSES   = ['Active', 'Completed', 'On Hold'] as const
export const GOODS_UNITS     = ['bags','tons','pieces','sq.ft','cu.ft','liters','kg','loads','rods','tiles','Nos'] as const
export const GOODS_STATUSES  = ['Pending', 'Delivered', 'Cancelled'] as const

export type WorkType   = typeof WORK_TYPES[number]
export type State      = typeof STATES[number]
export type Role       = typeof ROLES[number]
export type Shift      = typeof SHIFTS[number]
export type PayMode    = typeof PAYMENT_MODES[number]
export type Gender     = typeof GENDERS[number]
export type SiteStatus = typeof SITE_STATUSES[number]
export type GoodsUnit  = typeof GOODS_UNITS[number]
