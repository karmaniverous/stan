// src/stan/init/docs.ts
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { packageDirectorySync } from 'package-directory';

/**
 * Best‑effort copy of a documentation asset from the installed module into the repo.
 *
 * Creates the destination directory when needed. When `updateIfDifferent` is true,
 * overwrites the destination only if the contents differ.
 *
 * @param cwd - Repository root (used to resolve `destRel`).
 * @param moduleRoot - Absolute path to the module root that contains the source file.
 * @param srcName - File name inside `moduleRoot` to copy.
 * @param destRel - Repo‑relative destination path.
 * @param updateIfDifferent - When true, overwrite only if contents differ.
 */
const copyDoc = async (
  cwd: string,
  moduleRoot: string,
  srcName: string,
  destRel: string,
  updateIfDifferent: boolean,
): Promise<void> => {
  const src = path.join(moduleRoot, srcName);
  const dest = path.join(cwd, destRel);
  const destDir = path.dirname(dest);
  await mkdir(destDir, { recursive: true });

  if (!existsSync(src)) return;

  if (!existsSync(dest)) {
    await copyFile(src, dest);
    return;
  }

  if (!updateIfDifferent) return;

  try {
    const [a, b] = await Promise.all([
      readFile(src, 'utf8'),
      readFile(dest, 'utf8'),
    ]);
    if (a !== b) {
      await copyFile(src, dest);
    }
  } catch {
    // best-effort
  }
};

/**
 * Ensure <stanPath>/system contains the shipped docs and record package version
 * to <stanPath>/system/.docs.meta.json.
 *
 * @param cwd - Repository root.
 * @param stanPath - STAN workspace folder (for example, ".stan").
 * @returns Promise that resolves when the docs and metadata have been ensured.
 */
export const ensureDocs = async (
  cwd: string,
  stanPath: string,
): Promise<void> => {
  const thisFile = fileURLToPath(import.meta.url);
  const thisDir = path.dirname(thisFile);
  const moduleRoot = packageDirectorySync({ cwd: thisDir }) ?? thisDir;
  const distRoot = path.join(moduleRoot, 'dist');

  await copyDoc(
    cwd,
    distRoot,
    'stan.project.template.md',
    path.join(stanPath, 'system', 'stan.project.template.md'),
    false,
  );

  // Write docs meta { version } best-effort
  try {
    const pkgPath = path.join(moduleRoot, 'package.json');
    const raw = await readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(raw) as { version?: string };
    const version =
      typeof pkg?.version === 'string' && pkg.version.length > 0
        ? pkg.version
        : undefined;
    if (version) {
      const metaPath = path.join(cwd, stanPath, 'system', '.docs.meta.json');
      await writeFile(metaPath, JSON.stringify({ version }, null, 2), 'utf8');
    }
  } catch {
    // best-effort
  }
};
