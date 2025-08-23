/* src/stan/patch/run/feedback.ts
 * Build and persist FEEDBACK envelope; copy to clipboard with clear logging.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { cyan, green, red, yellow } from '@/stan/util/color';

import type { ApplyResult } from '../apply';
import { buildFeedbackEnvelope, copyToClipboard } from '../feedback';
import type { JsDiffOutcome } from '../jsdiff';
import type { ParsedDiffInfo } from '../parse';
import { diagnosePatchWithFs } from '../parse';

export const persistFeedbackAndClipboard = async (args: {
  cwd: string;
  stanPath: string;
  patchAbs: string;
  cleaned: string;
  parsed: ParsedDiffInfo | null;
  result: ApplyResult;
  js: JsDiffOutcome | null;
  changedFromHeaders: string[];
  check: boolean;
}): Promise<string | null> => {
  const {
    cwd,
    stanPath,
    patchAbs,
    cleaned,
    parsed,
    result,
    js,
    changedFromHeaders,
    check,
  } = args;

  // Repo name (best-effort) for envelope header
  let repoName: string | undefined;
  try {
    const rawPkg = await readFile(path.join(cwd, 'package.json'), 'utf8');
    const pkg = JSON.parse(rawPkg) as { name?: string };
    repoName = pkg.name;
  } catch {
    // ignore
  }

  // Diagnostics (FS-backed) — cap list for chat UX
  const diagnostics = parsed
    ? diagnosePatchWithFs(cwd, parsed).slice(0, 10)
    : [];

  type Strip = 'p1' | 'p0';
  const stripList: Strip[] = result.tried.map((label) =>
    /-p1$/.test(label) ? 'p1' : 'p0',
  );

  // Last error snippet from trailing git attempt
  let lastErrorSnippet = '';
  if (result.captures.length > 0) {
    const last = result.captures[result.captures.length - 1];
    lastErrorSnippet = (last.stderr ?? '')
      .split(/\r?\n/)
      .slice(0, 2)
      .join(' ')
      .trim()
      .slice(0, 200);
  }

  const failedPaths = js?.failed.map((f) => f.path) ?? [];
  const anyOk = (js?.okFiles?.length ?? 0) > 0;
  const overall = check ? 'check' : anyOk ? 'partial' : 'failed';

  const envelope = buildFeedbackEnvelope({
    repo: { name: repoName, stanPath },
    status: {
      overall,
      enginesTried: ['git', 'jsdiff'],
      stripTried: Array.from(new Set<Strip>(stripList)),
    },
    summary: { changed: changedFromHeaders, failed: failedPaths, fuzzy: [] },
    patch: {
      cleanedHead: cleaned.slice(0, Math.min(4 * 1024, cleaned.length)),
    },
    attempts: {
      git: {
        tried: result.tried,
        rejects: 0,
        lastCode: result.lastCode,
      },
      jsdiff: {
        okFiles: js?.okFiles ?? [],
        failedFiles: failedPaths,
      },
    },
    lastErrorSnippet,
    diagnostics,
  });

  const debugDir = path.join(path.dirname(patchAbs), '.debug');
  await mkdir(debugDir, { recursive: true });
  const fbPath = path.join(debugDir, 'feedback.txt');
  await writeFile(fbPath, envelope, 'utf8');
  const fbAbs = fbPath.replace(/\\/g, '/');
  console.log(`${yellow('stan: wrote patch feedback')} -> ${cyan(fbAbs)}`);

  // Tolerate undefined returns from copy helpers as success.
  let copied = false;
  try {
    const res = await copyToClipboard(envelope);
    copied = res !== false;
  } catch {
    copied = false;
  }
  if (copied) {
    console.log(green('stan: copied patch feedback to clipboard'));
  } else {
    console.log(
      `${red('stan: clipboard copy failed')}; feedback saved -> ${cyan(fbAbs)}`,
    );
  }
  return fbAbs;
};
