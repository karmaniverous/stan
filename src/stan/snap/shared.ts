import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const STATE_FILE = '.snap.state.json';
export const SNAP_DIR = 'snapshots';
export const ARCH_DIR = 'archives';

export const within = (...parts: string[]): string => path.join(...parts);

export const ensureDirs = async (paths: string[]): Promise<void> => {
  await Promise.all(paths.map((p) => mkdir(p, { recursive: true })));
};

export const readJson = async <T>(p: string): Promise<T | null> => {
  try {
    const raw = await readFile(p, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const writeJson = async (p: string, v: unknown): Promise<void> => {
  await writeFile(p, JSON.stringify(v, null, 2), 'utf8');
};
