/* src/stan/patch/detect.ts
 * Early-input detection helpers for patch service.
 */
export const isFeedbackEnvelope = (s: string): boolean =>
  /^\s*BEGIN[_ ]STAN[_ ]PATCH[_ ]FEEDBACK\b/i.test(s);

export const seemsUnifiedDiff = (t: string): boolean =>
  /^diff --git /m.test(t) ||
  (/^---\s+(?:a\/|\S)/m.test(t) &&
    /^\+\+\+\s+(?:b\/|\S)/m.test(t) &&
    /^@@\s+-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/m.test(t));
