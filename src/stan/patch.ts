/* src/cli/stan/patch.ts
 * "stan patch" subcommand: apply a patch from clipboard / file / inline input.
 * - Default: read base64 or unified diff from clipboard; write cleaned content to defaultPatchFile, then apply.
 * - -f, --file [filename]: read from file (base64 or diff); if filename missing, defaults to config.defaultPatchFile.
 *   Clean the content and write back to the same file before applying.
 * - -c, --check: run git apply --check (no changes); still perform detection/cleanup and write the cleaned output to the target file path.
 * - Detection & cleanup:
 *   - Remove code fences, BEGIN/END banners, zero-width chars.
 *   - If base64 decodes to text containing diff markers, use decoded text; otherwise treat original as raw diff.
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

const stripCodeFence = (s: string): string => {
  // Remove common code-fence wrappers and banners
  const lines = s.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('```')) continue;
    if (/^BEGIN[_ -]?PATCH/i.test(t)) continue;
    if (/^END[_ -]?PATCH/i.test(t)) continue;
    out.push(line);
  }
  return out.join('\n');
};

const stripZeroWidthAndNormalize = (s: string): string => {
  // Remove BOM + zero-width chars; normalize CRLF to LF
  const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;
  const noZW = s.replace(ZERO_WIDTH_RE, '');
  const lf = noZW.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return lf.endsWith('\n') ? lf : lf + '\n';
};

const looksLikeBase64 = (s: string): boolean =>
  // Base64 with optional whitespace/newlines
  /^[A-Za-z0-9+/=\s]+$/.test(s);

const containsDiffMarkers = (t: string): boolean => {
  if (/^diff --git /m.test(t)) return true;
  if (/^---\s+(a\/|\S)/m.test(t) && /^\+\+\+\s+(b\/|\S)/m.test(t)) return true;
  if (/^@@\s+-\d+,\d+\s+\+\d+,\d+\s+@@/m.test(t)) return true;
  return false;
};

const decodeIfBase64Patch = (raw: string): string | null => {
  const compact = raw.replace(/\s+/g, '');
  if (!compact || !looksLikeBase64(compact)) return null;
  try {
    const buf = Buffer.from(compact, 'base64');
    const decoded = buf.toString('utf8');
    return containsDiffMarkers(decoded) ? decoded : null;
  } catch {
    return null;
  }
};

const detectAndCleanPatch = (input: string): string => {
  const s = stripCodeFence(input.trim());
  // Attempt base64 decode to patch text; else treat as raw diff
  const decoded = decodeIfBase64Patch(s);
  const text = decoded ?? s;
  return stripZeroWidthAndNormalize(text);
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

const buildApplyAttempts = (check: boolean, strip: number): ApplyAttempt[] => {
  const base = check ? ['--check'] : [];
  const with3WayNowarn: ApplyAttempt = {
    args: [...base, '--3way', '--whitespace=nowarn', `-p${strip.toString()}`],
    strip,
    label: `3way-nowarn-p${strip.toString()}`,
  };
  const with3WayIgnore: ApplyAttempt = {
    args: [...base, '--3way', '--ignore-whitespace', `-p${strip.toString()}`],
    strip,
    label: `3way-ignore-p${strip.toString()}`,
  };
  const withReject: ApplyAttempt = {
    args: [...base, '--reject', '--whitespace=nowarn', `-p${strip.toString()}`],
    strip,
    label: `reject-nowarn-p${strip.toString()}`,
  };
  return [with3WayNowarn, with3WayIgnore, withReject];
};

const runGitApply = async (
  cwd: string,
  patchFileAbs: string,
  attempts: ApplyAttempt[],
): Promise<{ ok: boolean; tried: string[]; lastCode: number }> => {
  const tried: string[] = [];
  for (const att of attempts) {
    tried.push(att.label);

    const code = await new Promise<number>((resolveP) => {
      const child = spawn('git', ['apply', ...att.args, patchFileAbs], {
        cwd,
        shell: false,
        windowsHide: true,
      });

      // Surface stderr/stdout only when STAN_DEBUG=1
      const cp = child as unknown as {
        stdout?: NodeJS.ReadableStream;
        stderr?: NodeJS.ReadableStream;
      };
      if (cp.stderr) {
        cp.stderr.on('data', (d: Buffer) => {
          if (process.env.STAN_DEBUG === '1') {
            process.stderr.write(d.toString('utf8'));
          }
        });
      }
      if (cp.stdout) {
        cp.stdout.on('data', (d: Buffer) => {
          if (process.env.STAN_DEBUG === '1') {
            process.stdout.write(d.toString('utf8'));
          }
        });
      }

      child.on('close', (c) => resolveP(c ?? 0));
    });

    if (code === 0) {
      return { ok: true, tried, lastCode: 0 };
    }
    if (process.env.STAN_DEBUG === '1') {
      console.error(`stan: git apply failed for ${att.label} (exit ${code})`);
    }
  }
  return { ok: false, tried, lastCode: 1 };
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
      'Apply a git patch from clipboard (default) or a file (with -f). Accepts base64 or unified diff.',
    )
    // Optional positional input (base64 or diff). Using large inline arguments is discouraged on Windows.
    .argument('[input]', 'Patch data (base64 or unified diff)')
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
        // Always write cleaned clipboard content to defaultPatchFile
        destPathRel = defaultPatchFile;
        destPathAbs = repoJoin(cwd, destPathRel);
      } else if (source.kind === 'argument') {
        console.log('stan: patch source: argument');
        raw = source.text;
        destPathRel = defaultPatchFile;
        destPathAbs = repoJoin(cwd, destPathRel);
      } else {
        // file
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

      // Detect & clean
      const cleaned = detectAndCleanPatch(raw);

      // Write to designated path (clipboard/argument write to default file; file mode rewrites same file)
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
      // Decide initial strip level guess: look for a/ and b/ prefixes
      const hasAB =
        /^(---|\+\+\+)\s+(a\/|b\/)/m.test(cleaned) ||
        /^diff --git a\//m.test(cleaned);
      const stripsFirst = hasAB ? [1, 0] : [0, 1];

      // Build attempt plan
      const attempts: ApplyAttempt[] = [];
      for (const p of stripsFirst) {
        attempts.push(...buildApplyAttempts(check, p));
      }

      const result = await runGitApply(cwd, destPathAbs, attempts);
      if (result.ok) {
        console.log(check ? 'stan: patch check passed' : 'stan: patch applied');
      } else {
        console.log(
          `stan: patch ${check ? 'check failed' : 'failed'} (tried: ${result.tried.join(
            ', ',
          )})`,
        );
      }
    },
  );

  return cli;
};
