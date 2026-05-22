export interface Worker {
  id?: string; name: string; phone: string; gender: string
  state: string; role: string; work_type: string
  rate_6_6: number; rate_10_6: number; rate_6_10: number
  rate_6_2: number; rate_10_2: number; rate_2_6: number; notes?: string
}
export interface Attendance {
  id?: string; worker_id: string; site_id?: string; date: string
  date_key: string; attendance_type: string; wage: number
  advance: number; payment_mode: string; balance_after: number
}
export interface Site {
  id?: string; site_name: string; site_name_search: string
  location?: string; owner_name?: string; owner_phone?: string
  start_date?: string; budget: number; floors_count: number
  status: string; notes?: string
}
export interface PrivateWorker {
  id?: string; name: string; work_type: string; phone: string; notes?: string
}
export interface PrivateWork {
  id?: string; worker_id: string; worker_name: string; work_type: string
  site_id: string; site_name: string; work_date: string
  price_charged: number; amount_paid: number; status: string; notes?: string
}
export interface PrivateWorkerPayment {
  id?: string; worker_id: string; amount: number; direction: string
  mode: string; date: string; notes?: string; source: string
}
