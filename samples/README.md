# Sample files

[← Back to README](../README.md)

Every name, number and address in these files is **invented**. Upload them to the app (or drag them in) to see each feature. Each was run through the real app with Meta's Muse; "what you should see" is what came back.

| File | What it shows | What you should see |
|---|---|---|
| [`01-two-page-report.pdf`](01-two-page-report.pdf) | A realistic two-page report with a header full of identifiers | 18 results, all with a citation. Click **View** on a page-2 result and the viewer opens on page 2. Name, MRN, birth date, phone and email are removed before the AI sees the text (open **What the AI sees**) |
| [`02-french-decimal-commas.pdf`](02-french-decimal-commas.pdf) | French labels, `11,2` decimal commas and `1.230` with a dot as thousands separator | `Hémoglobine 11.2`, `Glycémie à jeun 1.26`, `Triglycérides 1230`. The Muse second check did not confirm the thousands-separator row in our runs, so it was marked **Needs review** (the AI is not deterministic; either outcome is safe) |
| [`03-flags-without-ranges.pdf`](03-flags-without-ranges.pdf) | Results that print only the words High or Low, with no range | Every row is marked **Needs review**. The flag is copied from the printed word (never guessed), and the review dialog says so. The row with no word is Unknown |
| [`04-phone-photo.jpg`](04-phone-photo.jpg) | A tilted, shadowed, slightly blurred phone photo | The trim step appears first. Six results, every one marked **Needs review** (photos cannot be checked against text). Most rows can be outlined in the photo viewer |
| [`05-scanned-no-text.pdf`](05-scanned-no-text.pdf) | A PDF that is only a picture, with no text | A polite message asking you to upload it as an image instead |
| [`06-not-a-lab-report.pdf`](06-not-a-lab-report.pdf) | A pancake recipe | A polite message that no lab results were found. Nothing is invented |

More: [`public/sample-report.pdf`](../public/sample-report.pdf) is the "Try an example report" file, [`public/sample-photo.png`](../public/sample-photo.png) is the same page as a photo, and [`fixtures/phi/`](../fixtures/phi) has six invented photos with names and IDs for the privacy checks.

Regenerate with `npm run samples` (macOS).
