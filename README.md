# Construction Manager

A mobile-first Progressive Web App (PWA) for managing construction site operations — built for contractors in Telangana & Andhra Pradesh.
Built by Sandeep 
Live at: [your-app.vercel.app](https://construction-manager-web.vercel.app)

---

## What it does

Construction Manager helps contractors track everything on a construction site from their phone:

- **Daily Attendance** — Mark workers present by shift (6AM–6PM, 10AM–6PM, half-shifts, etc.), auto-calculate wages, record advances and payment mode
- **Workers** — Maintain a roster with roles (Mason/Helper), work types (Centring/Brickwork), state (Telangana/Andhra/Bihar), and per-shift wage rates
- **Sites** — Track multiple construction sites with budget, floor count, status (Active/Completed/On Hold), and site-level payments
- **Contractors (Private Workers)** — Manage subcontractors separately from daily-wage workers
- **Contract Work** — Record contract jobs assigned to subcontractors with price charged, amount paid and status
- **Suppliers** — Store supplier contacts and their goods catalogue with pricing
- **Goods Orders** — Place and track material orders (cement, sand, rods, etc.) linked to a site and supplier, with delivery status
- **Money Tracking** — Site-level financial ledger — money received from owner, money spent on site
- **Reports** — Attendance summaries, wage reports, P&L — shareable via WhatsApp
- **Trash** — Soft-delete with restore support across all modules
- **Admin Panel** — Hidden SaaS metrics dashboard (tap the logo 7× to access), protected by `NEXT_PUBLIC_ADMIN_EMAIL`

---

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Backend / Auth / DB | Supabase (PostgreSQL + Google OAuth) |
| Payments | Razorpay (₹200/month subscription) |
| Deployment | Vercel |
| PWA | Service Worker + Web Manifest |

---

## Features

- 🌐 **Bilingual** — Full Telugu (`తెలుగు`) and English UI, toggled in-app
- 🌙 **Dark / Light theme** — persisted per device
- 📱 **PWA** — installable on Android/iOS home screen, works offline for cached pages
- 💳 **Subscription** — 30-day free trial → ₹200/month via Razorpay; paywall enforced client-side
- 🔒 **Per-user data isolation** — all tables filtered by `user_id` (Supabase RLS)
- 🗑️ **Soft deletes** — `deleted_at` column; Trash page for recovery
- 📤 **WhatsApp sharing** — attendance reports formatted for WhatsApp send

---

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/construction-manager-web.git
cd construction-manager-web
npm install
```

### 2. Create `.env.local`

```bash
cp env.example .env.local
```

Fill in your values:

```env
# Supabase — Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Admin panel — the Google email allowed to access /admin
NEXT_PUBLIC_ADMIN_EMAIL=you@gmail.com

# Razorpay — dashboard.razorpay.com → Settings → API Keys
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret

# Supabase service role (server-side only — never expose publicly)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# PWA cache busting (use git commit SHA in CI)
NEXT_PUBLIC_BUILD_ID=
```

### 3. Set up Supabase database

Run the SQL files in your Supabase SQL editor in this order:

```
supabase_new_tables.sql     ← core tables
supabase_monetization.sql   ← subscriptions table
```

### 4. Enable Google OAuth in Supabase

1. Supabase Dashboard → Authentication → Providers → Google → Enable
2. Add your Google OAuth client ID and secret
3. Set **Site URL**: `http://localhost:3000`
4. Add **Redirect URL**: `http://localhost:3000/auth/callback`

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploying to Vercel

### 1. Push to GitHub and import on Vercel

### 2. Add all environment variables in Vercel → Settings → Environment Variables

Same variables as `.env.local` above, but with your production Supabase and Razorpay keys.

### 3. Fix Supabase OAuth redirects

In Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs** → Add:
  ```
  https://your-app.vercel.app/auth/callback
  ```

If you have a custom domain, add that too.

### 4. Deploy

Vercel auto-deploys on every push to `main`.

---

## Project structure

```
src/
├── app/
│   ├── page.tsx              # Dashboard (home screen)
│   ├── attendance/           # Daily attendance marking
│   ├── workers/              # Worker roster
│   ├── sites/                # Site management
│   ├── private-workers/      # Contractors
│   ├── private-work/         # Contract jobs
│   ├── suppliers/            # Supplier directory
│   ├── goods/                # Goods orders
│   ├── money/                # Site financial ledger
│   ├── reports/              # Reports & WhatsApp share
│   ├── subscribe/            # Subscription / Razorpay
│   ├── profile/              # User profile
│   ├── trash/                # Soft-deleted records
│   ├── admin/                # Hidden admin metrics panel
│   └── api/razorpay/         # Payment API routes
├── components/
│   ├── AppShell.tsx          # Auth guard, paywall, theme/lang context
│   └── Nav.tsx               # Bottom navigation bar
└── lib/
    ├── types.ts              # All TypeScript interfaces
    ├── constants.ts          # Dropdowns (shifts, roles, units, etc.)
    ├── supabase.ts           # Supabase client
    ├── auth.ts               # Auth helpers
    └── strings.ts            # i18n strings (EN/TE)
```

---

## Subscription & Paywall

- New users get a **30-day free trial** (set in `subscriptions` table via `trial_ends_at`)
- After trial, a paywall screen blocks all app modules except `/profile` and `/subscribe`
- Payment is handled by **Razorpay** at ₹200/month
- The `/admin` page (accessed by tapping the logo 7×) shows live SaaS metrics: total users, DAU/WAU/MAU, trial vs paid breakdown

---

## Shift types

| Code | Hours |
|---|---|
| 6-6 | 6 AM – 6 PM (full day) |
| 10-6 | 10 AM – 6 PM |
| 6-10 | 6 AM – 9 AM (morning half) |
| 6-2 | 6 AM – 2 PM |
| 10-2 | 10 AM – 2 PM |
| 2-6 | 3 PM – 6 PM |
| Absent | No work |

Each worker stores a separate wage rate for every shift type.

---

## License

Private / proprietary. All rights reserved.
