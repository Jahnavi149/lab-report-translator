// Text a family member can paste or send. Only what the report already shows: the summary and the questions.
// Nothing here adds, interprets or advises.
export interface ShareInput {
  title: string;
  summary: string[];
  questions: string[];
  questionsHeading: string;
  disclaimer: string;
  synthetic: boolean;
}

export function buildShareText(i: ShareInput): string {
  return [
    i.title,
    '',
    ...i.summary,
    '',
    `${i.questionsHeading}:`,
    ...i.questions.map((q, n) => `${n + 1}. ${q}`),
    '',
    `${i.disclaimer}${i.synthetic ? ' (SYNTHETIC sample)' : ''}`,
  ].join('\n');
}

/** Opens WhatsApp (app or web) with the text pre-filled; the user chooses the recipient and presses send. */
export const whatsappUrl = (text: string): string => `https://wa.me/?text=${encodeURIComponent(text)}`;
