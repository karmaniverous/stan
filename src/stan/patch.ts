/* src/cli/stan/patch.ts
 * "stan patch" subcommand: apply a patch from clipboard / file / inline input.
 * - Default: read unified diff from clipboard; write cleaned content to defaultPatchFile, then apply.
 * - -f, --file [filename]: read from file (unified diff); if filename missing, defaults to config.defaultPatchFile.
 *   Clean the content and write back to the same file before applying.
 * - -c, --check: run git apply --check (no changes); still perform detection/cleanup and write the cleaned output to the target file path.
 * - Detection & cleanup:
 *   - Remove chat wrappers (outer code fences or BEGIN/END banners) only when they wrap the entire payload.
 *   - Also robustly EXTRACT a unified diff when the message includes additional text:
 *     • Prefer the first fenced code block (>=3 backticks) that contains unified-diff markers.
 *     • Otherwise slice from the first “diff --git …” or “--- …” marker to the end.
 *     • Strip any trailing closing code-fence lines.
 *   - Normalize EOL to LF; ensure trailing newline; do not alter whitespace within lines.
 * - Permissive apply strategy:
 *   - Try sequences over strip levels p=1 then p=0:
 *     1) --3way --whitespace=nowarn
 *     2) --3way --ignore-whitespace
 *     3) --reject --whitespace=nowarn
 *   - For --check, use --check with the same sets; stop on first success.
 * - Repo-root anchoring for “/path” remains supported for file paths.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Command } from 'commander';

import { applyCliSafety } from '@/cli/stan/cli-utils';

import { findConfigPathSync, loadConfig } from './config';

type PatchSource =
  | { kind: 'clipboard' }
  | { kind: 'file'; filePath: string }
  | { kind: 'argument'; text: string };

const repoJoin = (cwd: string, p: string): string =>
  p.startsWith('/') ? path.join(cwd, p.slice(1)) : path.resolve(cwd, p);

/** Unwrap only outer chat fences/banners if they wrap the entire payload.
 * Preserve any interior lines (e.g., "+`\`\``" within diff hunks).
 */
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
  // Remove BOM + zero-width chars; normalize CRLF to LF
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

/** Extract the first fenced code block (>=3 backticks) that contains unified diff markers. */
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

/** Extract from raw markers (first diff --git or ---/+++). Strip trailing closing fences if present. */
const extractRawUnifiedDiff = (text: string): string | null => {
  let idx = text.search(/^diff --git /m);
  if (idx < 0) idx = text.search(/^---\s+(?:a\/|\S)/m);
  if (idx < 0) return null;
  const body = text.slice(idx);

  // remove trailing closing code-fence lines if present at the very end
  const trimmed = body.replace(/\n`{3,}\s*$/m, '\n');
  return trimmed;
};

const detectAndCleanPatch = (input: string): string => {
  // Normalize first so searches are consistent
  const pre = stripZeroWidthAndNormalize(input.trim());
  // If the entire payload is wrapped, unwrap once, then normalize again
  const maybeUnwrapped = unwrapChatWrappers(pre);
  const normalized = stripZeroWidthAndNormalize(maybeUnwrapped);

  // 1) Prefer fenced code blocks that contain a unified diff
  const fenced = extractFencedUnifiedDiff(normalized);
  if (fenced)
    return ensureFinalNewline(stripZeroWidthAndNormalize(fenced).trimEnd());

  // 2) Otherwise slice from raw diff markers
  const raw = extractRawUnifiedDiff(normalized);
  if (raw) return ensureFinalNewline(stripZeroWidthAndNormalize(raw).trimEnd());

  // 3) Fall back to normalized text (git will error; diagnostics will be saved)
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

/** Build tolerant git apply attempts for a given strip level.
 * NOTE: Include --recount to recompute hunk header line counts (tolerates line-number drift).
 */
const buildApplyAttempts = (check: boolean, strip: number): ApplyAttempt[] => {
  const base = check ? ['--check'] : [];
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
      if (cp.stderr) {
        cp.stderr.on('data', (d: Buffer) => {
          const s = d.toString('utf8');
          se += s;
          if (process.env.STAN_DEBUG === '1') process.stderr.write(s);
        });
      }
      if (cp.stdout) {
        cp.stdout.on('data', (d: Buffer) => {
          const s = d.toString('utf8');
          so += s;
          if (process.env.STAN_DEBUG === '1') process.stdout.write(s);
        });
      }

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

const resolveWorkingCwdAndConfig = async (
  cwd0: string,
): Promise<{
  cwd: string;
  defaultPatchFile: string;
}> => {
  const cfgPath = findConfigPathSync(cwd0);
  const cwd = cfgPath ? path.dirname(cfgPath) : cwd0;

  let defaultPatchFile = '/stan.patch';
  try {
    const cfg = await loadConfig(cwd);
    defaultPatchFile = cfg.defaultPatchFile ?? '/stan.patch';
  } catch {
    // fall back to default
  }
  return { cwd, defaultPatchFile };
};

export const registerPatch = (cli: Command): Command => {
  applyCliSafety(cli);

  const sub = cli
    .command('patch')
    .description(
      'Apply a git patch from clipboard (default) or a file (with -f). Accepts unified diff.',
    )
    .argument('[input]', 'Patch data (unified diff)')
    .option(
      '-f, --file [filename]',
      'Read patch from file (defaults to config.defaultPatchFile)',
    )
    .option('-c, --check', 'Validate patch without applying any changes');

  applyCliSafety(sub);

  sub.action(
    async (
      inputMaybe?: string,
      opts?: { file?: string | boolean; check?: boolean },
    ) => {
      const cwd0 = process.cwd();
      const { cwd, defaultPatchFile } = await resolveWorkingCwdAndConfig(cwd0);

      // Resolve source precedence
      let source: PatchSource;
      if (typeof inputMaybe === 'string' && inputMaybe.length > 0) {
        source = { kind: 'argument', text: inputMaybe };
      } else if (Object.prototype.hasOwnProperty.call(opts ?? {}, 'file')) {
        const opt = (opts as { file?: string | boolean }).file;
        const dest =
          typeof opt === 'string' && opt.length > 0 ? opt : defaultPatchFile;
        source = { kind: 'file', filePath: dest };
      } else {
        source = { kind: 'clipboard' };
      }

      let raw: string;
      let destPathRel = defaultPatchFile;
      let destPathAbs = repoJoin(cwd, defaultPatchFile);

      if (source.kind === 'clipboard') {
        console.log('stan: patch source: clipboard');
        try {
          raw = await readFromClipboard();
        } catch (e) {
          console.error('stan: failed to read clipboard', e);
          return;
        }
        destPathRel = defaultPatchFile;
        destPathAbs = repoJoin(cwd, destPathRel);
      } else if (source.kind === 'argument') {
        console.log('stan: patch source: argument');
        raw = source.text;
        destPathRel = defaultPatchFile;
        destPathAbs = repoJoin(cwd, destPathRel);
      } else {
        const rel = source.filePath;
        destPathRel = rel;
        destPathAbs = repoJoin(cwd, rel);
        console.log(
          `stan: patch source: file "${path
            .relative(cwd, destPathAbs)
            .replace(/\\/g, '/')}"`,
        );
        try {
          raw = await readFile(destPathAbs, 'utf8');
        } catch (e) {
          console.error('stan: failed to read file', e);
          return;
        }
      }

      // Detect & clean (unified diff only), tolerant to surrounding prose
      const cleaned = detectAndCleanPatch(raw);

      // Write cleaned content to designated path
      try {
        await ensureParentDir(destPathAbs);
        await writeFile(destPathAbs, cleaned, 'utf8');
      } catch (e) {
        console.error('stan: failed to write cleaned patch', e);
        return;
      }

      console.log(
        `stan: applying patch "${path
          .relative(cwd, destPathAbs)
          .replace(/\\/g, '/')}"`,
      );

      const check = Boolean(opts?.check);
      const hasAB =
        /^(---|\+\+\+)\s+(a\/|b\/)/m.test(cleaned) ||
        /^diff --git a\//m.test(cleaned);
      const stripsFirst = hasAB ? [1, 0] : [0, 1];

      const attempts: ApplyAttempt[] = [];
      for (const p of stripsFirst)
        attempts.push(...buildApplyAttempts(check, p));

      const result = await runGitApply(cwd, destPathAbs, attempts);

      if (result.ok) {
        console.log(check ? 'stan: patch check passed' : 'stan: patch applied');
        return;
      }

      // Write diagnostics bundle for analysis
      try {
        const debugDir = path.join(path.dirname(destPathAbs), '.patch.debug');
        await mkdir(debugDir, { recursive: true });

        // Save cleaned patch
        await writeFile(path.join(debugDir, 'cleaned.patch'), cleaned, 'utf8');
        // Save attempts
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
        // Save per-attempt stderr/stdout
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
        // diagnostics best-effort
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
