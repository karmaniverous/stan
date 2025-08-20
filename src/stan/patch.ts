/* src/cli/stan/patch.ts
 * "stan patch" subcommand: apply a patch from clipboard / file / inline input.
 * - Default: read unified diff from clipboard; write cleaned content to <stanPath>/diff/.patch, then apply (staged).
 * - -f, --file [filename]: read from file (unified diff); cleaned content is still written to the canonical <stanPath>/diff/.patch.
 * - -c, --check: run git apply --check (validate only). No staging, no changes.
 * - Detection & cleanup:
 *   - Remove chat wrappers or BEGIN/END banners only when they wrap the entire payload.
 *   - Try extracting the first fenced code block containing a unified diff; otherwise slice from the first diff marker; strip trailing closing fences.
 *   - Normalize EOL to LF; ensure trailing newline; do not alter whitespace within lines.
 * - Apply strategy (staged by default):
 *   - For apply: include --index and try strip p=1 then p=0 across:
 *     1) --3way --whitespace=nowarn --recount
 *     2) --3way --ignore-whitespace --recount
 *     3) --reject --whitespace=nowarn --recount
 *   - For --check: same sets but with --check and without --index.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Command } from 'commander';

import { applyCliSafety } from '@/cli/stan/cli-utils';

import { findConfigPathSync, loadConfig } from './config';
import { makeStanDirs } from './paths';

type PatchSource =
  | { kind: 'clipboard' }
  | { kind: 'file'; filePath: string }
  | { kind: 'argument'; text: string };

const repoJoin = (cwd: string, p: string): string =>
  p.startsWith('/') ? path.join(cwd, p.slice(1)) : path.resolve(cwd, p);

/** Unwrap only outer chat fences/banners if they wrap the entire payload. */
const unwrapChatWrappers = (text: string): string => {
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i += 1;
  let j = lines.length - 1;
  while (j >= 0 && lines[j].trim() === '') j -= 1;

  if (i > j) return text;

  const first = lines[i].trim();
  const last = lines[j].trim();

  const isFence = (s: string) => /^```/.test(s);
  const isBegin = (s: string) => /^BEGIN[_ -]?PATCH/i.test(s);
  const isEnd = (s: string) => /^END[_ -]?PATCH/i.test(s);

  const unwrapIf = (cond: boolean): string => {
    if (!cond) return text;
    const inner = lines.slice(i + 1, j);
    return [...lines.slice(0, i), ...inner, ...lines.slice(j + 1)].join('\n');
  };

  if (isFence(first) && isFence(last)) return unwrapIf(true);
  if (isBegin(first) && isEnd(last)) return unwrapIf(true);
  return text;
};

const stripZeroWidthAndNormalize = (s: string): string => {
  const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;
  const noZW = s.replace(ZERO_WIDTH_RE, '');
  const lf = noZW.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return lf.endsWith('\n') ? lf : lf + '\n';
};

const ensureFinalNewline = (s: string): string =>
  s.endsWith('\n') ? s : s + '\n';

const looksLikeUnifiedDiff = (t: string): boolean => {
  if (/^diff --git /m.test(t)) return true;
  if (/^---\s+(?:a\/|\S)/m.test(t) && /^\+\+\+\s+(?:b\/|\S)/m.test(t))
    return true;
  if (/^@@\s+-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/m.test(t)) return true;
  return false;
};

const extractFencedUnifiedDiff = (text: string): string | null => {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const open = lines[i];
    const m = open.match(/^`{3,}.*$/);
    if (!m) continue;
    const tickCount = (open.match(/^`+/) ?? [''])[0].length;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (new RegExp(`^\\\`${'{'}${tickCount}{'}'}\\s*$`).test(lines[j])) {
        const inner = lines.slice(i + 1, j).join('\n');
        if (looksLikeUnifiedDiff(inner)) return inner;
        i = j;
        break;
      }
    }
  }
  return null;
};

const extractRawUnifiedDiff = (text: string): string | null => {
  let idx = text.search(/^diff --git /m);
  if (idx < 0) idx = text.search(/^---\s+(?:a\/|\S)/m);
  if (idx < 0) return null;
  const body = text.slice(idx);
  const trimmed = body.replace(/\n`{3,}\s*$/m, '\n');
  return trimmed;
};

const detectAndCleanPatch = (input: string): string => {
  const pre = stripZeroWidthAndNormalize(input.trim());
  const maybeUnwrapped = unwrapChatWrappers(pre);
  const normalized = stripZeroWidthAndNormalize(maybeUnwrapped);

  const fenced = extractFencedUnifiedDiff(normalized);
  if (fenced)
    return ensureFinalNewline(stripZeroWidthAndNormalize(fenced).trimEnd());

  const raw = extractRawUnifiedDiff(normalized);
  if (raw) return ensureFinalNewline(stripZeroWidthAndNormalize(raw).trimEnd());

  return ensureFinalNewline(normalized);
};

const readFromClipboard = async (): Promise<string> => {
  const { default: clipboardy } = (await import('clipboardy')) as {
    default: { read: () => Promise<string> };
  };
  return clipboardy.read();
};

const ensureParentDir = async (p: string): Promise<void> => {
  const dir = path.dirname(p);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
};

type ApplyAttempt = {
  args: string[];
  strip: number;
  label: string;
};

type AttemptCapture = {
  label: string;
  code: number;
  stdout: string;
  stderr: string;
};

type ApplyResult = {
  ok: boolean;
  tried: string[];
  lastCode: number;
  captures: AttemptCapture[];
};

const buildApplyAttempts = (
  check: boolean,
  strip: number,
  stage: boolean,
): ApplyAttempt[] => {
  const base = check ? ['--check'] : stage ? ['--index'] : [];
  const with3WayNowarn: ApplyAttempt = {
    args: [
      ...base,
      '--3way',
      '--whitespace=nowarn',
      '--recount',
      `-p${strip.toString()}`,
    ],
    strip,
    label: `3way-nowarn-p${strip.toString()}`,
  };
  const with3WayIgnore: ApplyAttempt = {
    args: [
      ...base,
      '--3way',
      '--ignore-whitespace',
      '--recount',
      `-p${strip.toString()}`,
    ],
    strip,
    label: `3way-ignore-p${strip.toString()}`,
  };
  const withReject: ApplyAttempt = {
    args: [
      ...base,
      '--reject',
      '--whitespace=nowarn',
      '--recount',
      `-p${strip.toString()}`,
    ],
    strip,
    label: `reject-nowarn-p${strip.toString()}`,
  };
  return [with3WayNowarn, with3WayIgnore, withReject];
};

const runGitApply = async (
  cwd: string,
  patchFileAbs: string,
  attempts: ApplyAttempt[],
): Promise<ApplyResult> => {
  const tried: string[] = [];
  const captures: AttemptCapture[] = [];

  for (const att of attempts) {
    tried.push(att.label);

    const code = await new Promise<number>((resolveP) => {
      const child = spawn('git', ['apply', ...att.args, patchFileAbs], {
        cwd,
        shell: false,
        windowsHide: true,
      });

      let so = '';
      let se = '';

      const cp = child as unknown as {
        stdout?: NodeJS.ReadableStream;
        stderr?: NodeJS.ReadableStream;
      };
      cp.stderr?.on('data', (d: Buffer) => {
        const s = d.toString('utf8');
        se += s;
        if (process.env.STAN_DEBUG === '1') process.stderr.write(s);
      });
      cp.stdout?.on('data', (d: Buffer) => {
        const s = d.toString('utf8');
        so += s;
        if (process.env.STAN_DEBUG === '1') process.stdout.write(s);
      });

      child.on('close', (c) => {
        captures.push({
          label: att.label,
          code: c ?? 0,
          stdout: so,
          stderr: se,
        });
        resolveP(c ?? 0);
      });
    });

    if (code === 0) {
      return { ok: true, tried, lastCode: 0, captures };
    }
    if (process.env.STAN_DEBUG === '1') {
      console.error(`stan: git apply failed for ${att.label} (exit ${code})`);
    }
  }
  return { ok: false, tried, lastCode: 1, captures };
};

const resolvePatchContext = async (
  cwd0: string,
): Promise<{
  cwd: string;
  stanPath: string;
  patchAbs: string;
  patchRel: string;
}> => {
  const cfgPath = findConfigPathSync(cwd0);
  const cwd = cfgPath ? path.dirname(cfgPath) : cwd0;

  let stanPath = '.stan';
  try {
    const cfg = await loadConfig(cwd);
    stanPath = cfg.stanPath;
  } catch {
    // default used
  }
  const dirs = makeStanDirs(cwd, stanPath);
  const patchAbs = path.join(dirs.diffAbs, '.patch');
  const patchRel = path.relative(cwd, patchAbs).replace(/\\/g, '/');
  return { cwd, stanPath, patchAbs, patchRel };
};

export const registerPatch = (cli: Command): Command => {
  applyCliSafety(cli);

  const sub = cli
    .command('patch')
    .description(
      'Apply a git patch from clipboard (default) or a file (with -f). Accepts unified diff.',
    )
    .argument('[input]', 'Patch data (unified diff)')
    .option('-f, --file [filename]', 'Read patch from file as source')
    .option('-c, --check', 'Validate patch without applying any changes');

  applyCliSafety(sub);

  sub.action(
    async (
      inputMaybe?: string,
      opts?: { file?: string | boolean; check?: boolean },
    ) => {
      const { cwd, patchAbs, patchRel } = await resolvePatchContext(
        process.cwd(),
      );

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

      let raw: string;

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

      // Write cleaned content to canonical path <stanPath>/diff/.patch
      try {
        await ensureParentDir(patchAbs);
        await writeFile(patchAbs, cleaned, 'utf8');
      } catch (e) {
        console.error('stan: failed to write cleaned patch', e);
        return;
      }

      console.log(`stan: applying patch "${patchRel}"`);

      const check = Boolean(opts?.check);
      const hasAB =
        /^(---|\+\+\+)\s+(a\/|b\/)/m.test(cleaned) ||
        /^diff --git a\//m.test(cleaned);
      const stripsFirst = hasAB ? [1, 0] : [0, 1];

      const attempts = stripsFirst.flatMap((p) =>
        buildApplyAttempts(check, p, !check),
      );

      const result = await runGitApply(cwd, patchAbs, attempts);

      if (result.ok) {
        console.log(
          check ? 'stan: patch check passed' : 'stan: patch applied (staged)',
        );
        return;
      }

      // Diagnostics bundle
      try {
        const debugDir = path.join(path.dirname(patchAbs), '.patch.debug');
        await mkdir(debugDir, { recursive: true });
        await writeFile(path.join(debugDir, 'cleaned.patch'), cleaned, 'utf8');
        await writeFile(
          path.join(debugDir, 'attempts.json'),
          JSON.stringify(
            result.captures.map((c) => ({
              label: c.label,
              code: c.code,
              stderrBytes: Buffer.byteLength(c.stderr, 'utf8'),
              stdoutBytes: Buffer.byteLength(c.stdout, 'utf8'),
            })),
            null,
            2,
          ),
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
        console.log(
          `stan: wrote patch diagnostics -> ${path
            .relative(cwd, debugDir)
            .replace(/\\/g, '/')}`,
        );
      } catch {
        // best-effort
      }

      console.log(
        `stan: patch ${check ? 'check failed' : 'failed'} (tried: ${result.tried.join(
          ', ',
        )})`,
      );
    },
  );

  return cli;
};
