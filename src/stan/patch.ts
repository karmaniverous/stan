/* src/cli/stan/patch.ts
 * "stan patch" subcommand: apply a patch from clipboard / file / inline input.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Command } from 'commander';

import { applyCliSafety } from '@/cli/stan/cli-utils';

import { ApplyResult, buildApplyAttempts, runGitApply } from './patch/apply';
import { detectAndCleanPatch } from './patch/clean';
import { resolvePatchContext } from './patch/context';
import { listRejFiles, moveRejFilesToRefactors } from './patch/rejects';

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
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
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
      const hasAB =
        /^(---|\+\+\+)\s+(a\/|b\/)/m.test(cleaned) ||
        /^diff --git a\//m.test(cleaned);
      const stripsFirst = hasAB ? [1, 0] : [0, 1];

      const attempts = stripsFirst.flatMap((p) =>
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

      // Move any new *.rej files into <stanPath>/refactors/patch-rejects-<ts>/
      try {
        const postRej = await listRejFiles(cwd);
        const preSet = new Set(preRej);
        const newOnes = postRej.filter((r) => !preSet.has(r));
        const movedTo = await moveRejFilesToRefactors(cwd, newOnes);
        if (movedTo) {
          console.log(
            `stan: moved ${newOnes.length.toString()} reject file(s) -> ${movedTo}`,
          );
        }
      } catch {
        // best-effort
      }

      // Diagnostics bundle
      try {
        const debugDir = path.join(path.dirname(patchAbs), '.debug');
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
