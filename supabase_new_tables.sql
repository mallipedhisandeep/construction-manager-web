-- ============================================================
-- NEW TABLES for Suppliers, Goods, Site Payments, Reports
-- Run in Supabase → SQL Editor
-- ============================================================

-- Site Payments (owner pays us / us paying at site level)
CREATE TABLE IF NOT EXISTS site_payments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id       UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  direction     TEXT NOT NULL DEFAULT 'received',  -- 'received' (from owner) | 'spent' (we paid)
  description   TEXT NOT NULL DEFAULT '',
  mode          TEXT NOT NULL DEFAULT 'Cash',
  payment_date  TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON public.site_payments TO authenticated;
ALTER TABLE site_payments DISABLE ROW LEVEL SECURITY;

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL DEFAULT '',
  shop_name   TEXT DEFAULT '',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON public.suppliers TO authenticated;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;

-- Supplier Goods Catalog (what each supplier sells + price)
CREATE TABLE IF NOT EXISTS supplier_goods (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  goods_name      TEXT NOT NULL,
  price_per_unit  NUMERIC(10,2) DEFAULT 0,
  unit            TEXT NOT NULL DEFAULT 'bags',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON public.supplier_goods TO authenticated;
ALTER TABLE supplier_goods DISABLE ROW LEVEL SECURITY;

-- Supplier Payments (advances + regular payments)
CREATE TABLE IF NOT EXISTS supplier_payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id      UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  amount           NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_type     TEXT NOT NULL DEFAULT 'payment',  -- 'advance' | 'payment'
  mode             TEXT NOT NULL DEFAULT 'Cash',
  payment_date     TEXT NOT NULL,
  goods_order_id   UUID,  -- linked order if from goods
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON public.supplier_payments TO authenticated;
ALTER TABLE supplier_payments DISABLE ROW LEVEL SECURITY;

-- Goods Orders / Purchases
CREATE TABLE IF NOT EXISTS goods_orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_name   TEXT NOT NULL DEFAULT '',
  goods_name      TEXT NOT NULL DEFAULT '',
  unit            TEXT NOT NULL DEFAULT 'bags',
  site_id         UUID REFERENCES sites(id) ON DELETE SET NULL,
  site_name       TEXT DEFAULT '',
  delivery_date   TEXT NOT NULL,
  quantity        NUMERIC(10,2) DEFAULT 0,
  price_per_unit  NUMERIC(10,2) DEFAULT 0,
  total_price     NUMERIC(12,2) DEFAULT 0,
  advance_paid    NUMERIC(10,2) DEFAULT 0,
  status          TEXT DEFAULT 'Pending',  -- Pending | Delivered | Cancelled
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON public.goods_orders TO authenticated;
ALTER TABLE goods_orders DISABLE ROW LEVEL SECURITY;

-- Sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
