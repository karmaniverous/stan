/* src/stan/patch/run/diagnostics.ts
 * Persist cleaned.patch, attempts.json, and per-attempt stderr/stdout logs.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ApplyResult } from '../apply';
import type { JsDiffOutcome } from '../jsdiff';

export const writePatchDiagnostics = async (args: {
  cwd: string;
  patchAbs: string;
  cleaned: string;
  result: ApplyResult;
  js: JsDiffOutcome | null;
}): Promise<{ attemptsRel: string; debugRel: string }> => {
  const { cwd, patchAbs, cleaned, result, js } = args;
  const debugDir = path.join(path.dirname(patchAbs), '.debug');
  await mkdir(debugDir, { recursive: true });

  // cleaned.patch
  await writeFile(path.join(debugDir, 'cleaned.patch'), cleaned, 'utf8');

  // attempts.json (sizes only for git stderr/stdout)
  const gitAttempts = result.captures.map((c) => ({
    label: c.label,
    code: c.code,
    stderrBytes: Buffer.byteLength(c.stderr ?? '', 'utf8'),
    stdoutBytes: Buffer.byteLength(c.stdout ?? '', 'utf8'),
  }));
  const jsAttempts = {
    okFiles: js?.okFiles ?? [],
    failedFiles: js?.failed.map((f) => f.path) ?? [],
    sandboxRoot: js?.sandboxRoot ?? null,
  };
  const attemptsPath = path.join(debugDir, 'attempts.json');
  await writeFile(
    attemptsPath,
    JSON.stringify({ git: gitAttempts, jsdiff: jsAttempts }, null, 2),
    'utf8',
  );

  // Per-attempt logs
  for (const c of result.captures) {
    const safe = c.label.replace(/[^a-z0-9.-]/gi, '_');
    await writeFile(
      path.join(debugDir, `${safe}.stderr.txt`),
      c.stderr ?? '',
      'utf8',
    );
    await writeFile(
      path.join(debugDir, `${safe}.stdout.txt`),
      c.stdout ?? '',
      'utf8',
    );
  }

  const attemptsRel = path.relative(cwd, attemptsPath).replace(/\\/g, '/');
  const debugRel = path.relative(cwd, debugDir).replace(/\\/g, '/');
  return { attemptsRel, debugRel };
};
