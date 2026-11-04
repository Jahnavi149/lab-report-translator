# Languages

[← Back to README](../README.md)

## The 15 languages

| | | | |
|---|---|---|---|
| English | Telugu · తెలుగు | Hindi · हिन्दी | Spanish · Español |
| Tamil · தமிழ் | Kannada · ಕನ್ನಡ | Bengali · বাংলা | Marathi · मराठी |
| Tagalog | Malay · Bahasa Melayu | Arabic · العربية (right-to-left) | French · Français |
| German · Deutsch | Portuguese · Português | Indonesian · Bahasa Indonesia | |

Every language is also on Muse Voice Transcribe's own language list, so each works for the whole app:

| Feature | Covered in every language |
|---|---|
| Interface | Full translated interface ([`lib/i18n.ts`](../lib/i18n.ts)) |
| Report text | Summary, questions and explanations translated by Muse, checked item by item |
| Voice | Hearing, understanding, spoken replies |
| Doctor sheet | Your language beside the English values; large-print handout; WhatsApp text |
| Identifiers | Labels like name, birth date and ID recognised so they stay out of the AI |

Test names, units and numbers stay as printed so they match the paper report. Arabic switches the whole layout to right-to-left.

## Reports printed in different number styles

The parser decides the style once per report ([`lib/parse.ts`](../lib/parse.ts)):

| Printed | Read as |
|---|---|
| `11.2`, `1,230` | English style: 11.2 and 1230 |
| `11,2`, `250 000`, `250.000` | Decimal-comma style: 11.2 and 250000 |
| `1.234,5` and `1,234.5` | 1234.5 |
| `1,23,4`, `4.5.6` | Never guessed: the line is skipped or marked unreadable |

Range words (`à`, `bis`, `até`, `sampai`, `menos de`, `inférieur à`, ...) and High/Low markers are understood in French, German, Portuguese, Indonesian, Spanish and English. Sample reports in those languages are part of the test suite, including PDFs built with their accented characters.
