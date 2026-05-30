# 🏗️ Construction Manager

A mobile-first Progressive Web App (PWA) for managing construction sites, workers, attendance, suppliers, and finances. Built with Next.js 15, React 19, Supabase, and Tailwind CSS. Supports Telugu and English.

---

## Features

- **Daily Attendance** — Mark shifts per worker per day, track advance payments, view monthly summaries with running balance
- **Workers** — Register workers with shift-based wage rates, filter by type/state/role
- **Sites** — Manage construction sites, upload documents, track payments received from owners
- **Private Workers** — Contract workers with job billing and payment ledger
- **Suppliers & Goods** — Supplier catalog + goods purchase orders
- **Money Tracking** — Consolidated cash flow across all modules
- **Reports** — P&L overview, per-site and per-worker breakdowns, PDF export
- **Bilingual** — Full Telugu / English toggle

---

## Tech Stack

| Layer     | Technology                    |
|-----------|-------------------------------|
| Framework | Next.js 15 (App Router)       |
| UI        | React 19 + Tailwind CSS 3     |
| Database  | Supabase (PostgreSQL)         |
| Auth      | Supabase Auth                 |
| Hosting   | Vercel                        |
| PWA       | Service Worker + Web Manifest |

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/mallipedhisandeep/construction-manager-web.git
cd construction-manager-web
npm install
```

### 2. Set up environment variables

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

You can find these in your Supabase project under **Settings → API**.

### 3. Set up the database

Run the SQL files in your Supabase SQL editor **in this order**:

1. `supabase_new_tables.sql` — creates all main tables
2. `supabase_recycle_bin.sql` — adds soft-delete / recycle bin support

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

| Variable                        | Description                        |
|---------------------------------|------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase project URL          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous/public key |

> ⚠️ Never commit `.env.local` to git. It is already in `.gitignore`.

---

## Deploying to Vercel

1. Push your code to GitHub
2. Import the repo in [vercel.com](https://vercel.com)
3. Add the two environment variables above in Vercel's project settings
4. Deploy — Vercel auto-detects Next.js

---

## PWA — Add to Home Screen

On Android (Chrome):
1. Open the app in Chrome
2. Tap the three-dot menu → "Add to Home Screen"
3. The app will open in standalone mode (no browser bar)

On iOS (Safari):
1. Open the app in Safari
2. Tap the Share button → "Add to Home Screen"

---

## Project Structure

```
src/
├── app/                  # Next.js App Router pages
│   ├── attendance/       # Daily attendance marking
│   ├── workers/          # Worker management
│   ├── sites/            # Site management
│   ├── private-workers/  # Private/contract workers
│   ├── private-work/     # Contract job entries
│   ├── suppliers/        # Supplier catalog
│   ├── goods/            # Goods orders
│   ├── money/            # Cash flow overview
│   ├── reports/          # P&L reports + PDF export
│   ├── trash/            # Recycle bin
│   ├── login/            # Login page
│   └── signup/           # Signup page
├── components/
│   ├── AppShell.tsx      # Auth wrapper + nav + theme/lang context
│   └── Nav.tsx           # Bottom navigation bar
└── lib/
    ├── supabase.ts       # Supabase client
    ├── types.ts          # TypeScript interfaces
    ├── constants.ts      # Shared dropdown values (shifts, states, roles etc.)
    └── strings.ts        # English / Telugu translations
public/
├── sw.js                 # Service Worker (PWA offline support)
├── manifest.json         # PWA manifest
├── icon-192.png          # PWA icon (required)
└── icon-512.png          # PWA icon (required)
```

---

## Contributing

This is a personal project. If you'd like to suggest changes, open an issue.

---

## License

Private — all rights reserved.
