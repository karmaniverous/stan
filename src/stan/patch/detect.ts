/* src/stan/patch/detect.ts
 * Early-input detection helpers for patch service.
 */
/**
 * Detect whether the text contains a BEGIN_STAN_PATCH_FEEDBACK envelope.
 *
 * @param s - Input text to scan.
 * @returns True when a feedback envelope header is found.
 */
export const isFeedbackEnvelope = (s: string): boolean =>
  /^\s*BEGIN[_ ]STAN[_ ]PATCH[_ ]FEEDBACK\b/i.test(s);

/**
 * Heuristic check whether the text appears to be a plain unified diff.
 * Looks for git-style or minimal unified-diff headers and hunk markers.
 *
 * @param t - Input text to test.
 * @returns True if the content resembles a unified diff.
 */
export const seemsUnifiedDiff = (t: string): boolean =>
  /^diff --git /m.test(t) ||
  (/^---\s+(?:a\/|\S)/m.test(t) &&
    /^\+\+\+\s+(?:b\/|\S)/m.test(t) &&
    /^@@\s+-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/m.test(t));
