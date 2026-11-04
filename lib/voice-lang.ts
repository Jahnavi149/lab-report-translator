import type { Language } from './types';

// Voice vocabulary for Tamil, Kannada, Bengali, Marathi, Tagalog, Malay, Arabic, French, German, Portuguese and Indonesian, plus a few extra phrasings for Telugu, Hindi, Spanish and English.
// Plain regex source strings, joined into the matchers in lib/voice.ts. Code decides what a question means by keywords alone.
//
// The safe direction is always the same: a missing word costs one redirect line, but a missing word in a DENY list could let an
// advice question reach the one-sentence explainer. That is why the deny lists are broad (they also match inside longer words),
// and why every explanation Muse writes is still checked by lib/safety.ts whatever the question was.
//
// Written without a native-speaker review. The transcripts these were calibrated against came from Muse Voice Transcribe on
// synthetic Tamil, Kannada, Bengali, Spanish, Malay, Tagalog and Arabic speech; Marathi has no test voice here, so its lists are unproven on speech.
// Latin-script words (Tagalog, Malay, French, German, Portuguese, Indonesian) carry word boundaries (\b) because they are short and sit inside English words; Arabic is matched as substrings
// after lib/voice.ts folds alef/ya/ta-marbuta spellings and drops diacritics, the same way the question is folded.
// ZWJ and ZWNJ are stripped before matching (lib/voice.ts), so none are written here.

/** Advice, diagnosis, risk, diet, medicine, "is it normal", "how do I lower it", causes: all of these are handed back to the doctor. */
export const DENY_EXTRA = [
  // Tamil
  'செய்ய வேண்டும்|செய்யலாமா|செய்ய வேண்டுமா|வேண்டுமா|வேண்டும்|லாமா|சாப்பிட|குடிக்க|மருந்து|மாத்திரை|டேப்லெட்|நீரிழிவு|சர்க்கரை நோய்|புற்றுநோய்|ஆபத்து|ஆபத்தான|தீவிர|கவலை|பயம்|சிகிச்சை|உணவு|டயட்|ஆரோக்கிய|நோய்|உடல்நல|இயல்பா|சாதாரணமா|சரியா|பரவாயில்லை|குறைக்க|அதிகரிக்க|கூட்ட|காரணம்|சப்ளிமெண்ட்|எடுத்துக்|எடுக்க|ஆபத்|பாதிப்பு|ஒகேவா|நல்லதா|கெட்டதா|குணப்படுத்|தடுக்|தவிர்க்|ணுமா|பண்ணலாமா|பண்ண|மருத்துவம்',
  // Kannada
  'ಮಾಡಬೇಕು|ಮಾಡಬೇಕೇ|ಮಾಡಲೇ|ಮಾಡಬಹುದೇ|ಬೇಕು|ಬೇಕೇ|ತಿನ್ನ|ಕುಡಿಯ|ಔಷಧ|ಮಾತ್ರೆ|ಟ್ಯಾಬ್ಲೆಟ್|ಮಧುಮೇಹ|ಸಕ್ಕರೆ ಕಾಯಿಲೆ|ಕ್ಯಾನ್ಸರ್|ಅಪಾಯ|ಗಂಭೀರ|ತೀವ್ರ|ಚಿಂತೆ|ಭಯ|ಚಿಕಿತ್ಸೆ|ಆಹಾರ|ಡಯಟ್|ಆರೋಗ್ಯ|ರೋಗ|ಕಾಯಿಲೆ|ಸಾಮಾನ್ಯ|ಅಸಾಮಾನ್ಯ|ಸರಿಯೇ|ಸರಿಯಾಗಿದೆಯೇ|ಇಳಿಸ|ಹೆಚ್ಚಿಸ|ಕಾರಣ|ಸಪ್ಲಿಮೆಂಟ್|ತೆಗೆದುಕೊಳ್ಳ|ಬೇಕಾ|ಮಾಡಬಹುದಾ|ಒಳ್ಳೆಯದೇ|ಕೆಟ್ಟದ್ದೇ|ಗುಣಪಡಿಸ|ತಡೆ|ತಪ್ಪಿಸ|ಸಮಸ್ಯೆ',
  // Bengali
  'করা উচিত|করব|করবো|করতে হবে|উচিত|দরকার|প্রয়োজন|খাব|খাওয়া|খেতে|পান করব|ওষুধ|ট্যাবলেট|বড়ি|ডায়াবেটিস|মধুমেহ|ক্যান্সার|ঝুঁকি|বিপজ্জনক|গুরুতর|চিন্তা|ভয়|চিকিৎসা|খাবার|খাদ্য|ডায়েট|স্বাস্থ্য|রোগ|অসুখ|স্বাভাবিক|অস্বাভাবিক|সাধারণ|ঠিক আছে|কমাতে|বাড়াতে|কারণ|সাপ্লিমেন্ট|নিতে হবে|নেব|ভালো|খারাপ|সমস্যা|প্রতিরোধ|এড়ি|সারাতে|নিরাময়|করা যায়|খাওয়া যাবে',
  // Marathi
  'करावे|करू का|घ्यावे|घ्यावी|घ्यायची|खावे|खाऊ|प्यावे|पिऊ|औषध|गोळी|गोळ्या|टॅबलेट|मधुमेह|कर्करोग|कॅन्सर|धोका|धोकादायक|गंभीर|काळजी|भीती|उपचार|आहार|डाएट|आरोग्य|तब्येत|आजार|रोग|सामान्य|असामान्य|ठीक|योग्य|कमी करण्या|वाढवण्या|कारण|सप्लिमेंट|हवे|हवी|पाहिजे|लागेल|लागते|चांगले|वाईट|समस्या|टाळ|बरे|बरा|करता येईल|खाता येईल|चालेल',
  // Tagalog
  String.raw`\b(dapat|kailangan|puwede ba|pwede ba|maaari ba|inumin|uminom|kumain|kain|pagkain|gamot|pildoras|suplemento\w*|kanser|mapanganib|panganib|delikado|seryoso|malubha|nag ?aalala|alala\w*|takot|lunas|gamutin|paggamot|diyeta|kalusugan|malusog|karamdaman|sakit|maayos|ayos lang|mabuti|masama|bawasan|pababain|pataasin|dagdagan|sanhi|dahilan|paano (ko|ba|mapapababa|mapapataas)|ano ang (dapat|gagawin)|ano ang gagawin|gagawin|mamatay|kamatayan)\b`,
  // Malay
  String.raw`\b(patut\w*|perlu\w*|mesti\w*|kena|haruskah|boleh saya|bolehkah|boleh tak|boleh ke|apa (yang )?(patut|nak buat|perlu)|makan\w*|minum\w*|ubat\w*|pil|suplemen\w*|kencing manis|kanser|barah|bahaya\w*|berbahaya|serius|risiko|bimbang|risau|takut|rawat\w*|makanan|kesihatan|sihat|penyakit|sakit|tidak normal|baik|elok|teruk|buruk|kurangkan|turunkan|naikkan|tingkatkan|sebab|punca|bagaimana (nak|untuk|saya)|macam mana nak|cara (nak|untuk)|mati|kematian)\b`,
  // Arabic (matched after alef/ya/ta-marbuta folding, so these are written in their plain forms)
  'هل يجب|هل ينبغي|هل اتناول|هل اخذ|هل استطيع|هل يمكنني|هل يمكن ان|ماذا افعل|ماذا يجب|كيف اخفض|كيف ارفع|كيف اعالج|يجب|ينبغي|اتناول|آكل|اكل|اشرب|شرب|دواء|ادوية|حبوب|اقراص|مكمل|سكري|سرطان|خطر|خطير|خطوره|جدي|عاجل|طوارئ|قلق|خوف|علاج|اعالج|حميه|نظام غذائي|غذاء|طعام|صحه|صحي|صحيح|مرض|امراض|طبيعي|غير طبيعي|عادي|بخير|سليم|جيد|سيء|اخفض|ارفع|خفض|رفع|سبب|اسباب|اموت|موت|وفاه|تشخيص|عدوى|التهاب',
  // French, German, Portuguese, Indonesian (Latin script; accents are folded before matching)
  String.raw`\b(dois|doit|devrais|devrait|devons|il faut|faut il|(puis|peux|dois|doit) (je|on)|que faire|quoi faire|qu est ce que je (dois|peux)|comment (faire|puis|baisser|augmenter|reduire|ameliorer|soigner|traiter|diminuer)|conseil\w*|avis|recommand\w*|suggere\w*|risque\w*|danger\w*|grave\w*|serieu\w*|urgen\w*|inquiet\w*|inquietude|peur|angoiss\w*|normal\w*|anormal\w*|bon|mauvais|bien|mal|sain|sante|malade\w*|maladie\w*|cancer\w*|diabet\w*|diagnostic\w*|symptome\w*|cause\w*|parce que|regime\w*|manger|boire|aliment\w*|nourriture|complement\w*|comprime\w*|gelule\w*|medicament\w*|medicat\w*|traitement\w*|traiter|soigner|guerir|therapie\w*|remede\w*|exercice\w*|chirurgie|injection\w*|sirop|pommade|tisane|baisser|augmenter|reduire|ameliorer|eviter|arreter|commencer|critique|severe\w*|mourir|mort)\b`,
  String.raw`\b(soll\w*|muss\w*|musste\w*|darf\w*|durf\w*|kann ich|konnte ich|was (tun|mache|machen|soll)|wie (kann|soll|senke|erhohe|behandle|behandeln|senken|erhohen)|rat|rate|rat\w+|empfehl\w*|empfiehl\w*|vorschlag\w*|meinung|risik\w*|gefahr\w*|ernst\w*|schlimm\w*|dringend\w*|notfall\w*|sorge\w*|sorgen|angst\w*|normal\w*|unnormal\w*|in ordnung|gut|schlecht|gesund\w*|ungesund\w*|krank\w*|krebs\w*|diabet\w*|zuckerkrank\w*|diagnos\w*|symptom\w*|ursache\w*|grund|weil|ernahr\w*|diat\w*|essen|trinken|nahrung\w*|lebensmittel\w*|nahrungsergan\w*|tablette\w*|pille\w*|kapsel\w*|medikament\w*|medizin\w*|arznei\w*|dosis|dosier\w*|rezept\w*|behandl\w*|therap\w*|heil\w*|mittel|sport|ubung\w*|operation\w*|spritze\w*|saft|salbe|tee|senk\w*|erhoh\w*|steiger\w*|verbesser\w*|vermeid\w*|aufhor\w*|anfangen|beginnen|kritisch\w*|schwer\w*|besser|schlechter|sterben|tod)\b`,
  String.raw`\b(devo|deve|devia|deveria|posso|poderia|preciso|tenho que|tem que|o que (fazer|faco|devo|posso)|como (fazer|posso|devo|baixar|diminuir|aumentar|melhorar|tratar|reduzir)|conselho\w*|aconselh\w*|recomend\w*|sugest\w*|sugir\w*|opiniao|risco\w*|perigo\w*|grave\w*|gravidade|serio\w*|urgen\w*|emergencia\w*|preocup\w*|medo|ansios\w*|normal\w*|anormal\w*|bom|mau|ruim|bem|saudavel|saude|doente\w*|doenca\w*|cancer\w*|cancro|diabet\w*|diagnostic\w*|sintoma\w*|causa\w*|porque|por que|dieta\w*|comer|beber|comida\w*|alimento\w*|alimentacao|suplemento\w*|comprimido\w*|capsula\w*|pilula\w*|remedio\w*|medicament\w*|medicac\w*|dose\w*|dosagem|receita\w*|tratamento\w*|tratar|curar|cura|terapia\w*|exercicio\w*|cirurgia\w*|injecao|xarope|pomada|cha|baixar|diminuir|aumentar|melhorar|reduzir|evitar|parar|comecar|critic\w*|severo\w*|melhor|pior|morrer|morte)\b`,
  String.raw`\b(harus\w*|perlu\w*|sebaiknya|boleh\w*|bolehkah|apa yang (harus|perlu|sebaiknya|bisa saya)|bagaimana (cara|saya|agar|supaya)|cara (menurunkan|menaikkan|mengobati|mengatasi|meningkatkan)|saran\w*|anjur\w*|rekomendasi\w*|usul\w*|pendapat|risiko\w*|bahaya\w*|berbahaya|serius|parah|gawat|darurat|mendesak|khawatir|cemas|takut|kuatir|normal\w*|abnormal|baik|buruk|jelek|sehat|kesehatan|sakit|penyakit|kanker|diabetes|kencing manis|diagnos\w*|gejala|penyebab|sebab|karena|diet|makan\w*|minum\w*|makanan|suplemen\w*|tablet|pil|kapsul|obat\w*|dosis|resep|pengobatan|mengobati|terapi|sembuh\w*|olahraga|latihan|operasi|suntik\w*|sirup|salep|jamu|menurunkan|menaikkan|meningkatkan|mengurangi|memperbaiki|menghindari|berhenti|mulai|kritis|berat|lebih baik|lebih buruk|mati|kematian)\b`,
].join('|');

export const NAV_VERB_EXTRA = [
  'மாற்று|மாற்றுங்கள்|திற|திறக்க|காட்டு|காண்பி|செல்லு|போ|திரும்பு|கொண்டு செல்',
  'ಬದಲಿಸ|ಬದಲಾಯಿಸ|ತೆರೆ|ತೋರಿಸ|ಹೋಗ|ಹಿಂದಕ್ಕೆ|ಹಿಂತಿರುಗ',
  'বদল|বদলান|খোল|খুলুন|দেখান|দেখাও|যান|যাও|ফিরে',
  'बदला|बदल|उघडा|उघड|दाखवा|दाखव|जा|चला|परत',
  String.raw`\b(palitan|baguhin|buksan|ipakita|pumunta|bumalik|ibalik|dalhin|tukar\w*|ubah|buka|tunjuk\w*|pergi|kembali|bawa saya)\b`,
  String.raw`\b(montre\w*|affiche\w*|ouvre\w*|ouvrir|va|aller|retour\w*|reviens|revenir|change\w*|passe\w*|asse|mets|mettre|emmene\w*|bascule\w*|zeig\w*|offne\w*|geh|gehe|gehen|zuruck\w*|wechs\w*|ander\w*|schalt\w*|bring\w*|ubersetz\w*|mostr\w*|exib\w*|abr\w*|abra|va|ir|volt\w*|retorn\w*|mud\w*|troc\w*|alter\w*|leve|leva|coloqu\w*|passar|tunjuk\w*|perlihatkan|tampilkan|buka\w*|pergi|kembali|balik|ganti\w*|ubah|pindah\w*|bawa\w*|alihkan|gunakan)\b`,
  'غير|بدل|حول|افتح|اعرض|ارني|اظهر|اذهب|ارجع|رجوع|خذني|خدني|انتقل',
].join('|');

/** The doctor sheet is named by "doctor" alone in these languages: the transcriber mangles the word "sheet" (ஷீட்கார்ட், ಶೀತ್, শিখ). */
// "ಡಾ " ends in a space on purpose: the matcher sees "ಡಾ. ಶೀತ್" as "ಡಾ ಶೀತ್" (punctuation becomes a space).
export const DOCTOR_SHEET_EXTRA = 'డాక్టర్|క్టర్|டாக்டர்|மருத்துவர்|ಡಾಕ್ಟರ್|ಡಾ |ವೈದ್ಯ|ডাক্তার|डॉक्टर|डाक्टर|الطبيب|طبيب|دكتور|الدكتور|' + String.raw`\bdoktor\b|\bdoctor sheet\b|sheet para sa doktor|\bmedecin\b|\bdocteur\b|\barzt\w*|\barztin\b|\bmedico\b|\bmedica\b|\bdoutor\b|\bdokter\b|lembar dokter`;
export const HANDOUT_EXTRA = 'பெரிய எழுத்து|ದೊಡ್ಡ ಅಕ್ಷರ|বড় অক্ষর|বড় হরফ|मोठ्या अक्षर|मोठे अक्षर|मोठा प्रिंट|' + String.raw`malaking print|malaking letra|malalaking letra|malaking sulat|cetakan besar|cetak besar|tulisan besar|huruf besar` + '|خط كبير|طباعه كبيره|حروف كبيره|ورقه كبيره|طباعه بخط|' + String.raw`grands? caracteres|gros caracteres|grande police|gros texte|grossdruck|gro[sß]druck|gro[sß]e schrift|gro[sß]e buchstaben|letras? grandes?|texto grande|impressao grande|huruf besar|cetak(an)? besar|tulisan besar|teks besar`;
export const RESULTS_EXTRA = 'முடிவு|ಫಲಿತಾಂಶ|ফলাফল|निकाल|परिणाम|' + String.raw`\bresulta\b|\bkeputusan\b|\bhasil\b` + '|النتائج|نتائج|نتيجه|' + String.raw`\bresultats?\b|\bergebnis\w*|\bbefund\w*|\bresultados?\b|\bhasil\b`;

// Latin spellings are there because the transcriber sometimes writes an Indic word in Latin letters ("Saramsam చెప్పు").
export const SUMMARY_EXTRA = 'saramsam|saaramsam|saransh|saramsh|sarangsh|surukkam|sangraham|சுருக்கம்|சுருக்க|சுறுக்|ಸಾರಾಂಶ|ಸಂಕ್ಷಿಪ್ತ|সারাংশ|সারসংক্ষেপ|थोडक्यात|' + String.raw`\bbuod\b|\blagom\b|\bringkasan\b|\brumusan\b` + '|ملخص|الملخص|خلاصه|' + String.raw`\bresume\b|\bsynthese\b|\bzusammenfassung\b|\bfazit\b|\bresumo\b|\bsumario\b|\bsintese\b|\brangkuman\b|\bintisari\b`;
export const QUESTION_EXTRA = 'கேள்வி|ಪ್ರಶ್ನೆ|প্রশ্ন|' + String.raw`\btanong\b|\bmga tanong\b|\bsoalan\b` + '|سؤال|اسئله|الاسئله|السؤال|' + String.raw`\bfrages?\b|\bperguntas?\b|\bpertanyaan\b|\btanya\b`;

/** "What does it mean", "what is", "how much", "how is". Still needs a test name to count as a question about a result. */
export const EXPLAIN_EXTRA = [
  'அர்த்தம்|என்றால் என்ன|என்ன|விளக்க|சொல்லு|சொல்லுங்கள்|பற்றி|எவ்வளவு|எப்படி இருக்கு',
  'ಅರ್ಥ|ಅಂದರೆ|ಎಂದರೇನು|ಏನು|ವಿವರಿಸ|ಹೇಳಿ|ಬಗ್ಗೆ|ಎಷ್ಟು|ಹೇಗಿದೆ',
  'মানে|কী|কি|ব্যাখ্যা|বলুন|বলো|সম্পর্কে|কত|কেমন',
  'म्हणजे|अर्थ|काय|समजाव|सांगा|बद्दल|किती|कसा|कसे',
  String.raw`\b(ibig sabihin|ano ang|ano ba|ano po|ano yung|ipaliwanag|sabihin mo|sabihin|tungkol sa|magkano|gaano|maksud|bermaksud|apakah|apa itu|apa maksud|terangkan|jelaskan|beritahu|tentang|berapa)\b`,
  'معنى|يعني|ما هو|ما هي|ما هى|اشرح|وضح|اخبرني|أخبرني|قل لي|كيف حال|كم |عن ',
  // French, German, Portuguese, Indonesian
  String.raw`\b(signifie\w*|veut dire|expliqu\w*|dis moi|dites moi|parle moi|c est quoi|qu est ce (que|qu)|quel est|quelle est|combien|comment (va|est|sont)|que dit|bedeut\w*|erklar\w*|klare|was (ist|sind|heisst|heist|sagt)|sag mir|erzahl\w*|wie (hoch|niedrig|viel)|wieviel|significa\w*|quer dizer|explic\w*|me diga|diga me|fale|o que (e|sao|diz)|qual e|quanto|como esta|artinya|arti|maksud|jelas\w*|terangkan|beri tahu|beritahu|ceritakan|tentang|berapa|bagaimana (dengan|kabar)|apa (itu|arti|maksud|artinya))\b`,
  // more ways to ask in languages that already worked
  'ఎలా ఉంది|ఎంత ఉంది|ఎంత|कितना|कितनी|कैसा|कैसी|como esta|cuanto|cual es|how is|how are|how much',
].join('|');

/** First, second and third, as ordinals only (a bare "one" or "एक" is far too common a word). */
export const ORDINALS_EXTRA: [string, string, string] = [
  'முதல்|முதலாவது|ಮೊದಲ|ಒಂದನೇ|ಆದ್ಯ|প্রথম|पहिला|पहिली|पहिले|पहिल्या|\\buna\\b|\\bunang\\b|\\bpertama\\b|الاول|اول|الاولى|الاولي|\\bpremiere?\\b|\\b1er\\b|\\berste\\w*|\\bprimeir[ao]\\b',
  'இரண்டாவது|இரண்டாம்|ಎರಡನೇ|ಎರಡನೆಯ|দ্বিতীয়|दुसरा|दुसरी|दुसरे|दुसऱ्या|\\bpangalawa\\b|\\bkedua\\b|الثاني|الثانيه|الثانية|ثاني|\\bdeuxieme\\b|\\bseconde\\b|\\bzweite\\w*|\\bsegund[ao]\\b',
  'மூன்றாவது|மூன்றாம்|ಮೂರನೇ|ಮೂರನೆಯ|তৃতীয়|तिसरा|तिसरी|तिसरे|तिसऱ्या|\\bpangatlo\\b|\\bketiga\\b|الثالث|الثالثه|الثالثة|ثالث|\\btroisieme\\b|\\bdritte\\w*|\\bterceir[ao]\\b',
];

/** Spoken names for common tests, in the scripts the transcriber produces. The Latin name is added to the question so it finds the report row. */
export const ALIASES_EXTRA: [string, string][] = [
  ['ஹீமோகுளோபின்|ஹீமோக்ளோபின்|ஹீமோகிளோபின்|ஹிமோகுளோபின்|ஹெமோகுளோபின்|ஹீமோகுலோபின்|ಹಿಮೋಗ್ಲೋಬಿನ್|ಹೀಮೋಗ್ಲೋಬಿನ್|ಹೆಮೋಗ್ಲೋಬಿನ್|ಹಿಮೊಗ್ಲೋಬಿನ್|ಹಿಮೋಗ್ಲೊಬಿನ್|হিমোগ্লোবিন|হেমোগ্লোবিন|হিমোগ্লবিন|हेमोग्लोबिन', 'hemoglobin'],
  ['கொலஸ்ட்ரால்|கொலஸ்டிரால்|கொலஸ்ட்ரோல்|ಕೊಲೆಸ್ಟ್ರಾಲ್|ಕೊಲೆಸ್ಟರಾಲ್|ಕೊಲೆಸ್ಟ್ರೋಲ್|কোলেস্টেরল|কলেস্টেরল|কোলেস্টরল|कोलेस्टेरॉल|कोलेस्ट्रॉल|कोलेस्टेरोल', 'cholesterol'],
  ['குளுக்கோஸ்|சர்க்கரை|சுகர்|ஷுகர்|ಗ್ಲೂಕೋಸ್|ಗ್ಲುಕೋಸ್|ಸಕ್ಕರೆ|ಶುಗರ್|ಷುಗರ್|গ্লুকোজ|সুগার|শর্করা|ग्लुकोज|ग्लूकोज|साखर|शुगर', 'glucose'],
  ['வைட்டமின் டி|விட்டமின் டி|வைட்டமின் d|ವಿಟಮಿನ್ ಡಿ|ভিটামিন ডি|ভিটামিন-ডি|व्हिटॅमिन डी|विटामिन डी|व्हिटामिन डी', 'vitamin d'],
  ['ஃபெரிடின்|ஃபெரிட்டின்|பெரிடின்|ಫೆರಿಟಿನ್|ಫೆರಿಟಿನ್|ফেরিটিন|ফেরিটিন|फेरीटिन', 'ferritin'],
  ['கிரியேட்டினின்|கிரியாட்டினின்|கிரியேட்டினீன்|ಕ್ರಿಯಾಟಿನಿನ್|ಕ್ರಿಯೇಟಿನಿನ್|ক্রিয়েটিনিন|ক্রিয়াটিনিন|क्रिएटिनिन|क्रिएटिनीन|क्रियाटिनिन', 'creatinine'],
  ['சோடியம்|ಸೋಡಿಯಂ|ಸೋಡಿಯಮ್|সোডিয়াম|সোডিয়ম', 'sodium'],
  ['பொட்டாசியம்|பொட்டாஷியம்|ಪೊಟ್ಯಾಸಿಯಮ್|ಪೊಟಾಶಿಯಂ|পটাসিয়াম|পটাশিয়াম|पोटॅशियम|पोटेशियम', 'potassium'],
  ['பிளேட்லெட்|தட்டணு|ಪ್ಲೇಟ್ಲೆಟ್|ಪ್ಲೇಟ್ಲೆಟ್ಸ್|প্লেটলেট|प्लेटलेट', 'platelets'],
  ['ட்ரைகிளிசரைடு|டிரைகிளிசரைட்ஸ்|ட்ரைகிளிசரைட்|ಟ್ರೈಗ್ಲಿಸರೈಡ್|ಟ್ರೈಗ್ಲಿಸೆರೈಡ್|ট্রাইগ্লিসারাইড|ট্রাইগ্লিসেরাইড|ट्रायग्लिसराइड|ट्रायग्लिसेराइड', 'triglycerides'],
  // Tagalog and Malay mostly say the English name; these are the local spellings. Arabic speakers write the names in Arabic script.
  [String.raw`\bkolesterol\b|سترول|ستيرول`, 'cholesterol'],
  [String.raw`\bglukosa\b|\bgula darah\b|\bgula\b|\basukal\b|جلوكوز|غلوكوز|سكر الدم|\bالسكر\b|سكر`, 'glucose'],
  [String.raw`\bbitamina d\b|\bvitamin d\b|فيتامين د|فيتامين دي|فيتامين ديه`, 'vitamin d'],
  [String.raw`\bferitin\b|فيريتين|فريتين`, 'ferritin'],
  [String.raw`\bkreatinin\w*|\bcreatinin\b|كرياتينين|كرياتنين|كرياتين`, 'creatinine'],
  [String.raw`\bnatrium\b|صوديوم`, 'sodium'],
  [String.raw`\bkalium\b|بوتاسيوم`, 'potassium'],
  [String.raw`\bplatlet\w*|\bplatelet\b|\bkeping darah\b|صفائح`, 'platelets'],
  [String.raw`\btrigliserid\w*|ثلاثي الجليسريد|ثلاثيات الجليسريد|ثلاثي الجلسريد|تراي جلسرايد|ترايجليسريد|ترايغليسريد|دهون ثلاثيه`, 'triglycerides'],
  [String.raw`\btiroid\b|\btiroyd\b|الدرقيه|الغده الدرقيه|ثايرويد|ثيرويد|ثايرويد`, 'thyroid'],
  [String.raw`جلوبين|غلوبين|خضاب الدم`, 'hemoglobin'],
  // French, German, Portuguese, Indonesian: local spellings of common test names
  [String.raw`\bhemoglobine\b|\bhamoglobin\b`, 'hemoglobin'],
  [String.raw`\bcholesterin\b`, 'cholesterol'],
  [String.raw`\bglycemie\b|\bsucre\b|\bglukose\b|\bblutzucker\b|\bzucker\b|\bglicose\b|\bglicemia\b|\bacucar\b`, 'glucose'],
  [String.raw`\bvitamine d\b`, 'vitamin d'],
  [String.raw`\bferritine\b`, 'ferritin'],
  [String.raw`\bcreatinine\b|\bkreatinin\b`, 'creatinine'],
  [String.raw`\bpotassio\b`, 'potassium'],
  [String.raw`\bplaquettes?\b|\bthrombozyten\b|\btrombosit\b`, 'platelets'],
  [String.raw`\btriglycerides?\b|\btriglyzeride\b|\btrigliceride\w*\b`, 'triglycerides'],
  [String.raw`\bthyroide\b|\bschilddruse\b|\btireoide\b|\btiroide\b`, 'thyroid'],
  ['தைராய்டு|தைரொய்டு|ಥೈರಾಯ್ಡ್|ಥೈರಾಯಿಡ್|থাইরয়েড|থাইরোয়েড|थायरॉईड|थायरॉइड|थायरॉयड', 'thyroid'],
];

/**
 * Every language's name in every script it might be transcribed in, so "switch to Tamil" works whatever the user's own language.
 * Indic names are stems without the final vowel sign or virama, because they take endings (தமிழுக்கு, മലയാളത്തിലേക്ക്, ಹಿಂದಿಗೆ).
 */
export const LANGUAGE_NAME_FORMS: Record<Language, string> = {
  en: String.raw`\benglish\b|\bingles\b|\binggeris\b|\binggris\b|\banglais\b|\benglisch\b|\bingles\b|\bingleza\b|ఇంగ్లీష్|इंग्लिश|अंग्रेज|இங்கிலீஷ்|ஆங்கில|ಇಂಗ್ಲಿಷ್|ಆಂಗ್ಲ|ইংরেজি|ইংলিশ|इंग्रजी|انجليز|انكليز`,
  te: String.raw`\btelugu\b|\btelougou\b|\btelugo\b|తెలుగు|तेलुगु|तेलुगू|தெலுங்கு|ತೆಲುಗು|তেলুগু|تيلوغو|تيلوجو|تلغو|تيلوقو`,
  hi: String.raw`\bhindi\b|హిందీ|హింది|हिन्दी|हिंदी|இந்தி|ಹಿಂದಿ|হিন্দি|هندي`,
  es: String.raw`\bspanish\b|\bespanol\b|\bespanyol\b|\bsepanyol\b|\bspanyol\b|\bcastellano\b|\bespagnol\b|\bspanisch\b|\bespanhol\b|స్పానిష్|स्पेनिश|ஸ்பானிஷ்|ಸ್ಪ್ಯಾನಿಷ್|স্প্যানিশ|स्पॅनिश|اسباني|اسبان`,
  ta: String.raw`\btamil\b|\btamoul\b|తమిళ|तमिल|தமிழ|ತಮಿಳ|ತಮಿಳಿ|তামিল|तमिळ|تاميل`,
  kn: String.raw`\bkannada\b|కన్నడ|कन्नड|கன்னட|ಕನ್ನಡ|কন্নড|كانادا|كنادا`,
  bn: String.raw`\bbengali\b|\bbangla\b|\bbenggali\b|\bbengalisch\b|బెంగాలీ|बंगाली|வங்காள|ಬಂಗಾಳಿ|বাংলা|بنغالي|بنجالي|بنغال`,
  mr: String.raw`\bmarathi\b|\bmarata\b|మరాఠీ|मराठी|மராத்தி|ಮರಾಠಿ|মারাঠি|ماراثي`,
  tl: String.raw`\btagalog\b|\bfilipino\b|\bpilipino\b|టగాలోగ్|టగలాగ్|तागालोग|टगालोग|தகலாக்|தகாலாக்|ತಗಾಲೋಗ್|তাগালগ|تاغالوغ|تاجالوج|تاغالوج|فلبين`,
  ms: String.raw`\bmalay\b|\bmelayu\b|\bbahasa melayu\b|\bmalaysian\b|\bmalais\b|\bmalaiisch\b|\bmalaio\b|మలయ్|मलय|மலாய்|ಮಲಯ್|মালয়|ملايو|ملايي|ماليزي`,
  ar: String.raw`\barabic\b|\barabe\b|\barab\b|\barabik\b|\barabisch\b|అరబిక్|అరబ్బీ|अरबी|அரபு|அரபிக்|ಅರೇಬಿಕ್|ಅರಬಿ|আরবি|عربي`,
  fr: String.raw`\bfrench\b|\bfrancais\b|\bfranzosisch\b|\bfrances\b|\bperancis\b|\bprancis\b|\bpranses\b|\bfrancese\b|ఫ్రెంచ్|फ्रेंच|फ्रांसीसी|பிரெஞ்சு|பிரஞ்சு|ಫ್ರೆಂಚ್|ফরাসি|ফ্রেঞ্চ|فرنسي|فرنسيه`,
  de: String.raw`\bgerman\b|\bdeutsch\b|\ballemand\b|\balemao\b|\baleman\b|\bjerman\b|\bdeutschen\b|జర్మన్|जर्मन|ஜெர்மன்|ஜெர்மனி|ಜರ್ಮನ್|জার্মান|الماني|المانيه`,
  pt: String.raw`\bportuguese\b|\bportugues\b|\bportugais\b|\bportugiesisch\b|\bportugis\b|\bportuges\b|పోర్చుగీస్|पुर्तगाली|पोर्तुगीज|போர்த்துகீசிய|போர்ச்சுகீசிய|ಪೋರ್ಚುಗೀಸ್|পর্তুগিজ|برتغالي|برتغاليه`,
  id: String.raw`\bindonesian\b|\bindonesien\b|\bindonesisch\b|\bindonesio\b|\bindonesia\b|\bbahasa indonesia\b|\bindones\b|ఇండోనేషియన్|ఇండోనేషియా|इंडोनेशियाई|इंडोनेशियन|இந்தோனேசிய|ಇಂಡೋನೇಷಿಯನ್|ইন্দোনেশীয়|اندونيسي|اندونيسيه`,
};
