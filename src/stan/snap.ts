/* src/cli/stan/snap.ts
 * "stan snap" subcommand: create/replace the diff snapshot explicitly.
 * NEW:
 * - Operate from the nearest package root with a stan config when available.
 * - -s, --stash: run "git stash -u" before taking the snapshot and "git stash pop" afterwards.
 *   - If stash/save fails, log an error and proceed without stashing.
 *   - If pop fails (e.g., no stash entries), log an error and finish.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

import type { Command } from 'commander';

import { applyCliSafety } from '@/cli/stan/cli-utils';

type RunResult = { code: number; stdout: string; stderr: string };

const runGit = async (cwd: string, args: string[]): Promise<RunResult> =>
  new Promise<RunResult>((resolve) => {
    const child = spawn('git', args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const cp = child as unknown as {
      stdout?: NodeJS.ReadableStream;
      stderr?: NodeJS.ReadableStream;
    };

    cp.stdout?.on('data', (d: Buffer) => {
      const s = d.toString('utf8');
      stdout += s;
      if (process.env.STAN_DEBUG === '1') process.stdout.write(s);
    });

    cp.stderr?.on('data', (d: Buffer) => {
      const s = d.toString('utf8');
      stderr += s;
      if (process.env.STAN_DEBUG === '1') process.stderr.write(s);
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });

export const registerSnap = (cli: Command): Command => {
  applyCliSafety(cli);

  const sub = cli
    .command('snap')
    .description('Create/update the diff snapshot (without writing an archive)')
    .option(
      '-s, --stash',
      'stash changes (git stash -u) before snap and pop after',
    );

  applyCliSafety(sub);

  sub.action(async (opts?: { stash?: boolean }) => {
    const cwd0 = process.cwd();
    const cfgMod = await import('./config');
    const diffMod = await import('./diff');

    const cfgPath = cfgMod.findConfigPathSync(cwd0);
    const cwd = cfgPath ? path.dirname(cfgPath) : cwd0;

    let maybe: unknown;
    try {
      maybe = await cfgMod.loadConfig(cwd);
    } catch (e) {
      if (process.env.STAN_DEBUG === '1') {
        console.error('stan: failed to load config for snapshot', e);
      }
      maybe = undefined;
    }

    const isContextConfig = (
      v: unknown,
    ): v is {
      stanPath: string;
      scripts: Record<string, string>;
      includes?: string[];
      excludes?: string[];
    } =>
      !!v &&
      typeof v === 'object' &&
      typeof (v as { stanPath?: unknown }).stanPath === 'string' &&
      typeof (v as { scripts?: unknown }).scripts === 'object';

    const config = isContextConfig(maybe)
      ? maybe
      : { stanPath: 'stan', scripts: {} as Record<string, string> };

    const wantStash = Boolean(opts?.stash);
    let attemptPop = false;

    if (wantStash) {
      const res = await runGit(cwd, ['stash', '-u']);
      if (res.code === 0 && !/No local changes to save/i.test(res.stdout)) {
        attemptPop = true;
      } else if (res.code !== 0) {
        console.error('stan: git stash -u failed; proceeding without stashing');
      }
    }

    try {
      await diffMod.writeArchiveSnapshot({
        cwd,
        stanPath: config.stanPath,
        includes: config.includes ?? [],
        excludes: config.excludes ?? [],
      });
      console.log('stan: snapshot updated');
    } finally {
      if (wantStash && attemptPop) {
        const pop = await runGit(cwd, ['stash', 'pop']);
        if (pop.code !== 0) {
          console.error('stan: git stash pop failed');
        }
      }
    }
  });

  return cli;
};
