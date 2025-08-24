/* src/stan/patch/git-status.ts
 * Staged-overlap check (disabled).
 *
 * Rationale: warning adds noise without actionable value; users can
 * manage staging themselves. Retained as a no-op for API stability.
 */

export const maybeWarnStaged = async (
  _cwd: string,
  _touchedRel: string[],
): Promise<void> => {
  // Intentionally no-op.
};
