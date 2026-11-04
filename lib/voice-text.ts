import type { Language } from './types';

// The fixed lines the voice assistant says, in every language. Written by code, never by a model, so they are exact and cannot drift:
// the redirect, "which test?", "which question?", and the one-line confirmations for opening a page or switching language.
// The English originals live in lib/voice.ts; the page shows both and speaks the translated one.
//
// These translations have not been reviewed by a native speaker of each language.

export interface VoiceText {
  /** The redirect line: same meaning as REDIRECT_LINE in lib/voice.ts. */
  redirect: string;
  /** Followed by ": Test A / Test B?". */
  whichTest: string;
  /** Followed by ": first / second / third?" using `ordinals`. */
  whichQuestion: string;
  ordinals: [string, string, string];
  openDoctorSheet: string;
  openHandout: string;
  backToResults: string;
  /** "Language: <its own name>". */
  languageWord: string;
}

export const NATIVE_NAME: Record<Language, string> = { en: 'English', te: 'తెలుగు', hi: 'हिन्दी', es: 'Español', ta: 'தமிழ்', kn: 'ಕನ್ನಡ', bn: 'বাংলা', mr: 'मराठी', tl: 'Tagalog', ms: 'Bahasa Melayu', ar: 'العربية', fr: 'Français', de: 'Deutsch', pt: 'Português', id: 'Bahasa Indonesia' };

export const VOICE_TEXT: Record<Exclude<Language, 'en'>, VoiceText> = {
  te: {
    redirect: 'నివేదికలో ముద్రించినదాన్ని మాత్రమే నేను వివరించగలను. ఏం చేయాలి అనే విషయాల కోసం దయచేసి మీ డాక్టర్‌ను అడగండి — ఆ ప్రశ్నను రాసుకోవడానికి నేను సహాయం చేయగలను.',
    whichTest: 'ఏ పరీక్ష గురించి అడుగుతున్నారు', whichQuestion: 'ఏ ప్రశ్న', ordinals: ['మొదటిది', 'రెండవది', 'మూడవది'],
    openDoctorSheet: 'డాక్టర్ షీట్ తెరుస్తున్నాను.', openHandout: 'పెద్ద అక్షరాల ప్రింట్ తెరుస్తున్నాను.', backToResults: 'మీ ఫలితాలకు తిరిగి వెళ్తున్నాను.', languageWord: 'భాష',
  },
  hi: {
    redirect: 'यहाँ सिर्फ़ वही समझाया जा सकता है जो आपकी रिपोर्ट में छपा है। क्या करना है, इसके लिए कृपया अपने डॉक्टर से पूछें — सवाल लिखने में मैं मदद कर सकता हूँ।',
    whichTest: 'आप कौन-सी जाँच पूछ रहे हैं', whichQuestion: 'कौन-सा सवाल', ordinals: ['पहला', 'दूसरा', 'तीसरा'],
    openDoctorSheet: 'डॉक्टर शीट खुल रही है।', openHandout: 'बड़े अक्षरों वाला प्रिंट खुल रहा है।', backToResults: 'आपके नतीजों पर वापस जा रहे हैं।', languageWord: 'भाषा',
  },
  es: {
    redirect: 'Solo puedo explicar lo que está impreso en su informe. Para saber qué hacer, pregunte a su médico; puedo ayudarle a escribir la pregunta.',
    whichTest: '¿Qué prueba quiere decir', whichQuestion: '¿Qué pregunta', ordinals: ['la primera', 'la segunda', 'la tercera'],
    openDoctorSheet: 'Abriendo la hoja para el médico.', openHandout: 'Abriendo la hoja en letra grande.', backToResults: 'Volviendo a sus resultados.', languageWord: 'Idioma',
  },
  ta: {
    redirect: 'உங்கள் அறிக்கையில் அச்சிடப்பட்டதை மட்டுமே என்னால் விளக்க முடியும். என்ன செய்ய வேண்டும் என்பதற்கு, தயவுசெய்து உங்கள் மருத்துவரிடம் கேளுங்கள் — கேள்வியை எழுதிக்கொள்ள நான் உதவ முடியும்.',
    whichTest: 'எந்தப் பரிசோதனை என்று கேட்கிறீர்கள்', whichQuestion: 'எந்தக் கேள்வி', ordinals: ['முதலாவது', 'இரண்டாவது', 'மூன்றாவது'],
    openDoctorSheet: 'டாக்டர் ஷீட்டைத் திறக்கிறேன்.', openHandout: 'பெரிய எழுத்து அச்சைத் திறக்கிறேன்.', backToResults: 'உங்கள் முடிவுகளுக்குத் திரும்புகிறேன்.', languageWord: 'மொழி',
  },
  kn: {
    redirect: 'ನಿಮ್ಮ ವರದಿಯಲ್ಲಿ ಮುದ್ರಿತವಾಗಿರುವುದನ್ನು ಮಾತ್ರ ನಾನು ವಿವರಿಸಬಲ್ಲೆ. ಏನು ಮಾಡಬೇಕು ಎಂಬುದಕ್ಕೆ ದಯವಿಟ್ಟು ನಿಮ್ಮ ವೈದ್ಯರನ್ನು ಕೇಳಿ — ಪ್ರಶ್ನೆಯನ್ನು ಬರೆದುಕೊಳ್ಳಲು ನಾನು ಸಹಾಯ ಮಾಡಬಲ್ಲೆ.',
    whichTest: 'ಯಾವ ಪರೀಕ್ಷೆ ಎಂದು ಕೇಳುತ್ತಿದ್ದೀರಿ', whichQuestion: 'ಯಾವ ಪ್ರಶ್ನೆ', ordinals: ['ಮೊದಲನೆಯದು', 'ಎರಡನೆಯದು', 'ಮೂರನೆಯದು'],
    openDoctorSheet: 'ಡಾಕ್ಟರ್ ಶೀಟ್ ತೆರೆಯುತ್ತಿದ್ದೇನೆ.', openHandout: 'ದೊಡ್ಡ ಅಕ್ಷರದ ಪ್ರಿಂಟ್ ತೆರೆಯುತ್ತಿದ್ದೇನೆ.', backToResults: 'ನಿಮ್ಮ ಫಲಿತಾಂಶಗಳಿಗೆ ಹಿಂತಿರುಗುತ್ತಿದ್ದೇನೆ.', languageWord: 'ಭಾಷೆ',
  },
  bn: {
    redirect: 'আপনার রিপোর্টে যা ছাপা আছে, আমি শুধু সেটুকুই ব্যাখ্যা করতে পারি। কী করতে হবে, সে বিষয়ে অনুগ্রহ করে আপনার ডাক্তারকে জিজ্ঞাসা করুন — প্রশ্নটি লিখে রাখতে আমি সাহায্য করতে পারি।',
    whichTest: 'কোন পরীক্ষার কথা বলছেন', whichQuestion: 'কোন প্রশ্ন', ordinals: ['প্রথমটি', 'দ্বিতীয়টি', 'তৃতীয়টি'],
    openDoctorSheet: 'ডাক্তার শিট খোলা হচ্ছে।', openHandout: 'বড় অক্ষরের প্রিন্ট খোলা হচ্ছে।', backToResults: 'আপনার ফলাফলে ফিরে যাওয়া হচ্ছে।', languageWord: 'ভাষা',
  },
  mr: {
    redirect: 'तुमच्या अहवालात जे छापले आहे तेवढेच मला समजावून सांगता येते. काय करायचे याबद्दल कृपया तुमच्या डॉक्टरांना विचारा — प्रश्न लिहून ठेवण्यात मदत करता येईल.',
    whichTest: 'तुम्ही कोणत्या तपासणीबद्दल विचारत आहात', whichQuestion: 'कोणता प्रश्न', ordinals: ['पहिला', 'दुसरा', 'तिसरा'],
    openDoctorSheet: 'डॉक्टर शीट उघडत आहे.', openHandout: 'मोठ्या अक्षरांतील प्रिंट उघडत आहे.', backToResults: 'तुमच्या निकालांकडे परत जात आहे.', languageWord: 'भाषा',
  },
  tl: {
    redirect: 'Maipapaliwanag ko lang kung ano ang nakalimbag sa iyong ulat. Para sa kung ano ang dapat gawin, mangyaring tanungin ang iyong doktor — matutulungan kitang isulat ang tanong.',
    whichTest: 'Aling pagsusuri ang tinutukoy mo', whichQuestion: 'Aling tanong', ordinals: ['ang una', 'ang pangalawa', 'ang pangatlo'],
    openDoctorSheet: 'Binubuksan ang sheet para sa doktor.', openHandout: 'Binubuksan ang malaking print.', backToResults: 'Bumabalik sa iyong mga resulta.', languageWord: 'Wika',
  },
  ms: {
    redirect: 'Saya hanya boleh menerangkan apa yang tercetak pada laporan anda. Untuk apa yang perlu dilakukan, sila tanya doktor anda — saya boleh membantu menulis soalan itu.',
    whichTest: 'Ujian yang mana yang anda maksudkan', whichQuestion: 'Soalan yang mana', ordinals: ['yang pertama', 'yang kedua', 'yang ketiga'],
    openDoctorSheet: 'Membuka helaian doktor.', openHandout: 'Membuka cetakan besar.', backToResults: 'Kembali ke keputusan anda.', languageWord: 'Bahasa',
  },
  ar: {
    redirect: 'يمكنني فقط شرح ما هو مطبوع في تقريرك. أما فيما يجب فعله، فيرجى سؤال طبيبك — ويمكنني مساعدتك في كتابة السؤال.',
    whichTest: 'أي فحص تقصد', whichQuestion: 'أي سؤال', ordinals: ['الأول', 'الثاني', 'الثالث'],
    openDoctorSheet: 'جارٍ فتح ورقة الطبيب.', openHandout: 'جارٍ فتح الطباعة الكبيرة.', backToResults: 'جارٍ الرجوع إلى نتائجك.', languageWord: 'اللغة',
  },
  fr: {
    redirect: 'Je peux seulement expliquer ce qui est imprimé sur votre rapport. Pour savoir quoi faire, veuillez demander à votre médecin — je peux vous aider à noter la question.',
    whichTest: 'De quelle analyse parlez-vous', whichQuestion: 'Quelle question', ordinals: ['la première', 'la deuxième', 'la troisième'],
    openDoctorSheet: 'J’ouvre la fiche médecin.', openHandout: 'J’ouvre la version en grands caractères.', backToResults: 'Retour à vos résultats.', languageWord: 'Langue',
  },
  de: {
    redirect: 'Ich kann nur erklären, was in Ihrem Bericht steht. Was zu tun ist, fragen Sie bitte Ihren Arzt — ich kann Ihnen helfen, die Frage aufzuschreiben.',
    whichTest: 'Welchen Test meinen Sie', whichQuestion: 'Welche Frage', ordinals: ['die erste', 'die zweite', 'die dritte'],
    openDoctorSheet: 'Ich öffne das Arztblatt.', openHandout: 'Ich öffne den Großdruck.', backToResults: 'Zurück zu Ihren Ergebnissen.', languageWord: 'Sprache',
  },
  pt: {
    redirect: 'Só posso explicar o que está impresso no seu relatório. Para saber o que fazer, pergunte ao seu médico — posso ajudar a anotar a pergunta.',
    whichTest: 'De qual exame você está falando', whichQuestion: 'Qual pergunta', ordinals: ['a primeira', 'a segunda', 'a terceira'],
    openDoctorSheet: 'Abrindo a folha do médico.', openHandout: 'Abrindo a folha em letra grande.', backToResults: 'Voltando aos seus resultados.', languageWord: 'Idioma',
  },
  id: {
    redirect: 'Saya hanya bisa menjelaskan apa yang tercetak di laporan Anda. Untuk apa yang harus dilakukan, silakan tanya dokter Anda — saya bisa membantu menuliskan pertanyaannya.',
    whichTest: 'Pemeriksaan yang mana yang Anda maksud', whichQuestion: 'Pertanyaan yang mana', ordinals: ['yang pertama', 'yang kedua', 'yang ketiga'],
    openDoctorSheet: 'Membuka lembar dokter.', openHandout: 'Membuka cetakan huruf besar.', backToResults: 'Kembali ke hasil Anda.', languageWord: 'Bahasa',
  },
};
