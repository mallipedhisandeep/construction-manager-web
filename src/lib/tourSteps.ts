// src/lib/tourSteps.ts
//
// The script for the one-time first-login product tour. Each step names a
// REAL route and a REAL data-testid already present on that page — the
// tour navigates to the route, optionally clicks a "preClickSelector"
// element first (e.g. opening a demo row's detail view), waits for the
// real spotlight target to exist, then spotlights it. This file is the
// single place to add/reorder/edit tour steps; TourOverlay.tsx just plays
// whatever sequence is defined here.
//
// COVERAGE: every module — Home, Workers, Sites, Attendance, Suppliers,
// Goods Orders, Money, Contractors, Contract Work, Reports, Profile,
// Recycle Bin — and every meaningfully different action within each
// (Add, Edit, Delete, Pay, Filter, Restore, Export, etc), using one
// seeded "Demo ..." row per module so Edit/Delete/Pay steps have
// something real to act on even on a brand-new account.
//
// DELIBERATELY NOT included, even though the buttons are real:
// - Trash → "Empty All" (destructive, irreversible, too risky to spotlight
//   on an auto-advancing timer where a person might tap it by reflex)
// - Profile → theme toggle / language toggle (auto-playing through these
//   would actually flip the user's real display settings mid-tour)
// - Profile → Cancel Subscription (doesn't exist for new trial users,
//   the exact audience this tour is for)
// - Every filter chip / tab on every page (covered by ONE representative
//   example per page, per the agreed ~40-50 step scope — not literally
//   every repeated chip)

export interface TourStep {
  route: string
  selector: string          // CSS selector, normally `[data-testid="..."]`, of the element to spotlight
  preClickSelector?: string // if set, this element is clicked first (e.g. open a demo row's detail view), THEN selector is waited for and spotlighted
  preClickWaitMs?: number   // how long to wait after the pre-click before polling for `selector` (default 400ms — covers a typical detail-view render)
  title_en: string
  title_te: string
  body_en: string
  body_te: string
  durationMs: number        // how long this step stays on screen before auto-advancing
  placement?: 'top' | 'bottom' // which side of the highlighted element the caption sits on
}

export const TOUR_STEPS: TourStep[] = [
  // ── HOME ──────────────────────────────────────────────────────────────
  {
    route: '/',
    selector: '[data-testid="module-card-workers"]',
    title_en: 'Workers',
    title_te: 'కార్మికులు',
    body_en: 'Add your workers here — track attendance, wages, and payments for each one.',
    body_te: 'మీ కార్మికులను ఇక్కడ జోడించండి — ప్రతి ఒక్కరి హాజరు, వేతనాలు, చెల్లింపులను ట్రాక్ చేయండి.',
    durationMs: 4000,
    placement: 'bottom',
  },
  {
    route: '/',
    selector: '[data-testid="module-card-sites"]',
    title_en: 'Sites',
    title_te: 'సైట్లు',
    body_en: 'Each construction project gets its own Site — track its budget, documents, and payments separately.',
    body_te: 'ప్రతి నిర్మాణ ప్రాజెక్ట్‌కు దాని స్వంత సైట్ ఉంటుంది.',
    durationMs: 4000,
    placement: 'bottom',
  },
  {
    route: '/',
    selector: '[data-testid="module-card-suppliers"]',
    title_en: 'Suppliers',
    title_te: 'సరఫరాదారులు',
    body_en: 'Track materials suppliers — what you\'ve ordered and what you owe them.',
    body_te: 'వస్తువుల సరఫరాదారులను ట్రాక్ చేయండి — మీరు ఆర్డర్ చేసినది మరియు బకాయి.',
    durationMs: 4000,
    placement: 'bottom',
  },
  {
    route: '/',
    selector: '[data-testid="module-card-money"]',
    title_en: 'Money Tracking',
    title_te: 'డబ్బు ట్రాకింగ్',
    body_en: 'See exactly how much you\'ve earned versus spent — your real profit or loss, always up to date.',
    body_te: 'మీరు సంపాదించినది వర్సెస్ ఖర్చు చేసినది ఖచ్చితంగా చూడండి.',
    durationMs: 4000,
    placement: 'bottom',
  },
  {
    route: '/',
    selector: '[data-testid="module-card-reports"]',
    title_en: 'Reports',
    title_te: 'నివేదికలు',
    body_en: 'Get a full breakdown by site or by worker, and export anything as a PDF.',
    body_te: 'సైట్ లేదా కార్మికుని వారీగా పూర్తి విభజన పొందండి, PDFగా ఎక్స్‌పోర్ట్ చేయండి.',
    durationMs: 4000,
    placement: 'bottom',
  },

  // ── WORKERS ───────────────────────────────────────────────────────────
  {
    route: '/workers',
    selector: '[data-testid="add-worker-btn"]',
    title_en: 'Add a Worker',
    title_te: 'కార్మికుడిని జోడించండి',
    body_en: 'Tap here to add a worker\'s name, phone, and wage rate. Takes less than a minute.',
    body_te: 'కార్మికుని పేరు, ఫోన్, వేతన రేటును జోడించడానికి ఇక్కడ నొక్కండి.',
    durationMs: 4500,
    placement: 'bottom',
  },
  {
    route: '/workers',
    selector: '[data-testid="demo-worker-view-btn"]',
    title_en: 'View Profile',
    title_te: 'ప్రొఫైల్ చూడండి',
    body_en: 'Tap the eye icon on any worker to see their full profile — wage rates and notes at a glance.',
    body_te: 'ఏ కార్మికుని వేతన రేట్‌లు మరియు గమనికలను ఒక్కసారి చూడటానికి కంటి చిహ్నాన్ని నొక్కండి.',
    durationMs: 4500,
    placement: 'bottom',
  },
  {
    route: '/workers',
    selector: '[data-testid="demo-worker-edit-btn"]',
    title_en: 'Edit a Worker',
    title_te: 'కార్మికుని సవరించండి',
    body_en: 'The pencil icon lets you update any worker\'s details or wage rate anytime.',
    body_te: 'పెన్సిల్ చిహ్నం ఎప్పుడైనా కార్మికుని వివరాలను లేదా వేతన రేటును మార్చడానికి అనుమతిస్తుంది.',
    durationMs: 4500,
    placement: 'bottom',
  },
  {
    route: '/workers',
    selector: '[data-testid="demo-worker-delete-btn"]',
    title_en: 'Delete a Worker',
    title_te: 'కార్మికుని తొలగించండి',
    body_en: 'Deleting moves a worker to the Recycle Bin — nothing is lost forever right away, you can restore it later.',
    body_te: 'తొలగించడం కార్మికుని రీసైకిల్ బిన్‌కు తరలిస్తుంది — తర్వాత పునరుద్ధరించవచ్చు.',
    durationMs: 5000,
    placement: 'bottom',
  },

  // ── SITES ─────────────────────────────────────────────────────────────
  {
    route: '/sites',
    selector: '[data-testid="add-site-btn"]',
    title_en: 'Add a Site',
    title_te: 'సైట్‌ను జోడించండి',
    body_en: 'Create a site for each project — give it a name, location, and budget to start tracking.',
    body_te: 'ప్రతి ప్రాజెక్ట్ కోసం సైట్‌ను సృష్టించండి — పేరు, స్థానం, బడ్జెట్‌ను ఇవ్వండి.',
    durationMs: 4500,
    placement: 'bottom',
  },
  {
    route: '/sites',
    preClickSelector: '[data-testid="demo-site-card"]',
    selector: '[data-testid="demo-site-edit-btn"]',
    title_en: 'Edit a Site',
    title_te: 'సైట్‌ను సవరించండి',
    body_en: 'Tap a site to open its details, then the pencil icon to edit its name, budget, or status.',
    body_te: 'వివరాలు తెరవడానికి సైట్‌ను నొక్కండి, తర్వాత పేరు, బడ్జెట్ సవరించడానికి పెన్సిల్ చిహ్నం.',
    durationMs: 5000,
    placement: 'bottom',
  },
  {
    route: '/sites',
    selector: '[data-testid="demo-site-delete-btn"]',
    title_en: 'Delete a Site',
    title_te: 'సైట్‌ను తొలగించండి',
    body_en: 'Inside the site, scroll down to find Delete — it also moves to the Recycle Bin, never lost instantly.',
    body_te: 'సైట్ లోపల, తొలగించుకి కింద స్క్రోల్ చేయండి — ఇది కూడా రీసైకిల్ బిన్‌కు తరలుతుంది.',
    durationMs: 5000,
    placement: 'top',
  },

  // ── ATTENDANCE ────────────────────────────────────────────────────────
  {
    route: '/attendance',
    selector: '[data-testid="demo-worker-mark-attendance-btn"]',
    title_en: 'Mark Attendance',
    title_te: 'హాజరు గుర్తించండి',
    body_en: 'Tap the + next to any worker to mark them present for a shift, with the site and any advance paid.',
    body_te: 'ఒక షిఫ్ట్‌కు హాజరుగా గుర్తించడానికి ఏ కార్మికుని పక్కన + నొక్కండి.',
    durationMs: 5000,
    placement: 'bottom',
  },
  {
    route: '/attendance',
    selector: '[data-testid="demo-worker-attendance-history-btn"]',
    title_en: 'Attendance History',
    title_te: 'హాజరు చరిత్ర',
    body_en: 'See a worker\'s full attendance and wage history, any time.',
    body_te: 'ఎప్పుడైనా కార్మికుని పూర్తి హాజరు మరియు వేతన చరిత్రను చూడండి.',
    durationMs: 4500,
    placement: 'bottom',
  },
  {
    route: '/attendance',
    selector: '[data-testid="mark-all-btn"]',
    title_en: 'Mark Everyone at Once',
    title_te: 'అందరినీ ఒకేసారి గుర్తించండి',
    body_en: 'On busy days, mark everyone present at once instead of one by one.',
    body_te: 'రద్దీగా ఉన్న రోజుల్లో, అందరినీ ఒకేసారి హాజరుగా గుర్తించండి.',
    durationMs: 5000,
    placement: 'bottom',
  },

  // ── SUPPLIERS ─────────────────────────────────────────────────────────
  {
    route: '/suppliers',
    selector: '[data-testid="demo-supplier-card"]',
    title_en: 'Suppliers',
    title_te: 'సరఫరాదారులు',
    body_en: 'Tap a supplier to see their goods catalog and your payment balance with them.',
    body_te: 'వారి వస్తువుల కేటలాగ్ మరియు చెల్లింపు బ్యాలెన్స్ చూడటానికి సరఫరాదారుని నొక్కండి.',
    durationMs: 4500,
    placement: 'bottom',
  },
  {
    route: '/suppliers',
    preClickSelector: '[data-testid="demo-supplier-card"]',
    selector: '[data-testid="demo-supplier-edit-btn"]',
    title_en: 'Edit or Delete Supplier',
    title_te: 'సరఫరాదారుని సవరించండి లేదా తొలగించండి',
    body_en: 'Update their contact details, or delete them if you no longer work together.',
    body_te: 'వారి సంపర్క వివరాలను నవీకరించండి, లేదా ఇకపై కలిసి పనిచేయకపోతే తొలగించండి.',
    durationMs: 4500,
    placement: 'bottom',
  },
  {
    route: '/suppliers',
    selector: '[data-testid="demo-supplier-tab-payments"]',
    title_en: 'Goods & Payments Tabs',
    title_te: 'వస్తువులు & చెల్లింపుల టాబ్‌లు',
    body_en: 'Switch between what you\'ve ordered and what you\'ve paid them.',
    body_te: 'మీరు ఆర్డర్ చేసినది మరియు చెల్లించినది మధ్య మారండి.',
    durationMs: 4000,
    placement: 'top',
  },
  {
    route: '/suppliers',
    selector: '[data-testid="demo-supplier-add-payment-btn"]',
    title_en: 'Record a Payment',
    title_te: 'చెల్లింపు రికార్డ్ చేయండి',
    body_en: 'Log every payment you make to a supplier to keep your balance accurate.',
    body_te: 'మీ బ్యాలెన్స్‌ను ఖచ్చితంగా ఉంచడానికి సరఫరాదారుకు చేసిన ప్రతి చెల్లింపును నమోదు చేయండి.',
    durationMs: 4500,
    placement: 'top',
  },

  // ── GOODS ORDERS ──────────────────────────────────────────────────────
  {
    route: '/goods',
    selector: '[data-testid="add-goods-order-btn"]',
    title_en: 'New Goods Order',
    title_te: 'కొత్త వస్తువుల ఆర్డర్',
    body_en: 'Order materials from a supplier — quantity, price, and any advance paid, all in one place.',
    body_te: 'సరఫరాదారు నుండి పదార్థాలను ఆర్డర్ చేయండి — పరిమాణం, ధర, అడ్వాన్స్ అన్నీ ఒకే చోట.',
    durationMs: 4500,
    placement: 'bottom',
  },
  {
    route: '/goods',
    selector: '[data-testid="demo-order-delivered-btn"]',
    title_en: 'Mark Delivered',
    title_te: 'డెలివరీ గుర్తించండి',
    body_en: 'Once materials arrive, mark the order delivered to keep your records accurate.',
    body_te: 'పదార్థాలు వచ్చిన తర్వాత, మీ రికార్డులను ఖచ్చితంగా ఉంచడానికి ఆర్డర్‌ను డెలివరీగా గుర్తించండి.',
    durationMs: 4500,
    placement: 'top',
  },
  {
    route: '/goods',
    selector: '[data-testid="demo-order-delete-btn"]',
    title_en: 'Cancel or Delete an Order',
    title_te: 'ఆర్డర్ రద్దు చేయండి లేదా తొలగించండి',
    body_en: 'Made a mistake? Cancel an order or delete it entirely — either way, nothing is lost permanently.',
    body_te: 'తప్పు జరిగిందా? ఆర్డర్‌ను రద్దు చేయండి లేదా పూర్తిగా తొలగించండి.',
    durationMs: 4500,
    placement: 'top',
  },

  // ── MONEY ─────────────────────────────────────────────────────────────
  {
    route: '/money',
    selector: '[data-testid="net-position-card"]',
    title_en: 'Your Real Profit',
    title_te: 'మీ నిజమైన లాభం',
    body_en: 'This card always shows your true bottom line — income minus every expense, updated live.',
    body_te: 'ఈ కార్డ్ ఎల్లప్పుడూ మీ ఖచ్చితమైన లాభాన్ని చూపుతుంది.',
    durationMs: 5000,
    placement: 'top',
  },
  {
    route: '/money',
    selector: '[data-testid="money-period-all-btn"]',
    title_en: 'This Month vs All Time',
    title_te: 'ఈ నెల vs అన్ని సమయాలు',
    body_en: 'Switch between this month\'s numbers and your totals since you started using the app.',
    body_te: 'ఈ నెల సంఖ్యలు మరియు యాప్‌ను ఉపయోగించడం ప్రారంభించినప్పటి నుండి మొత్తాల మధ్య మారండి.',
    durationMs: 4000,
    placement: 'top',
  },

  // ── CONTRACTORS (private-workers) ─────────────────────────────────────
  {
    route: '/private-workers',
    selector: '[data-testid="add-contractor-btn"]',
    title_en: 'Add a Contractor',
    title_te: 'కాంట్రాక్టర్‌ను జోడించండి',
    body_en: 'For freelance or per-job workers — plumbers, electricians — paid by the job, not daily wages.',
    body_te: 'ప్లంబర్లు, ఎలక్ట్రీషియన్లు వంటి ఫ్రీలాన్స్ కార్మికుల కోసం — రోజువారీ కాకుండా పని ద్వారా చెల్లింపు.',
    durationMs: 4500,
    placement: 'bottom',
  },
  {
    route: '/private-workers',
    selector: '[data-testid="demo-contractor-pay-btn"]',
    title_en: 'Pay a Contractor',
    title_te: 'కాంట్రాక్టర్‌కు చెల్లించండి',
    body_en: 'Record a payment in either direction — what you paid them, or what they returned.',
    body_te: 'ఏ దిశలోనైనా చెల్లింపును నమోదు చేయండి — మీరు చెల్లించినది లేదా వారు తిరిగి ఇచ్చినది.',
    durationMs: 4500,
    placement: 'top',
  },
  {
    route: '/private-workers',
    selector: '[data-testid="demo-contractor-history-btn"]',
    title_en: 'Payment History',
    title_te: 'చెల్లింపు చరిత్ర',
    body_en: 'See every payment and every job assigned to this contractor, in one timeline.',
    body_te: 'ఈ కాంట్రాక్టర్‌కు కేటాయించిన ప్రతి చెల్లింపు మరియు ప్రతి పనిని ఒక టైమ్‌లైన్‌లో చూడండి.',
    durationMs: 4500,
    placement: 'top',
  },
  {
    route: '/private-workers',
    selector: '[data-testid="demo-contractor-edit-btn"]',
    title_en: 'Edit or Delete',
    title_te: 'సవరించండి లేదా తొలగించండి',
    body_en: 'Update their details, or delete them — like everywhere else, deleted items go to the Recycle Bin first.',
    body_te: 'వారి వివరాలను నవీకరించండి, లేదా తొలగించండి — తొలగించినవి మొదట రీసైకిల్ బిన్‌కు వెళ్తాయి.',
    durationMs: 4500,
    placement: 'top',
  },

  // ── CONTRACT WORK (private-work) ──────────────────────────────────────
  {
    route: '/private-work',
    selector: '[data-testid="add-contract-work-btn"]',
    title_en: 'Assign Contract Work',
    title_te: 'కాంట్రాక్ట్ పనిని కేటాయించండి',
    body_en: 'Assign a specific job to a contractor at a specific site, with the agreed price.',
    body_te: 'అంగీకరించిన ధరతో ఒక నిర్దిష్ట సైట్‌లో కాంట్రాక్టర్‌కు నిర్దిష్ట పనిని కేటాయించండి.',
    durationMs: 4500,
    placement: 'bottom',
  },
  {
    route: '/private-work',
    selector: '[data-testid="demo-contract-work-edit-btn"]',
    title_en: 'Update Progress or Payment',
    title_te: 'పురోగతి లేదా చెల్లింపును నవీకరించండి',
    body_en: 'Edit anytime to update how much has been paid, or mark the job Completed.',
    body_te: 'ఎంత చెల్లించారో నవీకరించడానికి లేదా పనిని పూర్తి చేసినట్లు గుర్తించడానికి ఎప్పుడైనా సవరించండి.',
    durationMs: 4500,
    placement: 'top',
  },

  // ── REPORTS ───────────────────────────────────────────────────────────
  {
    route: '/reports',
    selector: '[data-testid="reports-tab-outstanding"]',
    title_en: 'Outstanding Balances',
    title_te: 'బకాయి బ్యాలెన్స్‌లు',
    body_en: 'See at a glance who you still owe, and who still owes you, across every module.',
    body_te: 'ప్రతి మాడ్యూల్‌లో మీరు ఇంకా ఎవరికి బాకీ ఉన్నారో, ఎవరు మీకు బాకీ ఉన్నారో ఒక చూపులో చూడండి.',
    durationMs: 4500,
    placement: 'bottom',
  },
  {
    route: '/reports',
    selector: '[data-testid="export-pdf-btn"]',
    title_en: 'Export as PDF',
    title_te: 'PDFగా ఎక్స్‌పోర్ట్ చేయండి',
    body_en: 'Save or share any report as a PDF — handy for accounting or showing a site owner.',
    body_te: 'ఏదైనా నివేదికను PDFగా సేవ్ చేయండి లేదా షేర్ చేయండి.',
    durationMs: 4500,
    placement: 'bottom',
  },

  // ── PROFILE ───────────────────────────────────────────────────────────
  {
    route: '/profile',
    selector: '[data-testid="enable-reminders-btn"]',
    title_en: 'Never Miss a Renewal',
    title_te: 'రెన్యూవల్ మిస్ అవ్వకండి',
    body_en: 'Turn on reminders so you get a phone alert 3 days before your trial or subscription ends.',
    body_te: 'మీ ట్రయల్ లేదా సభ్యత్వం ముగియడానికి 3 రోజుల ముందు ఫోన్ అలర్ట్ పొందడానికి రిమైండర్‌లను ఆన్ చేయండి.',
    durationMs: 5000,
    placement: 'bottom',
  },
  {
    route: '/profile',
    selector: '[data-testid="download-report-btn"]',
    title_en: 'Download Everything',
    title_te: 'ప్రతిదీ డౌన్‌లోడ్ చేయండి',
    body_en: 'Get a complete PDF of your workers, sites, attendance, and suppliers, anytime.',
    body_te: 'ఎప్పుడైనా మీ కార్మికులు, సైట్‌లు, హాజరు, సరఫరాదారుల పూర్తి PDF పొందండి.',
    durationMs: 4500,
    placement: 'top',
  },

  // ── RECYCLE BIN (trash) ───────────────────────────────────────────────
  {
    route: '/trash',
    selector: '[data-testid="demo-trash-restore-btn"]',
    title_en: 'Restore Anything',
    title_te: 'ఏదైనా పునరుద్ధరించండి',
    body_en: 'Deleted something by mistake? Everything you delete lands here first, and can be restored in one tap.',
    body_te: 'పొరపాటున ఏదైనా తొలగించారా? మీరు తొలగించినవన్నీ ఇక్కడ ముందుగా వస్తాయి, ఒక నొక్కుతో పునరుద్ధరించవచ్చు.',
    durationMs: 5500,
    placement: 'bottom',
  },
  {
    route: '/trash',
    selector: '[data-testid="demo-trash-delete-forever-btn"]',
    title_en: 'Delete Forever',
    title_te: 'ఎప్పటికీ తొలగించండి',
    body_en: 'Only use this when you\'re completely sure — unlike regular delete, this cannot be undone.',
    body_te: 'మీరు పూర్తిగా ఖచ్చితంగా ఉన్నప్పుడు మాత్రమే దీన్ని ఉపయోగించండి — దీన్ని వెనక్కి తీసుకోలేరు.',
    durationMs: 5000,
    placement: 'bottom',
  },
]
