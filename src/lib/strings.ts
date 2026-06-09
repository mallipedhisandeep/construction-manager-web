export type Lang = 'en' | 'te'

const en = {
  // App
  appTitle:'Construction Manager', appName:'CM App',
  signIn:'Sign In', signOut:'Sign Out',
  email:'Email', password:'Password', welcome:'Welcome Back',
  lightMode:'Light Mode', darkMode:'Dark Mode',
  language:'Language', settings:'Settings',
  back:'Back', save:'Save', cancel:'Cancel', edit:'Edit', delete:'Delete',
  add:'Add', close:'Close', refresh:'Refresh', loading:'Loading...',
  search:'Search workers, phone...', required:'Required', savedOk:'Saved!',
  noData:'No data available', confirmDelete:'Are you sure? Cannot be undone.',
  deleteConfirm:'Delete this? Cannot be undone.',
  movedToTrash:'Moved to recycle bin',

  // Navigation
  home:'Home', dashboard:'Dashboard', workers:'Workers',
  attendance:'Attendance', sites:'Sites', suppliers:'Suppliers',
  goods:'Goods Orders', money:'Money', privateWorkers:'Contractors',
  privateWork:'Contract Work', reports:'Reports', trash:'Recycle Bin',

  // Workers
  addWorker:'Add Worker', editWorker:'Edit Worker',
  noWorkers:'No workers found', workerAdded:'Worker added!', workerUpdated:'Worker updated!',
  name:'Full Name', phone:'Mobile Number', gender:'Gender',
  male:'Male', female:'Female', state:'State',
  telangana:'Telangana', andhra:'Andhra', bihar:'Bihar',
  role:'Role', mason:'Mason', helper:'Helper',
  workType:'Work Type', centring:'Centring', brickwork:'Brickwork',
  wageRates:'Wage Rates (₹)', notes:'Notes', personalInfo:'Personal Info',
  invalidPhone:'Enter 10-digit number',
  allStates:'All', allTypes:'All', allRoles:'All',

  // Sites
  addSite:'Add Site', noSites:'No sites found',
  siteAdded:'Site added!', siteUpdated:'Site updated!',
  siteName:'Site Name', location:'Location',
  ownerName:'Owner Name', ownerPhone:'Owner Phone',
  budget:'Budget (₹)', floors:'Floors', startDate:'Start Date',
  status:'Status', active:'Active', completed:'Completed', activeSites:'Active Sites',

  // Attendance
  markAttendance:'Mark Attendance', shift:'Shift', absent:'Absent',
  advance:'Advance (₹)', paymentMode:'Payment Mode',
  siteWorked:'Site', notMarked:'Not Marked',
  selectSite:'Select Site', selectWorker:'Select Worker',
  date:'Date', cash:'Cash', online:'Online', none:'None',
  monthly:'Monthly Summary', totalEarned:'Earned', totalAdvance:'Advance',
  balance:'Balance', toGive:'Pay Worker', toReceive:'Worker Owes',
  settled:'Settled', openingBal:'Carry Forward', daysWorked:'Days Worked',
  wage:'Wage', site:'Site', today:'Today', week:'This Week',
  month:'This Month', year:'This Year',
  noAttendance:'No attendance records',

  // Contractors
  addContractor:'Add Contractor', noContractors:'No contractors',
  owedToWorker:'We Owe', workerOwesYou:'They Owe',
  addPayment:'Add Payment', paymentHistory:'Payment History',
  direction:'Direction', youToWorker:'You to Worker', workerToYou:'Worker to You',

  // Private Work
  addWork:'Add Work', noWork:'No work entries',
  priceCharged:'Price Charged (₹)', amountPaid:'Amount Paid (₹)',
  pending:'Pending', allSettled:'All Settled',
  charged:'Charged', paid:'Paid', due:'Due', totalPending:'Total Pending',

  // Money / Reports
  overview:'Overview', summary:'Summary', details:'Details',
  history:'History', profit:'Profit', loss:'Loss', netBalance:'Net Balance',
  allSettledMsg:'All settled', payWorker:'Pay worker', workerOwes:'Worker owes you',
  exportPdf:'Export PDF',

  // Trash
  restore:'Restore', deletePermanent:'Delete Forever',
  noTrash:'Recycle bin is empty',
  trashNote:'Items deleted in last 30 days',

  // Misc
  errorLoading:'Error loading',
}

const te: typeof en = {
  // App
  appTitle:'నిర్మాణ మేనేజర్', appName:'CM యాప్',
  signIn:'లాగిన్', signOut:'లాగ్అవుట్',
  email:'ఇమెయిల్', password:'పాస్వర్డ్', welcome:'తిరిగి స్వాగతం',
  lightMode:'లైట్ మోడ్', darkMode:'డార్క్ మోడ్',
  language:'భాష', settings:'సెట్టింగులు',
  back:'వెనక్కి', save:'సేవ్ చేయి', cancel:'రద్దు', edit:'సవరించు', delete:'తొలగించు',
  add:'జోడించు', close:'మూసివేయి', refresh:'రిఫ్రెష్', loading:'లోడ్ అవుతోంది...',
  search:'కార్మికులు, ఫోన్ వెతకండి...', required:'అవసరం', savedOk:'సేవ్ అయింది!',
  noData:'డేటా అందుబాటులో లేదు', confirmDelete:'ఖచ్చితంగా తొలగించాలా?',
  deleteConfirm:'ఖచ్చితంగా తొలగించాలా?',
  movedToTrash:'చెత్తబుట్టకు తరలించబడింది',

  // Navigation
  home:'హోమ్', dashboard:'డాష్బోర్డ్', workers:'కార్మికులు',
  attendance:'హాజరు', sites:'సైట్లు', suppliers:'సరఫరాదారులు',
  goods:'వస్తువుల ఆర్డర్లు', money:'డబ్బు', privateWorkers:'కాంట్రాక్టర్లు',
  privateWork:'కాంట్రాక్టు పని', reports:'నివేదికలు', trash:'చెత్తబుట్ట',

  // Workers — FIX 5: all filter labels translated
  addWorker:'కార్మికుని జోడించు', editWorker:'కార్మికుని సవరించు',
  noWorkers:'కార్మికులు కనుగొనబడలేదు', workerAdded:'కార్మికుడు జోడించబడ్డారు!', workerUpdated:'కార్మికుడు అప్డేట్ అయ్యారు!',
  name:'పూర్తి పేరు', phone:'మొబైల్ నంబర్', gender:'లింగం',
  male:'పురుషుడు', female:'స్త్రీ', state:'రాష్ట్రం',
  telangana:'తెలంగాణ', andhra:'ఆంధ్ర', bihar:'బీహార్',
  role:'పాత్ర', mason:'మేస్త్రీ', helper:'హెల్పర్',
  workType:'పని రకం', centring:'సెంట్రింగ్', brickwork:'ఇటుక పని',
  wageRates:'వేతన రేట్లు (రూ)', notes:'గమనికలు', personalInfo:'వ్యక్తిగత వివరాలు',
  invalidPhone:'10 అంకెల నంబర్ నమోదు చేయండి',
  allStates:'అన్నీ', allTypes:'అన్నీ', allRoles:'అన్నీ',

  // Sites
  addSite:'సైటు జోడించు', noSites:'సైట్లు కనుగొనబడలేదు',
  siteAdded:'సైటు జోడించబడింది!', siteUpdated:'సైటు అప్డేట్ అయింది!',
  siteName:'సైటు పేరు', location:'లొకేషన్',
  ownerName:'యజమాని పేరు', ownerPhone:'యజమాని ఫోన్',
  budget:'బడ్జెట్ (రూ)', floors:'అంతస్తులు', startDate:'ప్రారంభ తేదీ',
  status:'స్థితి', active:'చురుకు', completed:'పూర్తి', activeSites:'చురుకైన సైట్లు',

  // Attendance
  markAttendance:'హాజరు గుర్తించు', shift:'షిఫ్ట్', absent:'గైర్హాజరు',
  advance:'అడ్వాన్స్ (రూ)', paymentMode:'చెల్లింపు పద్ధతి',
  siteWorked:'సైటు', notMarked:'గుర్తించబడలేదు',
  selectSite:'సైటు ఎంచుకోండి', selectWorker:'కార్మికుని ఎంచుకోండి',
  date:'తేదీ', cash:'నగదు', online:'ఆన్లైన్', none:'ఏదీ కాదు',
  monthly:'నెలవారీ సారాంశం', totalEarned:'సంపాదించినది', totalAdvance:'అడ్వాన్స్',
  balance:'బాకీ', toGive:'కార్మికుడికి ఇవ్వాలి', toReceive:'కార్మికుడు ఇవ్వాలి',
  settled:'క్లియర్', openingBal:'కేరీ ఫార్వర్డ్', daysWorked:'పని రోజులు',
  wage:'వేతనం', site:'సైటు', today:'నేడు', week:'ఈ వారం',
  month:'ఈ నెల', year:'ఈ సంవత్సరం',
  noAttendance:'హాజరు రికార్డులు లేవు',

  // Contractors
  addContractor:'కాంట్రాక్టర్ జోడించు', noContractors:'కాంట్రాక్టర్లు లేరు',
  owedToWorker:'మేము ఇవ్వాలి', workerOwesYou:'వారు ఇవ్వాలి',
  addPayment:'చెల్లింపు జోడించు', paymentHistory:'చెల్లింపు చరిత్ర',
  direction:'దిశ', youToWorker:'మీరు కార్మికుడికి', workerToYou:'కార్మికుడు మీకు',

  // Private Work
  addWork:'పని జోడించు', noWork:'పని వివరాలు లేవు',
  priceCharged:'వసూలు ధర (రూ)', amountPaid:'చెల్లింపు మొత్తం (రూ)',
  pending:'పెండింగ్', allSettled:'అన్నీ క్లియర్',
  charged:'వసూలు', paid:'చెల్లింపు', due:'బాకీ', totalPending:'మొత్తం పెండింగ్',

  // Money / Reports
  overview:'అవలోకనం', summary:'సారాంశం', details:'వివరాలు',
  history:'చరిత్ర', profit:'లాభం', loss:'నష్టం', netBalance:'నికర బాకీ',
  allSettledMsg:'అన్నీ క్లియర్', payWorker:'కార్మికుడికి చెల్లించు',
  workerOwes:'కార్మికుడు ఇవ్వాలి', exportPdf:'PDF డౌన్లోడ్',

  // Trash
  restore:'పునరుద్ధరించు', deletePermanent:'శాశ్వతంగా తొలగించు',
  noTrash:'చెత్తబుట్ట ఖాళీగా ఉంది',
  trashNote:'గత 30 రోజుల్లో తొలగించబడిన వస్తువులు',

  // Misc
  errorLoading:'లోపం సంభవించింది',
}

export const MONTHS: Record<Lang, string[]> = {
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  te: ['జనవరి','ఫిబ్రవరి','మార్చి','ఏప్రిల్','మే','జూన్','జులై','ఆగస్టు','సెప్టెంబర్','అక్టోబర్','నవంబర్','డిసెంబర్'],
}

export const strings = { en, te }

// Safe getter — never returns undefined, falls back to English key
export const ts  = (lang: Lang, key: keyof typeof en): string =>
  (strings[lang][key] ?? strings['en'][key] ?? key) as string
export const tss = ts
