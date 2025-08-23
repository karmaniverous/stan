/* src/stan/patch/git-status.ts
 * Staged-overlap warning for patched files.
 */
import { runGit } from '../snap/git';

export const maybeWarnStaged = async (
  cwd: string,
  touchedRel: string[],
): Promise<void> => {
  if (!touchedRel.length) return;
  try {
    const res = await runGit(cwd, ['diff', '--cached', '--name-only', '-z']);
    if (res.code !== 0) return;
    const staged = res.stdout
      .split('\u0000')
      .filter((s) => s.length > 0)
      .map((s) => s.replace(/\\/g, '/'));
    const touched = touchedRel.map((s) => s.replace(/\\/g, '/'));
    const overlap = touched.filter((p) => staged.includes(p));
    if (overlap.length > 0) {
      console.warn(
        `stan: warning: ${overlap.length.toString()} patched file(s) appear staged; STAN does not stage automatically.\n` +
          `      To unstage: git restore --staged ${overlap.map((p) => (p.includes(' ') ? `"${p}"` : p)).join(' ')}`,
      );
    }
  } catch {
    // best-effort
  }
};
