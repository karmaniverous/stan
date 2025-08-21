// src/stan/init/docs.ts
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { packageDirectorySync } from 'package-directory';

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
    'stan.system.md',
    path.join(stanPath, 'system', 'stan.system.md'),
    true,
  );
  await copyDoc(
    cwd,
    distRoot,
    'stan.project.template.md',
    path.join(stanPath, 'system', 'stan.project.template.md'),
    false,
  );
  await copyDoc(
    cwd,
    distRoot,
    'stan.bootloader.md',
    path.join(stanPath, 'system', 'stan.bootloader.md'),
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
