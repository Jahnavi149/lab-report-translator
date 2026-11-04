# Scope

[← Back to README](../README.md)

What the app is for, and how it handles the hard cases.

## What it is

An explainer for people who cannot read their own lab report. It repeats the printed values, says inside or outside the printed range, and suggests questions to ask a doctor. It is **not** a medical device, is not clinically validated, and never diagnoses or advises.

## How it handles the hard cases

- **Photos:** identifiers with a label are painted out locally before anything leaves the machine, and the upload screen offers a crop step for a header that has none. Every photo row is marked Needs review and cites the line it came from. Handwriting, signatures, logos, faces and QR codes are not painted out, so crop them away. PDFs are unaffected.
- **Scans:** digital PDFs are read directly. A scanned PDF is refused politely and the person is pointed to the photo upload.
- **Unusual layouts:** a line that cannot be read safely is skipped and listed under "Lines not read", never guessed. That includes results written only in words, such as Negative or Reactive.
- **Limits:** a value printed as `<0.3` or `>60` keeps its sign. It is flagged only when every possible value falls on the same side of the range, and otherwise goes to review.
- **Languages:** the interface text, dialogs, flag labels and server messages in the 14 non-English languages (225 entries each) were reviewed entry by entry by two independent AI models, GPT and Gemini, in repeated rounds. Together they found 111 issues, all fixed, including privacy sentences that left out "selectable", a Telugu script error and the Unknown badge. After the last full round, every changed entry was re-checked by both models until neither found anything left. Tests check that each language keeps every placeholder and still matches the server messages. A native-speaker pass would still be welcome.
- **Voice:** a word the voice lists miss costs one fixed reply, never a wrong answer. Tested in a browser with synthetic speech and through the real transcriber for most languages.
