/* src/stan/snap/handlers.ts */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { findConfigPathSync, loadConfig } from '../config';
import { writeArchiveSnapshot } from '../diff';
import { makeStanDirs } from '../paths';
import { formatUtcStampLocal, utcStamp } from '../util/time';
import { captureSnapshotAndArchives } from './capture';
import { runGit } from './git';
import {
  ensureDirs,
  readJson,
  type SnapState,
  STATE_FILE,
  within,
  writeJson,
} from './shared';

const resolveContext = async (
  cwd0: string,
): Promise<{ cwd: string; stanPath: string; maxUndos: number }> => {
  const cfgPath = findConfigPathSync(cwd0);
  const cwd = cfgPath ? path.dirname(cfgPath) : cwd0;
  let cfg: { stanPath: string; maxUndos?: number };
  try {
    const loaded = await loadConfig(cwd);
    cfg = { stanPath: loaded.stanPath, maxUndos: loaded.maxUndos };
  } catch {
    cfg = { stanPath: '.stan', maxUndos: 10 };
  }
  return { cwd, stanPath: cfg.stanPath, maxUndos: cfg.maxUndos ?? 10 };
};

export const handleUndo = async (): Promise<void> => {
  const { cwd, stanPath, maxUndos } = await resolveContext(process.cwd());
  const dirs = makeStanDirs(cwd, stanPath);
  const diffDir = dirs.diffAbs;
  const statePath = within(diffDir, STATE_FILE);
  const snapPath = within(diffDir, '.archive.snapshot.json');

  const st = (await readJson<SnapState>(statePath)) ?? {
    entries: [],
    index: -1,
    maxUndos,
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
};

export const handleRedo = async (): Promise<void> => {
  const { cwd, stanPath, maxUndos } = await resolveContext(process.cwd());
  const dirs = makeStanDirs(cwd, stanPath);
  const diffDir = dirs.diffAbs;
  const statePath = within(diffDir, STATE_FILE);
  const snapPath = within(diffDir, '.archive.snapshot.json');

  const st = (await readJson<SnapState>(statePath)) ?? {
    entries: [],
    index: -1,
    maxUndos,
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
};

export const handleSet = async (indexArg: string): Promise<void> => {
  const idx = Number.parseInt(indexArg, 10);
  if (!Number.isFinite(idx) || idx < 0) {
    console.error('stan: invalid index');
    return;
  }
  const { cwd, stanPath, maxUndos } = await resolveContext(process.cwd());
  const dirs = makeStanDirs(cwd, stanPath);
  const diffDir = dirs.diffAbs;
  const statePath = within(diffDir, STATE_FILE);
  const snapPath = within(diffDir, '.archive.snapshot.json');
  const st = (await readJson<SnapState>(statePath)) ?? {
    entries: [],
    index: -1,
    maxUndos,
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
};

export const handleInfo = async (): Promise<void> => {
  const { cwd, stanPath, maxUndos } = await resolveContext(process.cwd());
  const dirs = makeStanDirs(cwd, stanPath);
  const diffDir = dirs.diffAbs;
  const statePath = within(diffDir, STATE_FILE);

  const st = (await readJson<SnapState>(statePath)) ?? {
    entries: [],
    index: -1,
    maxUndos,
  };
  const undos = Math.max(0, st.index);
  const redos =
    st.entries.length > 0 ? Math.max(0, st.entries.length - 1 - st.index) : 0;

  console.log('stan: snap stack (newest → oldest)');
  if (st.entries.length === 0) {
    console.log('  (empty)');
  } else {
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
};

export const handleSnap = async (opts?: { stash?: boolean }): Promise<void> => {
  const { cwd, stanPath, maxUndos } = await resolveContext(process.cwd());
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
    await writeArchiveSnapshot({
      cwd,
      stanPath,
      includes: [],
      excludes: [],
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

  const ts = utcStamp();
  await ensureDirs([]); // guard
  await captureSnapshotAndArchives({
    cwd,
    stanPath,
    ts,
    maxUndos,
  });

  if (wantStash && attemptPop) {
    const pop = await runGit(cwd, ['stash', 'pop']);
    if (pop.code !== 0) {
      console.error('stan: git stash pop failed');
    }
  }

  console.log('stan: snapshot updated');
};
