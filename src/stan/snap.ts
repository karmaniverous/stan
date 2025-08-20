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
 *   - "info" prints the stack with indices; newest first; shows local timestamp, filename, and archive/diff presence.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Command } from 'commander';

import { applyCliSafety } from '@/cli/stan/cli-utils';

import { captureSnapshotAndArchives } from './snap/capture';
import { runGit } from './snap/git';
import {
  ensureDirs,
  readJson,
  type SnapState,
  STATE_FILE,
  within,
  writeJson,
} from './snap/shared';
import { formatUtcStampLocal, utcStamp } from './util/time';

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

      console.log('stan: snap stack (newest → oldest)');
      if (st.entries.length === 0) {
        console.log('  (empty)');
      } else {
        // Newest first; show local timestamp per system time zone
        st.entries
          .map((e, i) => ({ e, i }))
          .reverse()
          .forEach(({ e, i }) => {
            const mark = i === st.index ? '*' : ' ';
            const hasArch = Boolean(e.archive);
            const hasDiff = Boolean(e.archiveDiff);
            const local = formatUtcStampLocal(e.ts);
            const file = path.basename(e.snapshot);
            console.log(
              `  ${mark} [${i.toString()}] ${local}  file: ${file}  archive: ${
                hasArch ? 'yes' : 'no'
              }  diff: ${hasDiff ? 'yes' : 'no'}`,
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

      // History capture and bounded retention
      const ts = utcStamp();
      await ensureDirs([]); // no-op guard (ensureDirs used in capture)
      await captureSnapshotAndArchives({
        cwd,
        stanPath: config.stanPath,
        ts,
        maxUndos: (config as { maxUndos?: number }).maxUndos ?? 10,
      });

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
