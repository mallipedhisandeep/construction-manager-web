// src/lib/helpText.ts
//
// Content for the single (?) HelpIcon system. One flat keyed object so any
// component can pull its own entry without importing a whole module's worth
// of unrelated text. Add new keys here as new buttons/sections need help —
// never create a second help-text file.

export interface HelpEntry {
  title_en: string
  title_te: string
  body_en: string
  body_te: string
}

export const HELP_TEXT = {
  // ── WORKERS ──────────────────────────────────────────────────────────────
  'workers.addWorker': {
    title_en: 'Add a worker',
    title_te: 'కార్మికుడిని జోడించండి',
    body_en: 'Creates a new worker profile with name, phone, and wage rate per shift type. You can edit any of this later.',
    body_te: 'పేరు, ఫోన్ నంబర్ మరియు షిఫ్ట్ రేట్‌లతో కొత్త కార్మికుడిని సృష్టిస్తుంది. తర్వాత ఎప్పుడైనా మార్చవచ్చు.',
  },
  'workers.workerCard': {
    title_en: 'Worker profile',
    title_te: 'కార్మికుని ప్రొఫైల్',
    body_en: 'Tap to open this worker\'s full profile: attendance history, total wages, and all payments made to them.',
    body_te: 'ఈ కార్మికుని పూర్తి ప్రొఫైల్‌ను తెరవడానికి నొక్కండి: హాజరు చరిత్ర, మొత్తం వేతనాలు, చెల్లింపులు.',
  },
  'workers.markAttendance': {
    title_en: 'Mark present',
    title_te: 'హాజరుగా గుర్తించండి',
    body_en: 'Check this box for each shift the worker was present for today. Wage is calculated automatically from their rate.',
    body_te: 'ఈ రోజు కార్మికుడు ఉన్న ప్రతి షిఫ్ట్‌కు ఈ బాక్స్‌ను చెక్ చేయండి. వేతనం స్వయంచాలకంగా లెక్కించబడుతుంది.',
  },
  'workers.recordPayment': {
    title_en: 'Record a payment',
    title_te: 'చెల్లింపు రికార్డ్ చేయండి',
    body_en: 'Logs money you gave this worker — wages, advances, or settlements. Keeps an accurate running balance.',
    body_te: 'ఈ కార్మికుడికి ఇచ్చిన డబ్బును నమోదు చేస్తుంది — వేతనాలు, అడ్వాన్స్‌లు. ఖచ్చితమైన బ్యాలెన్స్‌ను ఉంచుతుంది.',
  },
  'workers.shareWhatsApp': {
    title_en: 'Share on WhatsApp',
    title_te: 'WhatsAppలో పంచుకోండి',
    body_en: 'Sends today\'s attendance and wage summary straight to this worker\'s WhatsApp.',
    body_te: 'ఈ రోజు హాజరు మరియు వేతన సారాంశాన్ని ఈ కార్మికుని WhatsAppకి పంపుతుంది.',
  },

  // ── SITES ────────────────────────────────────────────────────────────────
  'sites.addSite': {
    title_en: 'Add a site',
    title_te: 'సైట్‌ను జోడించండి',
    body_en: 'Creates a new construction project — name, location, owner contact, and budget. Each site tracks its own expenses and payments separately.',
    body_te: 'కొత్త నిర్మాణ ప్రాజెక్ట్‌ను సృష్టిస్తుంది — పేరు, స్థానం, యజమాని సంపర్కం, బడ్జెట్. ప్రతి సైట్ దాని ఖర్చులను విడిగా ట్రాక్ చేస్తుంది.',
  },
  'sites.siteCard': {
    title_en: 'Site details',
    title_te: 'సైట్ వివరాలు',
    body_en: 'Tap to manage this site: documents, payments received/spent, floor files, and agreements.',
    body_te: 'ఈ సైట్‌ను నిర్వహించడానికి నొక్కండి: పత్రాలు, చెల్లింపులు, ఫ్లోర్ ఫైల్‌లు, ఒప్పందాలు.',
  },
  'sites.uploadDoc': {
    title_en: 'Upload a document',
    title_te: 'పత్రాన్ని అప్‌లోడ్ చేయండి',
    body_en: 'Attach blueprints, photos, or contracts to this site. Files are organized by floor if you assign one.',
    body_te: 'ఈ సైట్‌కు బ్లూప్రింట్‌లు, ఫోటోలు లేదా కాంట్రాక్టులను జతచేయండి.',
  },
  'sites.payment': {
    title_en: 'Site payment',
    title_te: 'సైట్ చెల్లింపు',
    body_en: 'Record money received from the client, or money spent on this site. Used to calculate this project\'s profit or loss.',
    body_te: 'క్లయింట్ నుండి అందిన డబ్బు లేదా ఈ సైట్‌పై ఖర్చు చేసిన డబ్బును నమోదు చేయండి.',
  },

  // ── ATTENDANCE ───────────────────────────────────────────────────────────
  'attendance.dateSelect': {
    title_en: 'Choose a date',
    title_te: 'తేదీని ఎంచుకోండి',
    body_en: 'Pick which day you\'re marking attendance for. You can go back to any past date if you forgot to mark it then.',
    body_te: 'మీరు ఏ రోజుకు హాజరును గుర్తిస్తున్నారో ఎంచుకోండి. మర్చిపోతే గత తేదీలకు కూడా వెళ్లవచ్చు.',
  },
  'attendance.bulkMark': {
    title_en: 'Mark everyone at once',
    title_te: 'అందరినీ ఒకేసారి గుర్తించండి',
    body_en: 'Marks the selected shift as present for every worker who hasn\'t been marked yet today — saves time on busy days.',
    body_te: 'ఈ రోజు ఇంకా గుర్తించని ప్రతి కార్మికుడికి ఎంచుకున్న షిఫ్ట్‌ను హాజరుగా గుర్తిస్తుంది.',
  },
  'attendance.advance': {
    title_en: 'Advance payment',
    title_te: 'అడ్వాన్స్ చెల్లింపు',
    body_en: 'Money paid to the worker today against their wage. It\'s subtracted from their running balance automatically.',
    body_te: 'ఈ రోజు వేతనానికి వ్యతిరేకంగా కార్మికుడికి చెల్లించిన డబ్బు. వారి బ్యాలెన్స్ నుండి స్వయంచాలకంగా తీసివేయబడుతుంది.',
  },
  'attendance.share': {
    title_en: 'Share today\'s summary',
    title_te: 'ఈ రోజు సారాంశాన్ని పంచుకోండి',
    body_en: 'Sends a WhatsApp message listing who was present, absent, and what each worker earned today.',
    body_te: 'ఈ రోజు ఎవరు హాజరయ్యారు, ఎవరు లేరు, ప్రతి కార్మికుడు ఎంత సంపాదించారో WhatsApp సందేశాన్ని పంపుతుంది.',
  },

  // ── MONEY ────────────────────────────────────────────────────────────────
  'money.periodFilter': {
    title_en: 'Time period',
    title_te: 'సమయ వ్యవధి',
    body_en: 'Switch between this month\'s numbers and your all-time totals since you started using the app.',
    body_te: 'ఈ నెల సంఖ్యలు మరియు యాప్‌ను ఉపయోగించడం ప్రారంభించినప్పటి నుండి మొత్తం సంఖ్యల మధ్య మారండి.',
  },
  'money.profitLoss': {
    title_en: 'Profit or loss',
    title_te: 'లాభం లేదా నష్టం',
    body_en: 'Total money in minus total money out for the selected period. This is what\'s actually left in your pocket.',
    body_te: 'ఎంచుకున్న వ్యవధికి మొత్తం వచ్చిన డబ్బు మైనస్ మొత్తం ఖర్చు. ఇది మీ వద్ద నిజంగా మిగిలింది.',
  },

  // ── SUPPLIERS / GOODS ────────────────────────────────────────────────────
  'suppliers.add': {
    title_en: 'Add a supplier',
    title_te: 'సరఫరాదారుని జోడించండి',
    body_en: 'Save a materials supplier\'s contact and shop details so you can quickly order from them and track what you owe.',
    body_te: 'వస్తువుల సరఫరాదారు సంపర్కం మరియు దుకాణం వివరాలను సేవ్ చేయండి.',
  },
  'goods.order': {
    title_en: 'Place an order',
    title_te: 'ఆర్డర్ చేయండి',
    body_en: 'Records what you ordered, the price, and any advance paid. The remaining balance is tracked until you settle it.',
    body_te: 'మీరు ఆర్డర్ చేసినది, ధర మరియు చెల్లించిన ఏదైనా అడ్వాన్స్‌ను నమోదు చేస్తుంది.',
  },

  // ── PRIVATE WORK / CONTRACTORS ───────────────────────────────────────────
  'privateWorkers.add': {
    title_en: 'Add a contractor',
    title_te: 'కాంట్రాక్టర్‌ను జోడించండి',
    body_en: 'For workers paid per job rather than daily wage — like specialized trades or one-off tasks.',
    body_te: 'రోజువారీ వేతనం కాకుండా పని ఆధారంగా చెల్లించే కార్మికుల కోసం.',
  },
  'privateWork.assign': {
    title_en: 'Assign a job',
    title_te: 'పనిని కేటాయించండి',
    body_en: 'Records the agreed price for a specific piece of work at a specific site, and tracks how much has been paid so far.',
    body_te: 'ఒక నిర్దిష్ట సైట్‌లో ఒక నిర్దిష్ట పని కోసం అంగీకరించిన ధరను నమోదు చేస్తుంది.',
  },

  // ── PROFILE / SUBSCRIPTION ───────────────────────────────────────────────
  'profile.enableReminders': {
    title_en: 'Expiry reminders',
    title_te: 'గడువు రిమైండర్‌లు',
    body_en: 'Turns on phone notifications so you\'re warned 3 days before your trial or subscription ends — even with the app closed.',
    body_te: 'మీ ట్రయల్ లేదా సభ్యత్వం ముగియడానికి 3 రోజుల ముందు మీకు ఫోన్ నోటిఫికేషన్‌లు వస్తాయి.',
  },
  'profile.cancelSub': {
    title_en: 'Cancel subscription',
    title_te: 'సభ్యత్వాన్ని రద్దు చేయండి',
    body_en: 'Stops future renewals. You keep full access until your current paid period ends — nothing is cut off early, and your data is never deleted.',
    body_te: 'భవిష్యత్ రెన్యూవల్‌లను ఆపివేస్తుంది. మీ ప్రస్తుత చెల్లింపు వ్యవధి ముగిసే వరకు పూర్తి ప్రాప్యత ఉంటుంది.',
  },
  'profile.downloadReport': {
    title_en: 'Download report',
    title_te: 'రిపోర్ట్ డౌన్‌లోడ్ చేయండి',
    body_en: 'Generates a printable summary of all your workers, sites, attendance, and suppliers as a PDF.',
    body_te: 'మీ కార్మికులు, సైట్‌లు, హాజరు మరియు సరఫరాదారుల ముద్రించగల సారాంశాన్ని PDFగా రూపొందిస్తుంది.',
  },

  // ── SUBSCRIBE PAGE ───────────────────────────────────────────────────────
  'subscribe.cycleToggle': {
    title_en: 'Monthly vs yearly',
    title_te: 'మాసిక vs వార్షిక',
    body_en: 'Yearly billing works out cheaper per month than paying monthly. Both auto-renew until you cancel.',
    body_te: 'నెలవారీ చెల్లించడం కంటే వార్షిక బిల్లింగ్ నెలకు తక్కువ ఖర్చుతో ఉంటుంది.',
  },
} as const satisfies Record<string, HelpEntry>

export type HelpKey = keyof typeof HELP_TEXT
