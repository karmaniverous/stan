/** src/stan/preflight.ts
 * Preflight checks run at the start of `stan run`:
 * - Warn when local system prompt drifts from packaged baseline.
 * - Nudge to run `stan init` after upgrades when packaged docs changed.
 */

import { getVersionInfo } from './version';

/** Run preflight and print warnings (non-interactive). */
export const preflightDocsAndVersion = async (cwd: string): Promise<void> => {
  const v = await getVersionInfo(cwd);

  // Drift warning (downstream repos should avoid editing system prompt)
  if (!v.systemPrompt.inSync) {
    console.warn(
      'stan: warning: local system prompt differs from packaged baseline.',
    );
    console.warn(
      '      Edits in downstream repos will be overwritten by `stan init`.',
    );
    console.warn(
      '      Move customizations to <stanPath>/system/stan.project.md instead.',
    );
  }

  // Post-upgrade nudge when packaged docs changed (based on recorded install version)
  if (v.packageVersion && v.docsMeta?.version) {
    const prev = v.docsMeta.version;
    const cur = v.packageVersion;
    if (prev !== cur) {
      console.log(
        `stan: docs baseline has changed since last install (${prev} -> ${cur}).`,
      );
      console.log('      Run `stan init` to update prompts in your repo.');
    }
  }
};
