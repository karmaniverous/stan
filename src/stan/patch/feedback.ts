/* src/stan/patch/feedback.ts
 * Build and copy a self-identifying feedback packet for failed/partial patch applications.
 * The packet contains no imperative instructions; stan.system.md defines the assistant’s behavior.
 */

type FeedbackStatus = 'failed' | 'partial' | 'fuzzy' | 'check';

export type FeedbackEnvelope = {
  repo: { name?: string; stanPath?: string };
  status: {
    overall: FeedbackStatus;
    enginesTried: string[];
    stripTried: Array<'p1' | 'p0'>;
  };
  summary: { changed: string[]; failed: string[]; fuzzy?: string[] };
  diagnostics?: Array<{ file: string; causes: string[]; details: string[] }>;
  patch: { cleanedHead: string };
  attempts: {
    git?: { tried: string[]; rejects: number; lastCode: number };
    jsdiff?: { okFiles?: string[]; failedFiles?: string[] };
    dmp?: { okFiles?: string[] };
  };
  /** Optional, short human-readable stderr excerpt from the last failing git-apply attempt. */
  lastErrorSnippet?: string;
};

/** Build a BEGIN_STAN_PATCH_FEEDBACK v1 packet as plain text. */
export const buildFeedbackEnvelope = (e: FeedbackEnvelope): string => {
  const lines: string[] = [];
  lines.push('BEGIN_STAN_PATCH_FEEDBACK v1');
  lines.push('');
  lines.push(`repo: ${JSON.stringify(e.repo)}`);
  lines.push(
    `status: ${JSON.stringify({
      overall: e.status.overall,
      enginesTried: e.status.enginesTried,
      stripTried: e.status.stripTried,
    })}`,
  );
  lines.push(
    `summary: ${JSON.stringify({
      changed: e.summary.changed ?? [],
      failed: e.summary.failed ?? [],
      fuzzy: e.summary.fuzzy ?? [],
    })}`,
  );
  if (e.diagnostics && e.diagnostics.length) {
    lines.push(`diagnostics: ${JSON.stringify(e.diagnostics)}`);
  }
  // Keep the head small (few KB) for chat tools
  lines.push(
    `patch: ${JSON.stringify({
      cleanedHead: e.patch.cleanedHead,
    })}`,
  );
  if (e.lastErrorSnippet && e.lastErrorSnippet.length) {
    lines.push(`lastErrorSnippet: ${JSON.stringify(e.lastErrorSnippet)}`);
  }
  lines.push(
    `attempts: ${JSON.stringify({
      git: e.attempts.git,
      jsdiff: e.attempts.jsdiff,
      dmp: e.attempts.dmp,
    })}`,
  );
  lines.push('');
  lines.push('END_STAN_PATCH_FEEDBACK');
  return lines.join('\n');
};

/** Copy text to system clipboard (best-effort; no throw). */
export const copyToClipboard = async (text: string): Promise<void> => {
  try {
    const { default: clipboardy } = (await import('clipboardy')) as {
      default: { write: (t: string) => Promise<void> };
    };
    await clipboardy.write(text);
  } catch {
    // best-effort
  }
};
