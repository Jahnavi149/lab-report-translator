import type { Flag, Language } from './types';

// Interface strings for Telugu, Hindi and Spanish; every other language uses the English interface.
// Report text itself (summary, explanations, questions) is translated by Muse Spark, never stored here.
// NOTE: these strings were written for this project and should be reviewed by a native speaker before real-world use.

interface Pack {
  flag: Record<Flag, string>;
  ui: Ui;
}

export interface Ui {
  testCol: string; valueCol: string; rangeCol: string; flagCol: string; meaningCol: string;
  summaryHeading: string; resultsHeading: string;
  sheetBanner: string; forFamily: (lang: string) => string; questionsToAsk: string;
  checklist: string; bringSheet: string; bringMeds: string; bringPrevious: string; doctorAnswers: string;
  notMeanTitle: string; notMeanBody: string; infoOnly: string;
  // Landing page, buttons and handout
  languageLabel: string; largeText: string; normalText: string; highContrast: string; normalContrast: string;
  heroTitleA: string; heroTitleB: string; lede: string;
  translateHeading: string; dropTitle: string; trySamplePdf: string;
  doctorSheetBtn: string; handoutBtn: string; listenBtn: string; stopListenBtn: string; newReportBtn: string;
  chooseFileBtn: string;
  shareBtn: string; whatsappBtn: string; copiedBtn: string; clearBtn: string; backBtn: string; printBtn: string; handoutTitle: string;
}

const TE: Pack = {
  flag: { High: 'ఎక్కువ', Low: 'తక్కువ', Normal: 'సాధారణ పరిధి', Unknown: 'పరిధి లేదు' },
  ui: {
    testCol: 'పరీక్ష', valueCol: 'మీ విలువ', rangeCol: 'నివేదికలోని పరిధి', flagCol: 'స్థితి', meaningCol: 'అర్థం',
    summaryHeading: 'సారాంశం — ముఖ్యమైనవి', resultsHeading: 'మీ ఫలితాలు, సులభ భాషలో',
    sheetBanner: 'డాక్టర్ షీట్ — ప్రింట్ చేయడానికి సిద్ధం. సమాచారం కోసం మాత్రమే, రోగ నిర్ధారణ కాదు. విలువలు, పరిధులు డాక్టర్ కోసం ఇంగ్లీష్‌లో ఉన్నాయి.',
    forFamily: (l) => `కుటుంబం కోసం (${l})`, questionsToAsk: 'అడగాల్సిన ప్రశ్నలు',
    checklist: 'చెక్‌లిస్ట్', bringSheet: 'ఈ షీట్ తీసుకురండి', bringMeds: 'మీ మందుల జాబితా తీసుకురండి', bringPrevious: 'మునుపటి రిపోర్టులు తీసుకురండి', doctorAnswers: 'డాక్టర్ సమాధానాలు',
    notMeanTitle: 'దీని అర్థం కాదు:', notMeanBody: 'ఒక్క ఎక్కువ లేదా తక్కువ విలువ రోగ నిర్ధారణ కాదు. దానిని మీ డాక్టర్ మాత్రమే సరైన సందర్భంలో అర్థం చేసుకోగలరు. మీకు అనారోగ్యంగా అనిపిస్తే వెంటనే వైద్య సహాయం తీసుకోండి. ఈ సాధనం అత్యవసర పరిస్థితిని అంచనా వేయలేదు.',
    infoOnly: 'సమాచారం కోసం మాత్రమే, రోగ నిర్ధారణ కాదు',
    languageLabel: 'భాష', largeText: 'A+ పెద్ద అక్షరాలు', normalText: 'సాధారణ అక్షరాలు', highContrast: 'ఎక్కువ కాంట్రాస్ట్', normalContrast: 'సాధారణ కాంట్రాస్ట్',
    heroTitleA: 'మీ ల్యాబ్ రిపోర్ట్,', heroTitleB: 'ఇప్పుడు సులభమైన భాషలో.',
    lede: 'నా తెలుగు మాట్లాడే తల్లిదండ్రులు తమ ల్యాబ్ రిపోర్టులను చదవలేకపోయారు, అందుకే దీనిని తయారు చేశాను. రిపోర్ట్ అప్‌లోడ్ చేస్తే ఖచ్చితమైన విలువలు, స్పష్టమైన స్థితి, మీ కుటుంబానికి చదివి వినిపించగల సులభ వాక్యాలు, డాక్టర్ కోసం ఒక పేజీ షీట్ లభిస్తాయి.',
    translateHeading: 'రిపోర్ట్‌ను సులభ భాషలోకి మార్చండి',
    dropTitle: 'మీ ల్యాబ్ PDF లేదా ఫోటోను ఇక్కడ వదలండి',
    trySamplePdf: 'ఉదాహరణ రిపోర్ట్ ప్రయత్నించండి',
    doctorSheetBtn: 'డాక్టర్ షీట్', handoutBtn: 'పెద్ద అక్షరాల ప్రింట్', listenBtn: 'సారాంశం వినండి', stopListenBtn: 'వినడం ఆపండి', newReportBtn: 'కొత్త రిపోర్ట్',
    chooseFileBtn: 'మీ రిపోర్ట్‌ను ఎంచుకోండి',
    shareBtn: 'షేర్ / కాపీ చేయండి', whatsappBtn: 'WhatsAppలో పంపండి', copiedBtn: 'కాపీ అయింది!', clearBtn: 'రిపోర్ట్ తొలగించండి', backBtn: 'ఫలితాలకు తిరిగి', printBtn: 'ప్రింట్ చేయండి', handoutTitle: 'మీ ఫలితాలు, పెద్ద అక్షరాలలో',
  },
};

const HI: Pack = {
  flag: { High: 'अधिक', Low: 'कम', Normal: 'सीमा में', Unknown: 'सीमा नहीं' },
  ui: {
    testCol: 'जाँच', valueCol: 'आपका मान', rangeCol: 'रिपोर्ट की सीमा', flagCol: 'स्थिति', meaningCol: 'इसका मतलब',
    summaryHeading: 'सारांश — सबसे ज़रूरी बातें', resultsHeading: 'आपके परिणाम, आसान भाषा में',
    sheetBanner: 'डॉक्टर शीट — प्रिंट के लिए तैयार। केवल जानकारी के लिए, निदान नहीं। सटीक मान और सीमाएँ डॉक्टर के लिए अंग्रेज़ी में हैं।',
    forFamily: (l) => `परिवार के लिए (${l})`, questionsToAsk: 'पूछने के लिए प्रश्न',
    checklist: 'चेकलिस्ट', bringSheet: 'यह शीट साथ लाएँ', bringMeds: 'अपनी दवाइयों की सूची साथ लाएँ', bringPrevious: 'पिछली रिपोर्टें साथ लाएँ', doctorAnswers: 'डॉक्टर के उत्तर',
    notMeanTitle: 'इसका मतलब यह नहीं है:', notMeanBody: 'केवल एक अधिक या कम मान अपने आप में निदान नहीं है। उसे केवल आपका डॉक्टर पूरे संदर्भ में समझ सकता है। यदि आप अस्वस्थ महसूस करें तो तुरंत चिकित्सा सहायता लें। यह टूल आपातकाल का अनुमान नहीं लगा सकता।',
    infoOnly: 'केवल जानकारी के लिए, निदान नहीं',
    languageLabel: 'भाषा', largeText: 'A+ बड़े अक्षर', normalText: 'सामान्य अक्षर', highContrast: 'अधिक कंट्रास्ट', normalContrast: 'सामान्य कंट्रास्ट',
    heroTitleA: 'आपकी लैब रिपोर्ट,', heroTitleB: 'अब आसान भाषा में।',
    lede: 'मैंने इसे इसलिए बनाया क्योंकि मेरे तेलुगु बोलने वाले माता-पिता अपनी लैब रिपोर्ट पढ़ नहीं पाते थे। रिपोर्ट अपलोड करें और सटीक मान, साफ़ स्थिति, परिवार को पढ़कर सुनाने लायक सरल वाक्य, और डॉक्टर के लिए एक पन्ने की शीट पाएँ।',
    translateHeading: 'रिपोर्ट को आसान भाषा में बदलें',
    dropTitle: 'अपनी लैब PDF या फ़ोटो यहाँ डालें',
    trySamplePdf: 'उदाहरण रिपोर्ट आज़माएँ',
    doctorSheetBtn: 'डॉक्टर शीट', handoutBtn: 'बड़े अक्षरों में प्रिंट', listenBtn: 'सारांश सुनें', stopListenBtn: 'सुनना बंद करें', newReportBtn: 'नई रिपोर्ट',
    chooseFileBtn: 'अपनी रिपोर्ट चुनें',
    shareBtn: 'साझा करें / कॉपी करें', whatsappBtn: 'WhatsApp पर भेजें', copiedBtn: 'कॉपी हो गया!', clearBtn: 'रिपोर्ट हटाएँ', backBtn: 'परिणामों पर वापस', printBtn: 'प्रिंट करें', handoutTitle: 'आपके परिणाम, बड़े अक्षरों में',
  },
};

const ES: Pack = {
  flag: { High: 'Alto', Low: 'Bajo', Normal: 'En rango', Unknown: 'Sin rango' },
  ui: {
    testCol: 'Prueba', valueCol: 'Su valor', rangeCol: 'Rango del informe', flagCol: 'Estado', meaningCol: 'Qué dice',
    summaryHeading: 'Resumen: lo más importante', resultsHeading: 'Sus resultados, en lenguaje sencillo',
    sheetBanner: 'Hoja para el médico, lista para imprimir. Solo información, nunca un diagnóstico. Los valores y rangos exactos están en inglés para el médico.',
    forFamily: (l) => `Para la familia (${l})`, questionsToAsk: 'Preguntas para hacer',
    checklist: 'Lista de verificación', bringSheet: 'Traiga esta hoja', bringMeds: 'Traiga su lista de medicamentos', bringPrevious: 'Traiga informes anteriores', doctorAnswers: 'Respuestas del médico',
    notMeanTitle: 'Lo que esto NO significa:', notMeanBody: 'Un valor alto o bajo por sí solo no es un diagnóstico. Solo su médico puede interpretarlo en contexto. Si se siente mal, busque atención médica de inmediato. Esta herramienta no puede evaluar la urgencia.',
    infoOnly: 'Solo información, nunca un diagnóstico',
    languageLabel: 'Idioma', largeText: 'A+ Texto grande', normalText: 'Texto normal', highContrast: 'Alto contraste', normalContrast: 'Contraste normal',
    heroTitleA: 'Su informe de laboratorio,', heroTitleB: 'por fin en lenguaje sencillo.',
    lede: 'Lo creé porque mis padres, que hablan telugu, no podían leer sus propios informes de laboratorio. Suba un informe y obtenga los valores exactos, estados claros y frases sencillas que puede leer a su familia, además de una hoja de una página para el médico.',
    translateHeading: 'Traduzca un informe',
    dropTitle: 'Suelte aquí su PDF o foto del laboratorio',
    trySamplePdf: 'Probar un informe de ejemplo',
    doctorSheetBtn: 'Hoja para el médico', handoutBtn: 'Hoja en letra grande', listenBtn: 'Escuchar el resumen', stopListenBtn: 'Dejar de escuchar', newReportBtn: 'Nuevo informe',
    chooseFileBtn: 'Elegir su informe',
    shareBtn: 'Compartir / copiar', whatsappBtn: 'Enviar por WhatsApp', copiedBtn: '¡Copiado!', clearBtn: 'Borrar informe', backBtn: 'Volver a los resultados', printBtn: 'Imprimir', handoutTitle: 'Sus resultados, en letra grande',
  },
};

const EN_UI: Ui = {
  testCol: 'Test', valueCol: 'Your value', rangeCol: 'Reference range', flagCol: 'Flag', meaningCol: 'What it says',
  summaryHeading: 'Summary — what matters most', resultsHeading: 'Your results, in plain language',
  sheetBanner: 'Doctor sheet — ready to print. Information only, never a diagnosis. Exact values and ranges are kept in English for the doctor.',
  forFamily: (l) => `For the family (${l})`, questionsToAsk: 'Questions to ask',
  checklist: 'Checklist', bringSheet: 'Bring this sheet', bringMeds: 'Bring your medicine list', bringPrevious: 'Bring any previous reports', doctorAnswers: "Doctor's answers",
  notMeanTitle: 'What this does NOT mean:', notMeanBody: 'One high or low value on its own is not a diagnosis. Only your doctor can interpret it in context. If you feel unwell, seek care promptly. This tool cannot assess urgency.',
  infoOnly: 'Information only, never a diagnosis',
  languageLabel: 'Language', largeText: 'A+ Large text', normalText: 'Normal text', highContrast: 'High contrast', normalContrast: 'Normal contrast',
  heroTitleA: 'Your lab report,', heroTitleB: 'finally in plain language.',
  lede: 'Built because my Telugu-speaking parents could not read their own lab reports. Upload a report and get the exact values, clear flags and simple sentences you can read to your family, plus a one-page sheet for the doctor.',
  translateHeading: 'Translate a report',
  dropTitle: 'Drop your lab PDF or photo here',
  trySamplePdf: 'Try an example report',
  doctorSheetBtn: 'Doctor sheet', handoutBtn: 'Large-print handout', listenBtn: 'Listen to summary', stopListenBtn: 'Stop listening', newReportBtn: 'New report',
  chooseFileBtn: 'Choose your report',
  shareBtn: 'Share / copy summary', whatsappBtn: 'Send on WhatsApp', copiedBtn: 'Copied!', clearBtn: 'Clear report', backBtn: 'Back to results', printBtn: 'Print', handoutTitle: 'Your results, in large print',
};

const PACKS: Partial<Record<Language, Pack>> = { te: TE, hi: HI, es: ES };

export const uiFor = (lang: Language): Ui => PACKS[lang]?.ui ?? EN_UI;

/** Flag label for badges: the English word always, plus the local word when a pack exists. */
export function flagLabel(lang: Language, flag: Flag): string {
  const p = PACKS[lang];
  return p ? `${flag} · ${p.flag[flag]}` : flag;
}
