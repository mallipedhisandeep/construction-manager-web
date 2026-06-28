# Construction Manager

A mobile-first Progressive Web App (PWA) for managing construction site operations — built for contractors in Telangana & Andhra Pradesh.

Built by Sandeep
Live at: [your-app.vercel.app](https://construction-manager-web.vercel.app)

---

## What it does

Construction Manager helps contractors track everything on a construction site from their phone:

- **Daily Attendance** — Mark workers present by shift (6AM–6PM, 10AM–6PM, half-shifts, etc.), auto-calculate wages, record advances and payment mode
- **Workers** — Maintain a roster with roles (Mason/Helper), work types (Centring/Brickwork), state (Telangana/Andhra/Bihar), and per-shift wage rates
- **Sites** — Track multiple construction sites with budget, floor count, status (Active/Completed/On Hold), documents (blueprints, photos, agreements), and site-level payments
- **Contractors (Private Workers)** — Manage subcontractors separately from daily-wage workers
- **Contract Work** — Record contract jobs assigned to subcontractors with price charged, amount paid, and status
- **Suppliers** — Store supplier contacts and their goods catalogue with pricing
- **Goods Orders** — Place and track material orders (cement, sand, rods, etc.) linked to a site and supplier, with delivery status
- **Money Tracking** — Site-level financial ledger — money received from owner, money spent on site, real-time profit/loss
- **Reports** — Attendance summaries, wage reports, P&L, outstanding balances — shareable via WhatsApp, exportable as PDF
- **Trash (Recycle Bin)** — Soft-delete with restore support across all modules — nothing is ever lost instantly
- **First-Login Product Tour** — A one-time, auto-playing guided tour that walks new users through every module and every key action by actually opening real forms and spotlighting real buttons (see [Product Tour](#product-tour) below)
- **Push Notifications** — Admin gets alerted on new signups/subscriptions/support tickets; any user can opt in to get a phone alert 3 days before their trial or subscription expires
- **Admin Panel** — Hidden SaaS metrics dashboard (tap the logo 7× to access), protected server-side by the `ADMIN_EMAIL` env var

---

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Backend / Auth / DB | Supabase (PostgreSQL + Google OAuth + Row Level Security) |
| Payments | Razorpay Subscriptions (recurring billing, not one-time orders) |
| Push Notifications | Web Push (`web-push` npm package, VAPID keys) |
| Error Logging | Sentry (`@sentry/nextjs`) — optional, app works without it |
| Email | Resend — optional, app works without it |
| Deployment | Vercel (with Vercel Cron for daily reminder jobs) |
| PWA | Service Worker + Web Manifest |

---

## Features

- 🌐 **Bilingual** — Full Telugu (`తెలుగు`) and English UI, toggled in-app, including the product tour
- 🌙 **Dark / Light theme** — persisted per device
- 📱 **PWA** — installable on Android/iOS home screen, offline-aware (never serves stale data silently — falls back to a real offline page)
- 💳 **Subscription** — 30-day free trial → ₹240/month or ₹2600/year via Razorpay Subscriptions, auto-renewing, cancel anytime
- 🔒 **Server-side paywall enforcement** — gated by PostgreSQL RESTRICTIVE Row Level Security policies calling `has_active_access()`, not just a client-side check
- 🔒 **Per-user data isolation** — every table filtered by `user_id` via Supabase RLS
- 🗑️ **Soft deletes** — `deleted_at` column; Trash page for recovery, hard-delete only when explicitly confirmed
- 📤 **WhatsApp sharing** — attendance reports formatted for WhatsApp send
- 🔔 **Push notifications** — admin alerts + user-facing expiry reminders, both opt-in
- 🛡️ **Rate limiting** — sensitive routes (admin auth, webhooks, subscription creation) are protected against brute-force/spam
- 🎓 **Guided first-login tour** — see below

---

## Product Tour

New users get a one-time, automatically-playing guided tour on their first login. It is NOT a slideshow — it actually:

1. Shows a language picker first (English / తెలుగు) — the entire tour plays in whichever is chosen
2. Navigates through every real page (Home → Workers → Sites → Attendance → Suppliers → Goods Orders → Money → Contractors → Contract Work → Reports → Profile → Recycle Bin)
3. For "Add" actions, actually **opens the real Add form** (e.g. taps the real Add Worker button, waits for the real modal to render, then spotlights it) so the person sees the actual fields, not just a pointer at a button
4. For Edit/Delete/Pay actions — which only render for an existing item — the tour seeds exactly one clearly-labeled `"Demo ..."` row per module first (Demo Worker, Demo Site, Demo Supplier, Demo Contractor, etc.), uses those rows to demonstrate the real buttons, then deletes every one of those rows the moment the tour finishes or is skipped. The account is empty again afterward, exactly as before the tour ran.
5. Continuously re-measures each spotlighted element's on-screen position every animation frame, so scrolling never desyncs the highlight from the real button
6. Pauses its own countdown while the user is actively scrolling, so a stray scroll never eats into reading time
7. Can be skipped at any point, or advanced early with "Next ›"
8. Marks itself complete in `user_tour_status` once finished/skipped — it never auto-plays again for that user

**Deliberately NOT covered**, even though the buttons are real, because auto-playing through them risks real, unwanted side effects on a real account:
- Trash → "Empty All" (destructive, irreversible)
- Profile → theme toggle / language toggle (would actually flip the user's real settings)
- Profile → Cancel Subscription (doesn't exist yet for new trial users anyway)

The full script lives in `src/lib/tourSteps.ts` — add, reorder, or edit steps there. The engine itself is `src/components/TourOverlay.tsx`. Demo-data seeding/cleanup is `src/lib/tourDemoData.ts`.

To replay the tour for testing, delete your row from the `user_tour_status` table in Supabase and reload the app.

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

Fill in your values — see `env.example` for the full, documented list with setup instructions for each. At minimum, for local development you need:

```env
# Supabase — Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Admin panel — server-only, NEVER use the NEXT_PUBLIC_ prefix for this.
# Anything prefixed NEXT_PUBLIC_ is bundled into client-side JS and is not
# actually private — admin auth deliberately does not fall back to a
# public variant of this.
ADMIN_EMAIL=you@gmail.com

# Razorpay — dashboard.razorpay.com → Settings → API Keys
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# PWA cache busting (use git commit SHA in CI)
NEXT_PUBLIC_BUILD_ID=
```

Push notifications, Sentry, and Resend are all optional for local dev — see `env.example` for those.

**Never commit `.env.local`.** It's already in `.gitignore`. If it's ever accidentally committed, rotating the Supabase service role key and Razorpay key secret is mandatory — removing the file from a later commit does not undo a leak that already happened in git history.

### 3. Set up the Supabase database

Run every SQL file in your Supabase SQL Editor, in this order:

```
supabase_core_schema.sql                  ← workers, sites, attendance, RLS policies
supabase_new_tables.sql                   ← suppliers, goods_orders, site_payments
supabase_fix_uuid_extension.sql           ← enables uuid-ossp extension
supabase_monetization.sql                 ← subscriptions table
supabase_paywall_enforcement.sql          ← has_active_access() + RESTRICTIVE policies
supabase_security_fix.sql                 ← fixes EXECUTE grant on has_active_access (required — without this, every save fails with "permission denied for function has_active_access")
supabase_recurring_billing_and_push.sql   ← push_subscriptions table + recurring billing columns
supabase_webhook_idempotency.sql          ← webhook_events_seen table (required by every webhook route)
supabase_tour_tracking.sql                ← user_tour_status table (required by the product tour)
supabase_attendance_balance_trigger.sql   ← auto-calculates worker balances
supabase_admin_policy_patch.sql           ← admin-specific RLS adjustments
```

If any file mentions enabling Row Level Security and the Supabase dashboard shows a warning, choose **"Run and enable RLS"** — every table here is designed to have RLS on.

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

Same variables as `.env.local` above, but with your production Supabase and Razorpay keys/webhook secrets. See `env.example` for the complete list, including the optional push notification, Sentry, and Resend variables.

### 3. Fix Supabase OAuth redirects

In Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs** → Add:
  ```
  https://your-app.vercel.app/auth/callback
  ```

If you have a custom domain, add that too.

### 4. Configure the Razorpay webhook

Razorpay Dashboard → Settings → Webhooks → Add New Webhook:
- URL: `https://your-app.vercel.app/api/razorpay/webhook`
- Secret: must match `RAZORPAY_WEBHOOK_SECRET`
- Events: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.completed`, `subscription.halted`

Without this webhook configured, subscriptions will never actually activate or renew in the database — Razorpay collecting a payment and the app knowing about it are two separate steps connected only by this webhook.

### 5. Configure Supabase DB Webhooks (for push notifications)

Supabase Dashboard → Database → Webhooks → create two:
1. Table `users` (schema `auth`), Event: Insert → `https://your-app.vercel.app/api/webhooks/new-user`, header `x-webhook-secret: <WEBHOOK_SECRET>`
2. Table `support_tickets` (schema `public`), Event: Insert → `https://your-app.vercel.app/api/webhooks/new-ticket`, same header

### 6. Deploy

Vercel auto-deploys on every push to `main`. The daily expiry-reminder cron job (`/api/cron/subscription-reminders`) runs automatically via `vercel.json` — no manual setup needed beyond setting `CRON_SECRET`.

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                   # Dashboard (home screen)
│   ├── attendance/                # Daily attendance marking
│   ├── workers/                   # Worker roster
│   ├── sites/                     # Site management
│   ├── private-workers/           # Contractors
│   ├── private-work/              # Contract jobs
│   ├── suppliers/                 # Supplier directory
│   ├── goods/                     # Goods orders
│   ├── money/                     # Site financial ledger
│   ├── reports/                   # Reports & WhatsApp share & PDF export
│   ├── subscribe/                 # Subscription / Razorpay checkout
│   ├── profile/                   # User profile, reminders, cancel subscription
│   ├── trash/                     # Soft-deleted records (Recycle Bin)
│   ├── admin/                     # Hidden admin metrics panel
│   ├── not-found.tsx              # Custom 404 page
│   ├── robots.ts                  # robots.txt (App Router convention)
│   ├── sitemap.ts                 # sitemap.xml (App Router convention)
│   ├── icon.png                   # Favicon (App Router convention)
│   └── api/
│       ├── razorpay/              # create-subscription, cancel-subscription, webhook
│       ├── push/                  # subscribe, vapid-key
│       ├── webhooks/              # new-user, new-ticket (Supabase DB Webhooks)
│       ├── cron/                  # subscription-reminders (daily expiry reminders)
│       └── admin/                 # admin-only data routes
├── components/
│   ├── AppShell.tsx                # Auth guard, client-side paywall, theme/lang context, mounts the tour
│   ├── Nav.tsx                     # Bottom navigation bar
│   └── TourOverlay.tsx             # The first-login product tour engine
└── lib/
    ├── types.ts                    # All TypeScript interfaces
    ├── constants.ts                # Dropdowns (shifts, roles, units, etc.)
    ├── supabase.ts                 # Client-side Supabase client
    ├── supabaseAdmin.ts             # Server-side admin client + auth helpers
    ├── auth.ts                     # Auth helpers
    ├── strings.ts                  # i18n strings (EN/TE)
    ├── pricing.ts                  # SINGLE SOURCE OF TRUTH for ₹240/₹2600 pricing — never hardcode prices elsewhere
    ├── rateLimit.ts                 # In-memory rate limiter for sensitive routes
    ├── logger.ts                    # Sentry-backed error logging (safe no-op if unconfigured)
    ├── email.ts                     # Resend-backed email sending (safe no-op if unconfigured)
    ├── push.ts                      # Web Push notification sending
    ├── tourSteps.ts                  # The product tour script — add/edit steps here
    └── tourDemoData.ts               # Seeds and cleans up "Demo ..." rows for the tour
```

---

## Subscription & Paywall

- New users get a **30-day free trial** (set in `subscriptions` table via `trial_ends_at`)
- After trial (or after a cancelled/expired subscription's period ends), a paywall screen blocks all app modules except `/profile` and `/subscribe`
- **Enforcement is server-side**, not just a UI check: every paywalled table has a RESTRICTIVE Row Level Security policy that calls `public.has_active_access(auth.uid())` — a user cannot bypass this from the browser, since Postgres itself rejects the write
- Payment is handled by **Razorpay Subscriptions** — ₹240/month or ₹2600/year, auto-renewing
- Pricing lives in exactly one file: `src/lib/pricing.ts` — change it there, nowhere else
- The `/admin` page (accessed by tapping the logo 7×) shows live SaaS metrics: total users, DAU/WAU/MAU, trial vs paid breakdown, cycle-aware MRR/ARR estimate

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

## Security notes

- `has_active_access()` is `SECURITY DEFINER` deliberately — it's called from inside RLS policies and needs to read `subscriptions` regardless of the calling user's own RLS on that table. Do not change this to `SECURITY INVOKER`; doing so breaks the paywall entirely. See the comment block at the top of `supabase_security_fix.sql` for the full explanation.
- Admin auth (`ADMIN_EMAIL`) deliberately never falls back to a `NEXT_PUBLIC_*` variant — anything with that prefix is bundled into client-side JavaScript and is not private.
- The Razorpay webhook verifies its signature using `crypto.timingSafeEqual`, not a plain `!==` comparison, to avoid leaking timing information about partial matches.
- Rate limiting (`src/lib/rateLimit.ts`) is in-memory per server instance — a pragmatic stopgap against trivial abuse, not a distributed rate limiter. For high-traffic production use, consider Upstash Redis or Vercel's edge rate limiting instead.

---

## License

Private / proprietary. All rights reserved.
