export interface Worker {
  id?: string; name: string; phone: string; gender: string
  state: string; role: string; work_type: string
  rate_6_6: number; rate_10_6: number; rate_6_10: number
  rate_6_2: number; rate_10_2: number; rate_2_6: number
  notes?: string
  
  worker_status?: 'Active' | 'Inactive'
}
export interface Attendance {
  id?: string; worker_id: string; site_id?: string; date: string
  date_key: string; attendance_type: string; wage: number
  advance: number; payment_mode: string; balance_after: number
}
export interface Site {
  id?: string; site_name: string
  // site_name_search is a DB-generated column (lower(site_name)) — it is
  // populated automatically by Postgres and must NEVER be sent in an
  // insert/update payload, so it is intentionally not a writable field here.
  location?: string; owner_name?: string; owner_phone?: string
  start_date?: string; budget: number; floors_count: number
  status: string; notes?: string
}
export interface SitePayment {
  id?: string; site_id: string; amount: number
  direction: 'received' | 'spent'; description: string
  mode: string; payment_date: string; created_at?: string
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
export interface Supplier {
  id?: string; name: string; phone: string; shop_name: string
  notes?: string; created_at?: string
}
export interface SupplierGoods {
  id?: string; supplier_id: string; goods_name: string
  price_per_unit: number; unit: string
}
export interface SupplierPayment {
  id?: string; supplier_id: string; amount: number
  payment_type: 'advance' | 'payment'; mode: string
  payment_date: string; goods_order_id?: string; notes?: string
}
export interface GoodsOrder {
  id?: string; supplier_id: string; supplier_name: string
  goods_name: string; unit: string
  site_id?: string; site_name?: string; delivery_date: string
  quantity: number; price_per_unit: number; total_price: number
  advance_paid: number; status: string; notes?: string; created_at?: string
}
