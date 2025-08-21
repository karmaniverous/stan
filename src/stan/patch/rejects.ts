import { copyFile, mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';

import { findConfigPathSync, loadConfig } from '../config';
import { makeStanDirs } from '../paths';
import { utcStamp } from '../util/time';

export const listRejFiles = async (root: string): Promise<string[]> => {
  const out: string[] = [];
  const walk = async (rel: string): Promise<void> => {
    const abs = path.join(root, rel);
    let entries: import('fs').Dirent[] = [];
    try {
      entries = await readdir(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(childRel);
      else if (e.isFile() && e.name.endsWith('.rej'))
        out.push(childRel.replace(/\\/g, '/'));
    }
  };
  await walk('');
  return out;
};

/** Move newly created *.rej files into the patch workspace under <stanPath>/patch/rejects-<UTC>/. */
export const moveRejFilesToPatchWorkspace = async (
  cwd: string,
  rels: string[],
): Promise<string | null> => {
  if (!rels.length) return null;

  const cfgPath = findConfigPathSync(cwd);
  const baseCwd = cfgPath ? path.dirname(cfgPath) : cwd;

  let stanPath = '.stan';
  try {
    const cfg = await loadConfig(baseCwd);
    stanPath = cfg.stanPath;
  } catch {
    // default
  }

  const dirs = makeStanDirs(baseCwd, stanPath);
  const batch = `rejects-${utcStamp()}`;
  const destRoot = path.join(dirs.patchAbs, batch);
  await mkdir(destRoot, { recursive: true });

  for (const rel of rels) {
    const srcAbs = path.join(baseCwd, rel);
    const destAbs = path.join(destRoot, rel);
    try {
      await mkdir(path.dirname(destAbs), { recursive: true });
      await rename(srcAbs, destAbs).catch(async () => {
        await copyFile(srcAbs, destAbs);
        await rm(srcAbs, { force: true });
      });
    } catch {
      // best-effort
    }
  }
  return path.relative(baseCwd, destRoot).replace(/\\/g, '/');
};
