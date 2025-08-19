// src/cli/stan/patch.ts
/* src/cli/stan/patch.ts
 * "stan patch" subcommand: syntactic sugar over `git apply`.
 * - Defaults to config.defaultPatchFile (default '/stan.patch').
 * - Treat a leading '/' path as relative to the repo root (cwd) for portability.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

import type { Command } from 'commander';

import { applyCliSafety } from '@/cli/stan/cli-utils';

import { loadConfig } from './config';

const resolveRepoPatchPath = (cwd: string, file: string): string => {
  // Treat a leading '/' as repo-root anchored, not OS root.
  if (file.startsWith('/')) return path.join(cwd, file.slice(1));
  return path.isAbsolute(file) ? file : path.resolve(cwd, file);
};

const runGitApply = async (cwd: string, fileAbs: string): Promise<number> =>
  new Promise<number>((resolveP) => {
    const child = spawn('git', ['apply', '--3way', fileAbs], {
      cwd,
      shell: false,
      stdio: 'inherit',
    });
    child.on('close', (code) => resolveP(code ?? 0));
  });

export const registerPatch = (cli: Command): Command => {
  applyCliSafety(cli);

  const sub = cli
    .command('patch')
    .description('Apply a git patch (defaults to config.defaultPatchFile)')
    .argument(
      '[file]',
      'Patch file to apply (defaults to config.defaultPatchFile)',
    );

  applyCliSafety(sub);

  sub.action(async (provided?: string) => {
    const cwd = process.cwd();
    let file = provided;

    if (!file) {
      try {
        const cfg = await loadConfig(cwd);
        file = cfg.defaultPatchFile ?? '/stan.patch';
      } catch {
        file = '/stan.patch';
      }
    }

    const patchPath = resolveRepoPatchPath(cwd, file);
    console.log(`stan: applying patch "${path.relative(cwd, patchPath)}"`);
    const code = await runGitApply(cwd, patchPath);
    if (code === 0) {
      console.log('stan: patch applied');
    } else {
      console.log(`stan: patch failed (exit ${code.toString()})`);
    }
  });

  return cli;
};
