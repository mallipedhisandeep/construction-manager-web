import type { GuideStep } from '@/components/InteractiveGuide'

export const WORKERS_GUIDE: GuideStep[] = [
  {
    id: 'add-button',
    selector: '[data-testid="add-worker-btn"]',
    title_en: 'Add New Worker',
    title_te: 'కొత్త కార్మికుడిని జోడించండి',
    desc_en: 'Click here to create a new worker with name, phone, and daily wage rates.',
    desc_te: 'పేరు, ఫోన్ నం, పేరు, ఫోన్ మరియు దైనిక వేతన రేట్‌ల కోసం కొత్త కార్మికుడిని సృష్టించండి.',
    action_en: 'Click + Add Worker button',
    action_te: '+ కార్మికుడిని జోడించండి బటన్‌ను క్లిక్ చేయండి',
  },
  {
    id: 'worker-list',
    selector: '[data-testid="worker-list"]',
    title_en: 'Your Workers List',
    title_te: 'మీ కార్మికుల జాబితా',
    desc_en: 'All workers you added appear here. Tap any worker to view their profile, attendance & payments.',
    desc_te: 'మీరు జోడించిన సभ్యత్వ కార్మికులు ఇక్కడ కనిపిస్తారు. ప్రొఫైల్‌ను చూడటానికి చెదరామని.',
    action_en: 'Click on any worker card',
    action_te: 'ఏదైనా కార్మికుని కార్డ్‌పై క్లిక్ చేయండి',
  },
]

export const SITES_GUIDE: GuideStep[] = [
  {
    id: 'add-site-btn',
    selector: '[data-testid="add-site-btn"]',
    title_en: 'Create New Site',
    title_te: 'కొత్త సైట్ సృష్టించండి',
    desc_en: 'Add a new construction project. Enter site name, location, and details.',
    desc_te: 'కొత్త నిర్మాణ ప్రాజెక్ట్‌ను జోడించండి.',
    action_en: 'Click + Add Site button',
    action_te: '+ సైట్‌ను జోడించండి బటన్‌ను క్లిక్ చేయండి',
  },
  {
    id: 'sites-list',
    selector: '[data-testid="sites-list"]',
    title_en: 'Your Sites',
    title_te: 'మీ సైట్‌లు',
    desc_en: 'Each project appears as a card. Tap to manage workers, documents, payments & expenses.',
    desc_te: 'ప్రతి ప్రాజెక్ట్ కార్డుగా కనిపిస్తుంది.',
    action_en: 'Click on a site card',
    action_te: 'సైట్ కార్డ్‌పై క్లిక్ చేయండి',
  },
]

export const ATTENDANCE_GUIDE: GuideStep[] = [
  {
    id: 'date-selector',
    selector: '[data-testid="date-selector"]',
    title_en: 'Pick a Date',
    title_te: 'తేదీని ఎంచుకోండి',
    desc_en: 'Select which day\'s attendance you want to mark. Today is pre-selected.',
    desc_te: 'మీరు హాజరును గుర్తించాలనుకుంటున్న రోజును ఎంచుకోండి.',
    action_en: 'Tap the date field',
    action_te: 'తేదీ ఫీల్డ్‌ను నొక్కండి',
  },
  {
    id: 'checkbox-group',
    selector: '[data-testid="checkbox-group"]',
    title_en: 'Mark Attendance',
    title_te: 'హాజరు గుర్తించండి',
    desc_en: 'Check the box next to each worker\'s name if they were present. Leave unchecked if absent.',
    desc_te: 'ఉండిన కార్మికుల పేర్ల పక్కన చెక్‌బాక్స్‌ను చెక్ చేయండి.',
    action_en: 'Check/uncheck worker boxes',
    action_te: 'కార్మికుల బాక్సులను చెక్ చేయండి',
  },
  {
    id: 'share-btn',
    selector: '[data-testid="share-attendance-btn"]',
    title_en: 'Share on WhatsApp',
    title_te: 'WhatsApp వద్దకు పంపండి',
    desc_en: 'Send today\'s attendance summary to your workers instantly via WhatsApp.',
    desc_te: 'హాజరు సమాచారాన్ని WhatsApp ద్వారా కార్మికులకు పంపండి.',
    action_en: 'Click Share button',
    action_te: 'పంపు బటన్‌ను క్లిక్ చేయండి',
  },
]

export const MONEY_GUIDE: GuideStep[] = [
  {
    id: 'period-selector',
    selector: '[data-testid="period-selector"]',
    title_en: 'Choose Time Period',
    title_te: 'సమయ వ్యవధిని ఎంచుకోండి',
    desc_en: 'See money for this month or all time. Tap to switch between views.',
    desc_te: 'ఈ నెల లేదా అన్ని సమయాల కోసం డబ్బు చూడండి.',
    action_en: 'Tap This Month or All Time',
    action_te: 'ఈ నెల లేదా అన్ని సమయాలను నొక్కండి',
  },
  {
    id: 'income-card',
    selector: '[data-testid="income-card"]',
    title_en: 'Money In',
    title_te: 'ఆదాయం',
    desc_en: 'Total money you received from clients and projects. Higher is good!',
    desc_te: 'ఖాతాదారుల నుండి మీరు అందించిన మొత్తం డబ్బు.',
    action_en: 'See your income',
    action_te: 'మీ ఆదాయం చూడండి',
  },
  {
    id: 'expenses-breakdown',
    selector: '[data-testid="expenses-breakdown"]',
    title_en: 'Money Out',
    title_te: 'ఖర్చులు',
    desc_en: 'All expenses: worker wages, materials, site costs. Lower is good!',
    desc_te: 'కార్మికుల వేతనాలు, పదార్థాలు, సైట్ ఖర్చులు.',
    action_en: 'See your expenses',
    action_te: 'మీ ఖర్చులు చూడండి',
  },
  {
    id: 'profit-summary',
    selector: '[data-testid="profit-summary"]',
    title_en: 'Your Profit',
    title_te: 'మీ లాభం',
    desc_en: 'Income minus expenses = your profit (or loss). This is your bottom line!',
    desc_te: 'ఆదాయం - ఖర్చులు = లాభం. మీ ఎగువ లైన్!',
    action_en: 'Check your profit',
    action_te: 'మీ లాభం తనిఖీ చేయండి',
  },
]
