'use client';

import type { AiInputDisclosure } from '@/lib/types';

// The trust moment: shows the exact data the AI was given for this report.
export function AiSees({ input }: { input: AiInputDisclosure }) {
  const n = input.identifiers_removed;
  const payload = {
    ...(input.photo ? { picture: 'The cleaned photo shown below, sent once so the results can be read from it.' } : {}),
    results_sent: input.rows,
    ...(input.source_lines.length > 0 ? { result_lines_for_second_check: input.source_lines } : {}),
  };
  const kinds = input.removed_kinds.length > 0 ? ` (${input.removed_kinds.join(', ')})` : '';
  return (
    <section className="privacy-badge no-print" aria-label="Privacy">
      <span aria-hidden="true">🔒</span>
      <div>
        <strong>
          {input.photo
            ? n > 0 ? `Your photo was cleaned before it was sent: ${n} ${n === 1 ? 'area' : 'areas'} with labelled personal details ${n === 1 ? 'was' : 'were'} painted out${kinds}.` : 'Your photo was checked before it was sent: no labelled personal details were found on it.'
            : n > 0 ? `${n} identifier${n === 1 ? '' : 's'} on your report ${n === 1 ? 'was' : 'were'} kept away from the AI.` : 'No identifiers were sent to the AI.'}
        </strong>{' '}
        <span className="muted small">
          {input.photo ? 'The cleaned picture was read again to make sure nothing that was painted could still be made out. A name printed with no label cannot be found automatically, so trim it away before uploading.' : 'The AI never receives the report text, only the result lines below.'}
          {input.engine === 'patterns+model' ? ' Checked by pattern rules and an optional evaluation model on this server.' : input.engine === 'patterns' ? ' Checked by pattern rules, on this server.' : ''}
        </span>
        {input.lines_withheld > 0 && <div className="muted small">{input.lines_withheld} result line{input.lines_withheld === 1 ? ' was' : 's were'} kept out of the second check because {input.lines_withheld === 1 ? 'it has' : 'they have'} extra text.</div>}
        <details className="ai-sees">
          <summary>What the AI sees</summary>
          <p className="muted small">This is everything the AI is given about this report: {input.photo ? 'the cleaned photo, ' : ''}test names, values, units and printed ranges{input.source_lines.length > 0 ? ', and each result\u2019s own line' : ''}. The sentences it writes are sent back to it only if you ask for a translation.</p>
          {input.photo_preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="ai-photo" src={input.photo_preview} alt="The cleaned photo that was sent to the AI. Black boxes cover personal details." />
          )}
          <pre>{JSON.stringify(payload, null, 2)}</pre>
        </details>
      </div>
    </section>
  );
}
