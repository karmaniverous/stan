/* src/cli/stan/snap.ts
 * "stan snap" subcommand: create/replace the diff snapshot without writing an archive.
 * NEW:
 * - Operate from the nearest package root with a stan config when available.
 * - -s, --stash: run "git stash -u" before taking the snapshot and "git stash pop" afterwards.
 *   - If stash/save fails (non‑zero), log an error and DO NOT take the snapshot (abort).
 *   - If pop fails (e.g., no stash entries), log an error and finish.
 * - Add bounded history (undo/redo/info) under <stanPath>/diff with a state pointer:
 *   - Keep copies of snapshots under diff/snapshots/snap-YYYYMMDD-HHMMSS.json.
 *   - If present at snap time, copy <stanPath>/output/archive.tar & archive.diff.tar into diff/archives with the same timestamp stem.
 *   - Maintain diff/.snap.state.json with { entries, index, maxUndos }.
 *   - "snap" pushes a new entry and clears any redos; trim to maxUndos (default 10).
 *   - "undo" moves to a previous entry (if any) and restores diff/.archive.snapshot.json.
 *   - "set <index>" jumps to a specific snapshot index and restores it.
 *   - "redo" moves to a later entry (if any) and restores diff/.archive.snapshot.json.
 *   - "info" prints the stack with indices, timestamps, file presence, current index, and how many undos/redos remain.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

const utcStamp = (): string => {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(
    d.getUTCDate(),
  )}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
};

type SnapEntry = {
  ts: string;
  snapshot: string; // relative to diff dir
  archive?: string; // optional, relative to diff dir
  archiveDiff?: string; // optional, relative to diff dir
};

type SnapState = {
  entries: SnapEntry[];
  index: number; // current pointer (0-based)
  maxUndos: number;
};

const STATE_FILE = '.snap.state.json';
const SNAP_DIR = 'snapshots';
const ARCH_DIR = 'archives';

const readJson = async <T>(p: string): Promise<T | null> => {
  try {
    const raw = await readFile(p, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJson = async (p: string, v: unknown): Promise<void> => {
  await writeFile(p, JSON.stringify(v, null, 2), 'utf8');
};

const ensureDirs = async (p: string[]): Promise<void> => {
  await Promise.all(p.map((d) => mkdir(d, { recursive: true })));
};

const within = (...parts: string[]): string => path.join(...parts);

export const registerSnap = (cli: Command): Command => {
  applyCliSafety(cli);

  const sub = cli
    .command('snap')
    .description(
      'Create/update the diff snapshot (without writing an archive)',
    );

  applyCliSafety(sub);

  sub
    .command('undo')
    .description('Revert to the previous snapshot in the history stack')
    .action(async () => {
      const cwd0 = process.cwd();
      const cfgMod = await import('./config');
      const cfgPath = cfgMod.findConfigPathSync(cwd0);
      const cwd = cfgPath ? path.dirname(cfgPath) : cwd0;
      let cfg: { stanPath: string; maxUndos?: number };
      try {
        const loaded = await cfgMod.loadConfig(cwd);
        cfg = { stanPath: loaded.stanPath, maxUndos: loaded.maxUndos };
      } catch {
        cfg = { stanPath: '.stan', maxUndos: 10 };
      }
      const dirs = (await import('./paths')).makeStanDirs(cwd, cfg.stanPath);
      const diffDir = dirs.diffAbs;
      const statePath = within(diffDir, STATE_FILE);
      const snapPath = within(diffDir, '.archive.snapshot.json');

      const st = (await readJson<SnapState>(statePath)) ?? {
        entries: [],
        index: -1,
        maxUndos: cfg.maxUndos ?? 10,
      };
      if (st.entries.length === 0 || st.index <= 0) {
        console.log('stan: nothing to undo');
        return;
      }
      const nextIndex = st.index - 1;
      const entry = st.entries[nextIndex];
      const snapAbs = within(diffDir, entry.snapshot);
      try {
        const body = await readFile(snapAbs, 'utf8');
        await writeFile(snapPath, body, 'utf8');
      } catch (e) {
        console.error('stan: failed to restore snapshot', e);
        return;
      }
      st.index = nextIndex;
      await writeJson(statePath, st);
      const undos = st.index;
      const redos = st.entries.length - 1 - st.index;
      console.log(
        `stan: undo -> ${entry.ts} (undos left ${undos.toString()}, redos left ${redos.toString()})`,
      );
    });

  sub
    .command('redo')
    .description('Advance to the next snapshot in the history stack')
    .action(async () => {
      const cwd0 = process.cwd();
      const cfgMod = await import('./config');
      const cfgPath = cfgMod.findConfigPathSync(cwd0);
      const cwd = cfgPath ? path.dirname(cfgPath) : cwd0;
      let cfg: { stanPath: string; maxUndos?: number };
      try {
        const loaded = await cfgMod.loadConfig(cwd);
        cfg = { stanPath: loaded.stanPath, maxUndos: loaded.maxUndos };
      } catch {
        cfg = { stanPath: '.stan', maxUndos: 10 };
      }
      const dirs = (await import('./paths')).makeStanDirs(cwd, cfg.stanPath);
      const diffDir = dirs.diffAbs;
      const statePath = within(diffDir, STATE_FILE);
      const snapPath = within(diffDir, '.archive.snapshot.json');

      const st = (await readJson<SnapState>(statePath)) ?? {
        entries: [],
        index: -1,
        maxUndos: cfg.maxUndos ?? 10,
      };
      if (st.entries.length === 0 || st.index >= st.entries.length - 1) {
        console.log('stan: nothing to redo');
        return;
      }
      const nextIndex = st.index + 1;
      const entry = st.entries[nextIndex];
      const snapAbs = within(diffDir, entry.snapshot);
      try {
        const body = await readFile(snapAbs, 'utf8');
        await writeFile(snapPath, body, 'utf8');
      } catch (e) {
        console.error('stan: failed to restore snapshot', e);
        return;
      }
      st.index = nextIndex;
      await writeJson(statePath, st);
      const undos = st.index;
      const redos = st.entries.length - 1 - st.index;
      console.log(
        `stan: redo -> ${entry.ts} (undos left ${undos.toString()}, redos left ${redos.toString()})`,
      );
    });

  sub
    .command('set')
    .argument('<index>', 'snapshot index to activate (0-based)')
    .description('Jump to a specific snapshot index and restore it')
    .action(async (indexArg: string) => {
      const idx = Number.parseInt(indexArg, 10);
      if (!Number.isFinite(idx) || idx < 0) {
        console.error('stan: invalid index');
        return;
      }
      const cwd0 = process.cwd();
      const cfgMod = await import('./config');
      const cfgPath = cfgMod.findConfigPathSync(cwd0);
      const cwd = cfgPath ? path.dirname(cfgPath) : cwd0;
      let cfg: { stanPath: string; maxUndos?: number };
      try {
        const loaded = await cfgMod.loadConfig(cwd);
        cfg = { stanPath: loaded.stanPath, maxUndos: loaded.maxUndos };
      } catch {
        cfg = { stanPath: '.stan', maxUndos: 10 };
      }
      const dirs = (await import('./paths')).makeStanDirs(cwd, cfg.stanPath);
      const diffDir = dirs.diffAbs;
      const statePath = within(diffDir, STATE_FILE);
      const snapPath = within(diffDir, '.archive.snapshot.json');
      const st = (await readJson<SnapState>(statePath)) ?? {
        entries: [],
        index: -1,
        maxUndos: cfg.maxUndos ?? 10,
      };
      if (idx < 0 || idx >= st.entries.length) {
        console.error('stan: index out of range');
        return;
      }
      const entry = st.entries[idx];
      const snapAbs = within(diffDir, entry.snapshot);
      const body = await readFile(snapAbs, 'utf8');
      await writeFile(snapPath, body, 'utf8');
      st.index = idx;
      await writeJson(statePath, st);
      const undos = st.index;
      const redos = st.entries.length - 1 - st.index;
      console.log(
        `stan: set -> ${entry.ts} (undos left ${undos.toString()}, redos left ${redos.toString()})`,
      );
    });

  sub
    .command('info')
    .description('Print the snapshot stack and current position')
    .action(async () => {
      const cwd0 = process.cwd();
      const cfgMod = await import('./config');
      const cfgPath = cfgMod.findConfigPathSync(cwd0);
      const cwd = cfgPath ? path.dirname(cfgPath) : cwd0;
      let cfg: { stanPath: string; maxUndos?: number };
      try {
        const loaded = await cfgMod.loadConfig(cwd);
        cfg = { stanPath: loaded.stanPath, maxUndos: loaded.maxUndos };
      } catch {
        cfg = { stanPath: '.stan', maxUndos: 10 };
      }
      const dirs = (await import('./paths')).makeStanDirs(cwd, cfg.stanPath);
      const diffDir = dirs.diffAbs;
      const statePath = within(diffDir, STATE_FILE);

      const st = (await readJson<SnapState>(statePath)) ?? {
        entries: [],
        index: -1,
        maxUndos: cfg.maxUndos ?? 10,
      };
      const undos = Math.max(0, st.index);
      const redos =
        st.entries.length > 0
          ? Math.max(0, st.entries.length - 1 - st.index)
          : 0;

      console.log('stan: snap stack');
      if (st.entries.length === 0) {
        console.log('  (empty)');
      } else {
        st.entries.forEach((e, i) => {
          const mark = i === st.index ? '*' : ' ';
          const hasArch = Boolean(e.archive);
          const hasDiff = Boolean(e.archiveDiff);
          console.log(
            `  ${mark} [${i.toString()}] ${e.ts}  snapshot: ${e.snapshot}${
              hasArch ? '  archive: yes' : '  archive: no'
            }${hasDiff ? '  diff: yes' : '  diff: no'}`,
          );
        });
      }
      console.log(
        `  current index: ${st.index.toString()}  undos left: ${undos.toString()}  redos left: ${redos.toString()}`,
      );
    });

  sub
    .option(
      '-s, --stash',
      'stash changes (git stash -u) before snap and pop after',
    )
    .action(async (opts?: { stash?: boolean }) => {
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
        maxUndos?: number;
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
          console.error(
            'stan: git stash -u failed; snapshot aborted (no changes made)',
          );
          return;
        }
      }

      try {
        await diffMod.writeArchiveSnapshot({
          cwd,
          stanPath: config.stanPath,
          includes: config.includes ?? [],
          excludes: config.excludes ?? [],
        });
      } catch (e) {
        console.error('stan: snapshot write failed', e);
        if (wantStash && attemptPop) {
          const pop = await runGit(cwd, ['stash', 'pop']);
          if (pop.code !== 0) {
            console.error('stan: git stash pop failed');
          }
        }
        return;
      }

      // History management
      const dirs = (await import('./paths')).makeStanDirs(cwd, config.stanPath);
      const diffDir = dirs.diffAbs;
      const outDir = dirs.outputAbs;
      const statePath = within(diffDir, STATE_FILE);
      const snapsDir = within(diffDir, SNAP_DIR);
      const archDir = within(diffDir, ARCH_DIR);
      await ensureDirs([diffDir, snapsDir, archDir]);

      const ts = utcStamp();
      const currentSnapAbs = within(diffDir, '.archive.snapshot.json');
      const snapRel = within(SNAP_DIR, `snap-${ts}.json`);
      const snapAbs = within(diffDir, snapRel);

      try {
        const body = await readFile(currentSnapAbs, 'utf8');
        await writeFile(snapAbs, body, 'utf8');
      } catch (e) {
        console.error('stan: failed to copy snapshot into history', e);
      }

      // Optionally capture current archives if present
      let archRel: string | undefined;
      let archDiffRel: string | undefined;
      const outArchive = within(outDir, 'archive.tar');
      const outDiff = within(outDir, 'archive.diff.tar');
      try {
        if (existsSync(outArchive)) {
          archRel = within(ARCH_DIR, `archive-${ts}.tar`);
          await copyFile(outArchive, within(diffDir, archRel));
        }
        if (existsSync(outDiff)) {
          archDiffRel = within(ARCH_DIR, `archive-${ts}.diff.tar`);
          await copyFile(outDiff, within(diffDir, archDiffRel));
        }
      } catch {
        // best effort
      }

      const st = (await readJson<SnapState>(statePath)) ?? {
        entries: [],
        index: -1,
        maxUndos: (config as { maxUndos?: number }).maxUndos ?? 10,
      };

      // If we were not at the tip, drop redos
      if (st.index >= 0 && st.index < st.entries.length - 1) {
        st.entries = st.entries.slice(0, st.index + 1);
      }

      st.entries.push({
        ts,
        snapshot: snapRel,
        archive: archRel,
        archiveDiff: archDiffRel,
      });
      st.index = st.entries.length - 1;

      // Trim to maxUndos by dropping oldest
      const maxKeep = st.maxUndos ?? 10;
      while (st.entries.length > maxKeep) {
        const drop = st.entries.shift();
        if (drop) {
          try {
            await rm(within(diffDir, drop.snapshot), { force: true });
          } catch {
            // ignore
          }
          if (drop.archive) {
            try {
              await rm(within(diffDir, drop.archive), { force: true });
            } catch {
              // ignore
            }
          }
          if (drop.archiveDiff) {
            try {
              await rm(within(diffDir, drop.archiveDiff), { force: true });
            } catch {
              // ignore
            }
          }
        }
        st.index = Math.max(0, st.entries.length - 1);
      }

      await writeJson(statePath, st);

      if (wantStash && attemptPop) {
        const pop = await runGit(cwd, ['stash', 'pop']);
        if (pop.code !== 0) {
          console.error('stan: git stash pop failed');
        }
      }

      console.log('stan: snapshot updated');
    });

  return cli;
};
