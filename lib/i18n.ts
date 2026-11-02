import type { Flag, LabRow, Language } from './types';

// Built-in, deterministic translations. Every sentence the app produces without AI is a fixed template with
// the test name, value, unit and printed range filled in, so it can be translated once, by a person, and
// reused with no network and no risk of a changed number. Test names, values, units and ranges are never translated.
//
// Languages with a built-in pack work with no Muse key. Others need Muse (or show English with a notice).
// NOTE: these packs were written for this project and should be reviewed by a native speaker before real-world use.

type RowLike = Pick<LabRow, 'test_name' | 'value' | 'unit' | 'ref_low' | 'ref_high' | 'flag'>;

interface Pack {
  name: string;
  flag: Record<Flag, string>;
  explain: Record<Flag, (name: string, v: string) => string>;
  explainMarker: (name: string, v: string, flag: string) => string;
  sumFirst: (list: string) => string;
  sumFirstNone: string;
  sumSecond: (n: number) => string;
  sumSecondNone: string;
  sumThird: (n: number) => string;
  sumThirdNone: string;
  range: { between: (lo: number, hi: number, u: string) => string; under: (hi: number, u: string) => string; over: (lo: number, u: string) => string };
  qRanged: (name: string, v: string, range: string) => string;
  qMarker: (name: string, v: string, flag: string) => string;
  qUnknown: (name: string, v: string) => string;
  qFiller: string;
  ui: Ui;
}

export interface Ui {
  testCol: string; valueCol: string; rangeCol: string; flagCol: string; meaningCol: string;
  summaryHeading: string; resultsHeading: string;
  sheetBanner: string; forFamily: (lang: string) => string; questionsToAsk: string;
  checklist: string; bringSheet: string; bringMeds: string; bringPrevious: string; recheck: string; doctorAnswers: string;
  notMeanTitle: string; notMeanBody: string; infoOnly: string;
  // Landing page, buttons and handout
  languageLabel: string; largeText: string; normalText: string; highContrast: string; normalContrast: string;
  heroTitleA: string; heroTitleB: string; lede: string; chips: [string, string, string];
  translateHeading: string; translateHint: string; dropTitle: string; dropSub: string; trySamplePdf: string;
  doctorSheetBtn: string; handoutBtn: string; listenBtn: string; stopListenBtn: string; newReportBtn: string;
  guideBtn: string; guideTitle: string; guideSteps: string[];
  chooseFileBtn: string; moreBtn: string;
  shareBtn: string; whatsappBtn: string; copiedBtn: string; clearBtn: string; backBtn: string; printBtn: string; handoutTitle: string;
}

const t = (u: string) => (u ? ` ${u}` : '');
const val = (r: RowLike) => `${r.value}${t(r.unit)}`;

const TE: Pack = {
  name: 'తెలుగు',
  flag: { High: 'ఎక్కువ', Low: 'తక్కువ', Normal: 'సాధారణ పరిధి', Unknown: 'పరిధి లేదు' },
  explain: {
    High: (n, v) => `${n}: ${v} — ఈ నివేదికలో ముద్రించిన పరిధి కంటే ఎక్కువగా ఉంది.`,
    Low: (n, v) => `${n}: ${v} — ఈ నివేదికలో ముద్రించిన పరిధి కంటే తక్కువగా ఉంది.`,
    Normal: (n, v) => `${n}: ${v} — ఈ నివేదికలో ముద్రించిన పరిధిలోనే ఉంది.`,
    Unknown: (n, v) => `${n}: ${v} — ఈ నివేదికలో పరిధి ముద్రించలేదు, కాబట్టి అది పరిధిలో ఉందో లేదో చెప్పలేము.`,
  },
  explainMarker: (n, v, f) => `${n}: ${v} — నివేదికే దీనిని "${f}" అని గుర్తించింది, కానీ పరిధి ముద్రించలేదు.`,
  sumFirst: (l) => `ముందుగా డాక్టర్‌ను అడగాల్సినవి: ${l}.`,
  sumFirstNone: 'ఈ నివేదికలో ముద్రించిన పరిధికి వెలుపల ఏ విలువా లేదు.',
  sumSecond: (n) => (n === 1 ? `${n} ఫలితం ముద్రించిన పరిధిలో ఉంది.` : `${n} ఫలితాలు ముద్రించిన పరిధిలో ఉన్నాయి.`),
  sumSecondNone: 'ముద్రించిన పరిధిలో ఏ ఫలితమూ లేదు.',
  sumThird: (n) => (n === 1 ? `${n} ఫలితానికి నివేదికలో పరిధి ముద్రించలేదు, అందుకే దానిని గుర్తించలేకపోయాం. ఏ పరిధి వర్తిస్తుందో డాక్టర్‌ను అడగండి.` : `${n} ఫలితాలకు నివేదికలో పరిధి ముద్రించలేదు, అందుకే వాటిని గుర్తించలేకపోయాం. ఏ పరిధి వర్తిస్తుందో డాక్టర్‌ను అడగండి.`),
  sumThirdNone: 'ప్రతి ఫలితానికి నివేదికలో పరిధి ముద్రించబడింది.',
  range: { between: (lo, hi, u) => `${lo} నుండి ${hi}${t(u)}`, under: (hi, u) => `${hi}${t(u)} కంటే తక్కువ`, over: (lo, u) => `${lo}${t(u)} కంటే ఎక్కువ` },
  qRanged: (n, v, r) => `నా ${n} ${v} వచ్చింది, ఈ నివేదికలో పరిధి ${r}. దీనికి కారణం ఏమై ఉండవచ్చు, మళ్లీ పరీక్ష చేయించుకోవాలా?`,
  qMarker: (n, v, f) => `నా ${n} ${v} వచ్చింది, నివేదిక దీనిని "${f}" అని గుర్తించింది కానీ పరిధి ముద్రించలేదు. నేను ఏ పరిధితో పోల్చాలి, మళ్లీ పరీక్ష చేయించుకోవాలా?`,
  qUnknown: (n, v) => `నా ${n} ${v} వచ్చింది, కానీ ఈ నివేదికలో పరిధి ముద్రించలేదు. నేను ఏ పరిధితో పోల్చాలి, మళ్లీ పరీక్ష చేయించుకోవాలా?`,
  qFiller: 'ఈ నివేదిక నుండి నేను గమనించాల్సినవి, తీసుకురావాల్సినవి లేదా తదుపరి సందర్శనలో అడగాల్సినవి ఏమైనా ఉన్నాయా?',
  ui: {
    testCol: 'పరీక్ష', valueCol: 'మీ విలువ', rangeCol: 'నివేదికలోని పరిధి', flagCol: 'స్థితి', meaningCol: 'అర్థం',
    summaryHeading: 'సారాంశం — ముఖ్యమైనవి', resultsHeading: 'మీ ఫలితాలు, సులభ భాషలో',
    sheetBanner: 'డాక్టర్ షీట్ — ప్రింట్ చేయడానికి సిద్ధం. సమాచారం కోసం మాత్రమే, రోగ నిర్ధారణ కాదు. విలువలు, పరిధులు డాక్టర్ కోసం ఇంగ్లీష్‌లో ఉన్నాయి.',
    forFamily: (l) => `కుటుంబం కోసం (${l})`, questionsToAsk: 'అడగాల్సిన ప్రశ్నలు',
    checklist: 'చెక్‌లిస్ట్', bringSheet: 'ఈ షీట్ తీసుకురండి', bringMeds: 'మీ మందుల జాబితా తీసుకురండి', bringPrevious: 'మునుపటి రిపోర్టులు తీసుకురండి', recheck: 'డాక్టర్‌తో చర్చించాల్సిన తేదీ', doctorAnswers: 'డాక్టర్ సమాధానాలు',
    notMeanTitle: 'దీని అర్థం కాదు:', notMeanBody: 'ఒక్క ఎక్కువ లేదా తక్కువ విలువ రోగ నిర్ధారణ కాదు. దానిని మీ డాక్టర్ మాత్రమే సరైన సందర్భంలో అర్థం చేసుకోగలరు. మీకు అనారోగ్యంగా అనిపిస్తే వెంటనే వైద్య సహాయం తీసుకోండి. ఈ సాధనం అత్యవసర పరిస్థితిని అంచనా వేయలేదు.',
    infoOnly: 'సమాచారం కోసం మాత్రమే, రోగ నిర్ధారణ కాదు',
    languageLabel: 'భాష', largeText: 'A+ పెద్ద అక్షరాలు', normalText: 'సాధారణ అక్షరాలు', highContrast: 'ఎక్కువ కాంట్రాస్ట్', normalContrast: 'సాధారణ కాంట్రాస్ట్',
    heroTitleA: 'మీ ల్యాబ్ రిపోర్ట్,', heroTitleB: 'ఇప్పుడు సులభమైన భాషలో.',
    lede: 'నా తెలుగు మాట్లాడే తల్లిదండ్రులు తమ ల్యాబ్ రిపోర్టులను చదవలేకపోయారు, అందుకే దీనిని తయారు చేశాను. రిపోర్ట్ అప్‌లోడ్ చేస్తే ఖచ్చితమైన విలువలు, స్పష్టమైన స్థితి, మీ కుటుంబానికి చదివి వినిపించగల సులభ వాక్యాలు, డాక్టర్ కోసం ఒక పేజీ షీట్ లభిస్తాయి.',
    chips: ['ముద్రించిన పరిధి నుండి కోడ్ ద్వారా లెక్కించిన స్థితి', 'AI రాసిన వాక్యాలను తనిఖీ చేస్తాం; సరిగా లేనివి తీసివేస్తాం', 'ఖాతా అవసరం లేదు, ఏమీ నిల్వ చేయం'],
    translateHeading: 'రిపోర్ట్‌ను సులభ భాషలోకి మార్చండి', translateHint: 'ఒక్క ట్యాప్‌తో నమూనా రిపోర్ట్ ప్రయత్నించండి, లేదా మీ డిజిటల్ PDF ఇవ్వండి.',
    dropTitle: 'మీ ల్యాబ్ PDF లేదా ఫోటోను ఇక్కడ వదలండి', dropSub: 'PDF లేదా ఫోటో • గరిష్టంగా 10 MB',
    trySamplePdf: 'ఉదాహరణ రిపోర్ట్ ప్రయత్నించండి',
    doctorSheetBtn: 'డాక్టర్ షీట్', handoutBtn: 'పెద్ద అక్షరాల ప్రింట్', listenBtn: 'సారాంశం వినండి', stopListenBtn: 'వినడం ఆపండి', newReportBtn: 'కొత్త రిపోర్ట్',
    chooseFileBtn: 'మీ రిపోర్ట్‌ను ఎంచుకోండి', moreBtn: 'మరిన్ని ఎంపికలు',
    guideBtn: 'యాప్ ఎలా వాడాలో వినండి', guideTitle: 'ఎలా వాడాలి',
    guideSteps: [
      'పైన మీ భాషను ఎంచుకోండి.',
      'నమూనా రిపోర్ట్ ప్రయత్నించడానికి ప్రధాన బటన్‌ను నొక్కండి, లేదా మీ ల్యాబ్ రిపోర్ట్ PDFని ఇక్కడ వదలండి.',
      'కొన్ని సెకన్లు వేచి ఉండండి. ప్రతి పరీక్ష, మీ విలువ, ముద్రించిన సాధారణ పరిధి కనిపిస్తాయి.',
      'సారాంశం వినడానికి "సారాంశం వినండి" నొక్కండి. డాక్టర్ కోసం ప్రశ్నలు ముద్రించడానికి "డాక్టర్ షీట్" నొక్కండి.',
      'ఈ యాప్ సంఖ్యలను మాత్రమే వివరిస్తుంది. రోగ నిర్ధారణ చేయదు. దయచేసి మీ డాక్టర్‌తో మాట్లాడండి.',
    ],
    shareBtn: 'షేర్ / కాపీ చేయండి', whatsappBtn: 'WhatsAppలో పంపండి', copiedBtn: 'కాపీ అయింది!', clearBtn: 'రిపోర్ట్ తొలగించండి', backBtn: 'ఫలితాలకు తిరిగి', printBtn: 'ప్రింట్ చేయండి', handoutTitle: 'మీ ఫలితాలు, పెద్ద అక్షరాలలో',
  },
};

const HI: Pack = {
  name: 'हिन्दी',
  flag: { High: 'अधिक', Low: 'कम', Normal: 'सीमा में', Unknown: 'सीमा नहीं' },
  explain: {
    High: (n, v) => `${n}: ${v} — इस रिपोर्ट में छपी सीमा से अधिक है।`,
    Low: (n, v) => `${n}: ${v} — इस रिपोर्ट में छपी सीमा से कम है।`,
    Normal: (n, v) => `${n}: ${v} — इस रिपोर्ट में छपी सीमा के अंदर है।`,
    Unknown: (n, v) => `${n}: ${v} — इस रिपोर्ट में कोई सीमा नहीं छपी है, इसलिए हम नहीं बता सकते कि यह सीमा के अंदर है या बाहर।`,
  },
  explainMarker: (n, v, f) => `${n}: ${v} — रिपोर्ट ने खुद इसे "${f}" चिह्नित किया है, लेकिन कोई सीमा नहीं छपी है।`,
  sumFirst: (l) => `सबसे पहले डॉक्टर से पूछें: ${l}।`,
  sumFirstNone: 'इस रिपोर्ट में कोई मान छपी सीमा से बाहर नहीं था।',
  sumSecond: (n) => `${n} परिणाम छपी सीमा के अंदर ${n === 1 ? 'था' : 'थे'}।`,
  sumSecondNone: 'कोई परिणाम छपी सीमा के अंदर नहीं था।',
  sumThird: (n) => (n === 1 ? `${n} परिणाम के लिए रिपोर्ट में सीमा नहीं छपी थी, इसलिए उसे चिह्नित नहीं किया जा सका। अपने डॉक्टर से पूछें कि कौन-सी सीमा लागू होती है।` : `${n} परिणामों के लिए रिपोर्ट में सीमा नहीं छपी थी, इसलिए उन्हें चिह्नित नहीं किया जा सका। अपने डॉक्टर से पूछें कि कौन-सी सीमा लागू होती है।`),
  sumThirdNone: 'हर परिणाम के लिए रिपोर्ट में सीमा छपी थी।',
  range: { between: (lo, hi, u) => `${lo} से ${hi}${t(u)}`, under: (hi, u) => `${hi}${t(u)} से कम`, over: (lo, u) => `${lo}${t(u)} से अधिक` },
  qRanged: (n, v, r) => `मेरा ${n} ${v} था, जबकि इस रिपोर्ट में सीमा ${r} है। इसका क्या कारण हो सकता है, और क्या हमें दोबारा जाँच करानी चाहिए?`,
  qMarker: (n, v, f) => `मेरा ${n} ${v} था, रिपोर्ट ने इसे "${f}" चिह्नित किया है लेकिन कोई सीमा नहीं छपी है। मुझे किस सीमा से तुलना करनी चाहिए, और क्या हमें दोबारा जाँच करानी चाहिए?`,
  qUnknown: (n, v) => `मेरा ${n} ${v} था, लेकिन इस रिपोर्ट में कोई सीमा नहीं छपी थी। मुझे किस सीमा से तुलना करनी चाहिए, और क्या हमें दोबारा जाँच करानी चाहिए?`,
  qFiller: 'क्या इस रिपोर्ट से ऐसा कुछ है जिसे मुझे ट्रैक करना, साथ लाना या अगली मुलाकात में पूछना चाहिए?',
  ui: {
    testCol: 'जाँच', valueCol: 'आपका मान', rangeCol: 'रिपोर्ट की सीमा', flagCol: 'स्थिति', meaningCol: 'इसका मतलब',
    summaryHeading: 'सारांश — सबसे ज़रूरी बातें', resultsHeading: 'आपके परिणाम, आसान भाषा में',
    sheetBanner: 'डॉक्टर शीट — प्रिंट के लिए तैयार। केवल जानकारी के लिए, निदान नहीं। सटीक मान और सीमाएँ डॉक्टर के लिए अंग्रेज़ी में हैं।',
    forFamily: (l) => `परिवार के लिए (${l})`, questionsToAsk: 'पूछने के लिए प्रश्न',
    checklist: 'चेकलिस्ट', bringSheet: 'यह शीट साथ लाएँ', bringMeds: 'अपनी दवाइयों की सूची साथ लाएँ', bringPrevious: 'पिछली रिपोर्टें साथ लाएँ', recheck: 'डॉक्टर से चर्चा के लिए तारीख', doctorAnswers: 'डॉक्टर के उत्तर',
    notMeanTitle: 'इसका मतलब यह नहीं है:', notMeanBody: 'केवल एक अधिक या कम मान अपने आप में निदान नहीं है। उसे केवल आपका डॉक्टर पूरे संदर्भ में समझ सकता है। यदि आप अस्वस्थ महसूस करें तो तुरंत चिकित्सा सहायता लें। यह टूल आपातकाल का अनुमान नहीं लगा सकता।',
    infoOnly: 'केवल जानकारी के लिए, निदान नहीं',
    languageLabel: 'भाषा', largeText: 'A+ बड़े अक्षर', normalText: 'सामान्य अक्षर', highContrast: 'अधिक कंट्रास्ट', normalContrast: 'सामान्य कंट्रास्ट',
    heroTitleA: 'आपकी लैब रिपोर्ट,', heroTitleB: 'अब आसान भाषा में।',
    lede: 'मैंने इसे इसलिए बनाया क्योंकि मेरे तेलुगु बोलने वाले माता-पिता अपनी लैब रिपोर्ट पढ़ नहीं पाते थे। रिपोर्ट अपलोड करें और सटीक मान, साफ़ स्थिति, परिवार को पढ़कर सुनाने लायक सरल वाक्य, और डॉक्टर के लिए एक पन्ने की शीट पाएँ।',
    chips: ['छपी सीमा से कोड द्वारा निकाली गई स्थिति', 'AI के लिखे वाक्यों की जाँच होती है; गलत वाक्य हटा दिए जाते हैं', 'खाता नहीं, कुछ भी सहेजा नहीं जाता'],
    translateHeading: 'रिपोर्ट को आसान भाषा में बदलें', translateHint: 'एक टैप में नमूना रिपोर्ट आज़माएँ, या अपनी डिजिटल PDF डालें।',
    dropTitle: 'अपनी लैब PDF या फ़ोटो यहाँ डालें', dropSub: 'PDF या फ़ोटो • अधिकतम 10 MB',
    trySamplePdf: 'उदाहरण रिपोर्ट आज़माएँ',
    doctorSheetBtn: 'डॉक्टर शीट', handoutBtn: 'बड़े अक्षरों में प्रिंट', listenBtn: 'सारांश सुनें', stopListenBtn: 'सुनना बंद करें', newReportBtn: 'नई रिपोर्ट',
    chooseFileBtn: 'अपनी रिपोर्ट चुनें', moreBtn: 'और विकल्प',
    guideBtn: 'ऐप कैसे चलाएँ, सुनें', guideTitle: 'कैसे इस्तेमाल करें',
    guideSteps: [
      'ऊपर अपनी भाषा चुनें।',
      'नमूना रिपोर्ट आज़माने के लिए मुख्य बटन दबाएँ, या अपनी लैब रिपोर्ट की PDF यहाँ डालें।',
      'कुछ सेकंड रुकें। हर जाँच, आपका मान और छपी हुई सामान्य सीमा दिखाई देगी।',
      'सारांश सुनने के लिए "सारांश सुनें" दबाएँ। डॉक्टर के लिए सवाल छापने के लिए "डॉक्टर शीट" दबाएँ।',
      'यह ऐप सिर्फ़ संख्याएँ समझाता है। यह बीमारी की पहचान नहीं करता। कृपया अपने डॉक्टर से बात करें।',
    ],
    shareBtn: 'साझा करें / कॉपी करें', whatsappBtn: 'WhatsApp पर भेजें', copiedBtn: 'कॉपी हो गया!', clearBtn: 'रिपोर्ट हटाएँ', backBtn: 'परिणामों पर वापस', printBtn: 'प्रिंट करें', handoutTitle: 'आपके परिणाम, बड़े अक्षरों में',
  },
};

const ES: Pack = {
  name: 'Español',
  flag: { High: 'Alto', Low: 'Bajo', Normal: 'En rango', Unknown: 'Sin rango' },
  explain: {
    High: (n, v) => `${n}: ${v}, por encima del rango impreso en este informe.`,
    Low: (n, v) => `${n}: ${v}, por debajo del rango impreso en este informe.`,
    Normal: (n, v) => `${n}: ${v}, dentro del rango impreso en este informe.`,
    Unknown: (n, v) => `${n}: ${v}, pero este informe no imprime un rango, así que no podemos decir si está dentro o fuera.`,
  },
  explainMarker: (n, v, f) => `${n}: ${v}. El propio informe lo marca como "${f}", pero no imprime un rango.`,
  sumFirst: (l) => `Pregunte primero por: ${l}.`,
  sumFirstNone: 'Ningún valor estuvo fuera de los rangos impresos en este informe.',
  sumSecond: (n) => `${n} resultado${n === 1 ? '' : 's'} ${n === 1 ? 'estuvo' : 'estuvieron'} dentro del rango impreso.`,
  sumSecondNone: 'Ningún resultado estuvo dentro de un rango impreso.',
  sumThird: (n) => `${n} resultado${n === 1 ? '' : 's'} no tenía${n === 1 ? '' : 'n'} rango impreso, por lo que no se ${n === 1 ? 'pudo' : 'pudieron'} marcar. Pregunte a su médico qué rango corresponde.`,
  sumThirdNone: 'Todos los resultados de este informe tenían un rango impreso.',
  range: { between: (lo, hi, u) => `${lo} a ${hi}${t(u)}`, under: (hi, u) => `menos de ${hi}${t(u)}`, over: (lo, u) => `más de ${lo}${t(u)}` },
  qRanged: (n, v, r) => `Mi ${n} fue ${v}, y el rango de este informe es ${r}. ¿Qué podría causar esto y deberíamos repetir la prueba?`,
  qMarker: (n, v, f) => `Mi ${n} fue ${v}; el informe lo marca como "${f}" pero no imprime un rango. ¿Con qué rango debo compararlo y deberíamos repetir la prueba?`,
  qUnknown: (n, v) => `Mi ${n} fue ${v}, pero este informe no imprimió un rango. ¿Con qué rango debo compararlo y deberíamos repetir la prueba?`,
  qFiller: '¿Hay algo de este informe que deba vigilar, traer o preguntar en mi próxima visita?',
  ui: {
    testCol: 'Prueba', valueCol: 'Su valor', rangeCol: 'Rango del informe', flagCol: 'Estado', meaningCol: 'Qué dice',
    summaryHeading: 'Resumen: lo más importante', resultsHeading: 'Sus resultados, en lenguaje sencillo',
    sheetBanner: 'Hoja para el médico, lista para imprimir. Solo información, nunca un diagnóstico. Los valores y rangos exactos están en inglés para el médico.',
    forFamily: (l) => `Para la familia (${l})`, questionsToAsk: 'Preguntas para hacer',
    checklist: 'Lista de verificación', bringSheet: 'Traiga esta hoja', bringMeds: 'Traiga su lista de medicamentos', bringPrevious: 'Traiga informes anteriores', recheck: 'Fecha para tratar con su médico', doctorAnswers: 'Respuestas del médico',
    notMeanTitle: 'Lo que esto NO significa:', notMeanBody: 'Un valor alto o bajo por sí solo no es un diagnóstico. Solo su médico puede interpretarlo en contexto. Si se siente mal, busque atención médica de inmediato. Esta herramienta no puede evaluar la urgencia.',
    infoOnly: 'Solo información, nunca un diagnóstico',
    languageLabel: 'Idioma', largeText: 'A+ Texto grande', normalText: 'Texto normal', highContrast: 'Alto contraste', normalContrast: 'Contraste normal',
    heroTitleA: 'Su informe de laboratorio,', heroTitleB: 'por fin en lenguaje sencillo.',
    lede: 'Lo creé porque mis padres, que hablan telugu, no podían leer sus propios informes de laboratorio. Suba un informe y obtenga los valores exactos, estados claros y frases sencillas que puede leer a su familia, además de una hoja de una página para el médico.',
    chips: ['Estados calculados por código a partir del rango impreso', 'El texto de la IA se verifica; el texto malo se descarta', 'Sin cuenta, no se guarda nada'],
    translateHeading: 'Traduzca un informe', translateHint: 'Pruebe con un toque usando un ejemplo sintético, o suba su propio PDF digital.',
    dropTitle: 'Suelte aquí su PDF o foto del laboratorio', dropSub: 'PDF o foto • máx. 10 MB',
    trySamplePdf: 'Probar un informe de ejemplo',
    doctorSheetBtn: 'Hoja para el médico', handoutBtn: 'Hoja en letra grande', listenBtn: 'Escuchar el resumen', stopListenBtn: 'Dejar de escuchar', newReportBtn: 'Nuevo informe',
    chooseFileBtn: 'Elegir su informe', moreBtn: 'Más opciones',
    guideBtn: 'Escuchar cómo usar la app', guideTitle: 'Cómo usar la app',
    guideSteps: [
      'Elija su idioma arriba.',
      'Pulse el botón principal para probar un informe de ejemplo, o suelte aquí el PDF de su informe de laboratorio.',
      'Espere unos segundos. Verá cada prueba, su valor y el rango normal impreso.',
      'Pulse «Escuchar el resumen» para oír un resumen. Pulse «Hoja para el médico» para imprimir preguntas para su médico.',
      'Esta aplicación solo explica los números. No diagnostica. Hable con su médico.',
    ],
    shareBtn: 'Compartir / copiar', whatsappBtn: 'Enviar por WhatsApp', copiedBtn: '¡Copiado!', clearBtn: 'Borrar informe', backBtn: 'Volver a los resultados', printBtn: 'Imprimir', handoutTitle: 'Sus resultados, en letra grande',
  },
};

const EN_UI: Ui = {
  testCol: 'Test', valueCol: 'Your value', rangeCol: 'Reference range', flagCol: 'Flag', meaningCol: 'What it says',
  summaryHeading: 'Summary — what matters most', resultsHeading: 'Your results, in plain language',
  sheetBanner: 'Doctor sheet — ready to print. Information only, never a diagnosis. Exact values and ranges are kept in English for the doctor.',
  forFamily: (l) => `For the family (${l})`, questionsToAsk: 'Questions to ask',
  checklist: 'Checklist', bringSheet: 'Bring this sheet', bringMeds: 'Bring your medicine list', bringPrevious: 'Bring any previous reports', recheck: 'Date to discuss with your doctor', doctorAnswers: "Doctor's answers",
  notMeanTitle: 'What this does NOT mean:', notMeanBody: 'One high or low value on its own is not a diagnosis. Only your doctor can interpret it in context. If you feel unwell, seek care promptly. This tool cannot assess urgency.',
  infoOnly: 'Information only, never a diagnosis',
  languageLabel: 'Language', largeText: 'A+ Large text', normalText: 'Normal text', highContrast: 'High contrast', normalContrast: 'Normal contrast',
  heroTitleA: 'Your lab report,', heroTitleB: 'finally in plain language.',
  lede: 'Built because my Telugu-speaking parents could not read their own lab reports. Upload a report and get the exact values, clear flags and simple sentences you can read to your family, plus a one-page sheet for the doctor.',
  chips: ['Flags computed by code from the printed range', 'AI text is checked; bad text is discarded', 'No account, nothing stored'],
  translateHeading: 'Translate a report', translateHint: 'Try it in one tap with a synthetic example, or drop in your own digital PDF.',
  dropTitle: 'Drop your lab PDF or photo here', dropSub: 'PDF or photo • up to 10 MB',
  trySamplePdf: 'Try an example report',
  doctorSheetBtn: 'Doctor sheet', handoutBtn: 'Large-print handout', listenBtn: 'Listen to summary', stopListenBtn: 'Stop listening', newReportBtn: 'New report',
  chooseFileBtn: 'Choose your report', moreBtn: 'More options',
  guideBtn: 'Listen: how to use this app', guideTitle: 'How to use this app',
  guideSteps: [
    'Pick your language at the top.',
    'Tap the main button to try a sample report, or drop in your own lab report PDF.',
    'Wait a few seconds. You will see each test, your value, and the printed normal range.',
    'Tap "Listen to summary" to hear a summary. Tap "Doctor sheet" to print questions for your doctor.',
    'This app only explains the numbers. It does not diagnose. Please talk to your doctor.',
  ],
  shareBtn: 'Share / copy summary', whatsappBtn: 'Send on WhatsApp', copiedBtn: 'Copied!', clearBtn: 'Clear report', backBtn: 'Back to results', printBtn: 'Print', handoutTitle: 'Your results, in large print',
};

const PACKS: Partial<Record<Language, Pack>> = { te: TE, hi: HI, es: ES };

export const OFFLINE_LANGUAGES = Object.keys(PACKS) as Language[];
export const hasOfflinePack = (lang: Language): boolean => lang in PACKS;
export const uiFor = (lang: Language): Ui => PACKS[lang]?.ui ?? EN_UI;
export const nativeName = (lang: Language): string => PACKS[lang]?.name ?? lang;

/** Flag label for badges: the English word always, plus the local word when a pack exists. */
export function flagLabel(lang: Language, flag: Flag): string {
  const p = PACKS[lang];
  return p ? `${flag} · ${p.flag[flag]}` : flag;
}

export function localExplanation(row: RowLike, lang: Language): string | null {
  const p = PACKS[lang];
  if (!p) return null;
  const noRange = row.ref_low === null && row.ref_high === null;
  if (noRange && row.flag !== 'Unknown') return p.explainMarker(row.test_name, val(row), p.flag[row.flag]);
  return p.explain[row.flag](row.test_name, val(row));
}

export function localSummary(rows: RowLike[], lang: Language): string[] | null {
  const p = PACKS[lang];
  if (!p) return null;
  const flagged = rows.filter((r) => r.flag === 'High' || r.flag === 'Low');
  const normal = rows.filter((r) => r.flag === 'Normal').length;
  const unknown = rows.filter((r) => r.flag === 'Unknown').length;
  const list = flagged.map((r) => `${r.test_name} (${val(r)}, ${p.flag[r.flag]})`).join(', ');
  return [
    flagged.length > 0 ? p.sumFirst(list) : p.sumFirstNone,
    normal > 0 ? p.sumSecond(normal) : p.sumSecondNone,
    unknown > 0 ? p.sumThird(unknown) : p.sumThirdNone,
  ];
}

export function localQuestions(rows: RowLike[], lang: Language): string[] | null {
  const p = PACKS[lang];
  if (!p) return null;
  const qs = rows.filter((r) => r.flag === 'High' || r.flag === 'Low' || r.flag === 'Unknown').slice(0, 3).map((r) => {
    if (r.flag === 'Unknown') return p.qUnknown(r.test_name, val(r));
    const range = describeLocalRange(r, p);
    return range ? p.qRanged(r.test_name, val(r), range) : p.qMarker(r.test_name, val(r), p.flag[r.flag]);
  });
  while (qs.length < 3) qs.push(p.qFiller);
  return qs;
}

function describeLocalRange(r: RowLike, p: Pack): string | null {
  if (r.ref_low !== null && r.ref_high !== null) return p.range.between(r.ref_low, r.ref_high, r.unit);
  if (r.ref_high !== null) return p.range.under(r.ref_high, r.unit);
  if (r.ref_low !== null) return p.range.over(r.ref_low, r.unit);
  return null;
}
