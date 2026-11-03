'use client';

import type { AiInputDisclosure } from '@/lib/types';

// The trust moment: shows the exact data the AI was given for this report.
export function AiSees({ input }: { input: AiInputDisclosure }) {
  const n = input.identifiers_removed;
  const payload = {
    ...(input.photo ? { picture: 'Your (cropped) photo, sent once so the results can be read from it. A picture cannot be redacted.' } : {}),
    results_sent: input.rows,
    ...(input.source_lines.length > 0 ? { result_lines_for_second_check: input.source_lines } : {}),
  };
  return (
    <section className="privacy-badge no-print" aria-label="Privacy">
      <span aria-hidden="true">🔒</span>
      <div>
        <strong>
          {input.photo
            ? 'Only the cropped photo and its test results were sent to the AI.'
            : n > 0 ? `${n} identifier${n === 1 ? '' : 's'} on your report ${n === 1 ? 'was' : 'were'} kept away from the AI.` : 'No identifiers were sent to the AI.'}
        </strong>{' '}
        <span className="muted small">{input.photo ? 'Check the crop covered your name.' : 'The AI never receives the report text, only the result lines below.'}</span>
        {input.lines_withheld > 0 && <div className="muted small">{input.lines_withheld} result line{input.lines_withheld === 1 ? ' was' : 's were'} kept out of the second check because {input.lines_withheld === 1 ? 'it has' : 'they have'} extra text.</div>}
        <details className="ai-sees">
          <summary>What the AI sees</summary>
          <p className="muted small">This is everything the AI is given about this report: test names, values, units and printed ranges{input.source_lines.length > 0 ? ', and each result\u2019s own line' : ''}. The sentences it writes are sent back to it only if you ask for a translation.</p>
          <pre>{JSON.stringify(payload, null, 2)}</pre>
        </details>
      </div>
    </section>
  );
}
