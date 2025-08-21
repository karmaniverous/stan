/* src/stan/patch/service.ts
 * Patch application service (no Commander). The CLI adapter delegates here.
 */
import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import { utcStamp } from '../util/time';
import { ApplyResult, buildApplyAttempts, runGitApply } from './apply';
import { detectAndCleanPatch } from './clean';
import { resolvePatchContext } from './context';
import { buildFeedbackEnvelope, copyToClipboard } from './feedback';
import { applyWithJsDiff } from './jsdiff';
import { diagnosePatchWithFs, parseUnifiedDiff } from './parse';
import { listRejFiles, moveRejFilesToPatchWorkspace } from './rejects';

type PatchSource =
  | { kind: 'clipboard' }
  | { kind: 'file'; filePath: string }
  | { kind: 'argument'; text: string };

const repoJoin = (cwd: string, p: string): string =>
  p.startsWith('/') ? path.join(cwd, p.slice(1)) : path.resolve(cwd, p);

const readFromClipboard = async (): Promise<string> => {
  const { default: clipboardy } = (await import('clipboardy')) as {
    default: { read: () => Promise<string> };
  };
  return clipboardy.read();
};

const ensureParentDir = async (p: string): Promise<void> => {
  const dir = path.dirname(p);
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    // best-effort
  }
};

const firstKB = (s: string, kb = 4): string =>
  s.length <= kb * 1024 ? s : s.slice(0, kb * 1024);

const pathsFromPatch = (cleaned: string): string[] => {
  const out: string[] = [];
  const re = /^diff --git a\/(.+?) b\/\1/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) {
    const p = m[1]?.trim();
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
};

const pruneSandboxDirs = async (
  sandboxRoot: string,
  keep = 5,
): Promise<void> => {
  try {
    const parent = path.dirname(sandboxRoot);
    const entries = await readdir(parent, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((n) => n !== path.basename(sandboxRoot));
    const stats = await Promise.all(
      dirs.map(async (d) => {
        const full = path.join(parent, d);
        try {
          const s = await stat(full);
          return { name: d, mtimeMs: s.mtimeMs, full };
        } catch {
          return { name: d, mtimeMs: 0, full };
        }
      }),
    );
    stats.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const toDelete = stats.slice(keep);
    await Promise.all(
      toDelete.map((s) => rm(s.full, { recursive: true, force: true })),
    );
  } catch {
    // best-effort
  }
};

export const runPatch = async (
  cwd0: string,
  inputMaybe?: string,
  opts?: { file?: string | boolean; check?: boolean },
): Promise<void> => {
  const { cwd, stanPath, patchAbs, patchRel } = await resolvePatchContext(cwd0);

  // Resolve source precedence
  let source: PatchSource;
  if (typeof inputMaybe === 'string' && inputMaybe.length > 0) {
    source = { kind: 'argument', text: inputMaybe };
  } else if (Object.prototype.hasOwnProperty.call(opts ?? {}, 'file')) {
    const opt = (opts as { file?: string | boolean }).file;
    const src = typeof opt === 'string' && opt.length > 0 ? opt : undefined;
    source = src ? { kind: 'file', filePath: src } : { kind: 'clipboard' };
  } else {
    source = { kind: 'clipboard' };
  }

  let raw = '';

  if (source.kind === 'clipboard') {
    console.log('stan: patch source: clipboard');
    try {
      raw = await readFromClipboard();
    } catch (e) {
      console.error('stan: failed to read clipboard', e);
      return;
    }
  } else if (source.kind === 'argument') {
    console.log('stan: patch source: argument');
    raw = source.text;
  } else {
    const rel = source.filePath;
    console.log(
      `stan: patch source: file "${path.relative(cwd, rel).replace(/\\/g, '/')}"`,
    );
    try {
      raw = await readFile(repoJoin(cwd, rel), 'utf8');
    } catch (e) {
      console.error('stan: failed to read file', e);
      return;
    }
  }

  // Detect & clean (unified diff only), tolerant to surrounding prose
  const cleaned = detectAndCleanPatch(raw);

  // Parse for strip candidates and basic diagnostics
  const parsed = parseUnifiedDiff(cleaned);

  // Write cleaned content to canonical path <stanPath>/patch/.patch
  try {
    await ensureParentDir(patchAbs);
    await writeFile(patchAbs, cleaned, 'utf8');
  } catch (e) {
    console.error('stan: failed to write cleaned patch', e);
    return;
  }

  console.log(`stan: applying patch "${patchRel}"`);

  const check = Boolean(opts?.check);
  const attempts = parsed.stripCandidates.flatMap((p) =>
    buildApplyAttempts(check, p, !check),
  );

  // Track *.rej files created during attempts
  const preRej = await listRejFiles(cwd);
  const result: ApplyResult = await runGitApply(cwd, patchAbs, attempts);

  if (result.ok) {
    console.log(
      check ? 'stan: patch check passed' : 'stan: patch applied (staged)',
    );
    return;
  }

  // jsdiff fallback (unstaged; sandbox when --check)
  const sandboxRoot = check
    ? path.join(path.dirname(patchAbs), '.sandbox', utcStamp())
    : undefined;

  const js = await applyWithJsDiff({
    cwd,
    cleaned,
    check,
    sandboxRoot,
  });

  if (check && sandboxRoot) {
    // keep only the latest few sandboxes
    await pruneSandboxDirs(sandboxRoot, 5);
  }

  if (js.okFiles.length > 0 && js.failed.length === 0) {
    console.log(
      check
        ? 'stan: patch check passed (jsdiff)'
        : 'stan: patch applied via jsdiff (unstaged)',
    );
    return;
  }

  // Diagnostics bundle
  try {
    const debugDir = path.join(path.dirname(patchAbs), '.debug');
    await mkdir(debugDir, { recursive: true });
    await writeFile(path.join(debugDir, 'cleaned.patch'), cleaned, 'utf8');

    const gitAttempts = result.captures.map((c) => ({
      label: c.label,
      code: c.code,
      stderrBytes: Buffer.byteLength(c.stderr ?? '', 'utf8'),
      stdoutBytes: Buffer.byteLength(c.stdout ?? '', 'utf8'),
    }));

    const jsAttempts = {
      okFiles: js.okFiles,
      failedFiles: js.failed.map((f) => f.path),
      sandboxRoot: sandboxRoot ?? null,
    };

    const attemptsPath = path.join(debugDir, 'attempts.json');
    await writeFile(
      attemptsPath,
      JSON.stringify({ git: gitAttempts, jsdiff: jsAttempts }, null, 2),
      'utf8',
    );

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
    console.log(
      `stan: wrote patch diagnostics -> ${attemptsRel} (per-attempt logs under ${debugRel}/)`,
    );
  } catch {
    // best-effort
  }

  // FEEDBACK bundle to clipboard (self-identifying)
  try {
    const changed = pathsFromPatch(cleaned);
    const failedPaths = js.failed.map((f) => f.path);
    const anyOk = js.okFiles.length > 0;
    const overall = check
      ? anyOk
        ? 'check'
        : 'check'
      : anyOk
        ? 'partial'
        : 'failed';

    // Best-effort repo name from package.json (no require())
    let repoName: string | undefined;
    try {
      const rawPkg = await readFile(path.join(cwd, 'package.json'), 'utf8');
      const pkg = JSON.parse(rawPkg) as { name?: string };
      repoName = pkg.name;
    } catch {
      // ignore
    }

    // FS-backed diagnostics from parse (limit to 10 for chat)
    const diagnostics = diagnosePatchWithFs(cwd, parsed).slice(0, 10);

    type Strip = 'p1' | 'p0';
    const stripList: Strip[] = attempts.map((a) =>
      a.strip === 1 ? 'p1' : 'p0',
    );

    // Short last-error snippet from the final git-apply attempt
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

    const envelope = buildFeedbackEnvelope({
      repo: { name: repoName, stanPath },
      status: {
        overall,
        enginesTried: ['git', 'jsdiff'],
        stripTried: Array.from(new Set<Strip>(stripList)),
      },
      summary: { changed, failed: failedPaths, fuzzy: [] },
      patch: { cleanedHead: firstKB(cleaned, 4) },
      attempts: {
        git: {
          tried: result.tried,
          rejects: 0,
          lastCode: result.lastCode,
        },
        jsdiff: {
          okFiles: js.okFiles,
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
    console.log(`stan: wrote patch feedback -> ${fbAbs}`);
    try {
      await copyToClipboard(envelope);
      console.log(`stan: copied patch feedback to clipboard -> ${fbAbs}`);
    } catch {
      console.error(`stan: clipboard copy failed; feedback saved -> ${fbAbs}`);
    }
  } catch {
    // best-effort
  }

  // Move any new *.rej files into <stanPath>/patch/rejects-<ts>/
  let newRejects: string[] = [];
  try {
    const postRej = await listRejFiles(cwd);
    const preSet = new Set(preRej);
    newRejects = postRej.filter((r) => !preSet.has(r));
    const movedTo = await moveRejFilesToPatchWorkspace(cwd, newRejects);
    if (movedTo) {
      console.log(
        `stan: moved ${newRejects.length.toString()} reject file(s) -> ${movedTo}`,
      );
    }
  } catch {
    // best-effort
  }

  console.log(
    `stan: patch ${check ? 'check failed' : 'failed'} (tried: ${result.tried.join(
      ', ',
    )}, jsdiff ok: ${js.okFiles.length.toString()}, failed: ${js.failed.length.toString()})`,
  );
};
