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
- **Languages and voice:** the interface text, translations and voice word lists were checked by tests and in a browser in all 15 languages. A native-speaker pass is the next step. A word the voice lists miss costs one fixed reply, never a wrong answer.
