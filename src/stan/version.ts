/** src/stan/version.ts
 * Version and docs/baseline status helpers for CLI printing and preflight checks.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { packageDirectorySync } from 'package-directory';

import { loadConfigSync, resolveStanPathSync } from './config';
import { makeStanDirs } from './paths';

export type VersionInfo = {
  packageVersion: string | null;
  nodeVersion: string;
  repoRoot: string;
  stanPath: string;
  systemPrompt: {
    localExists: boolean;
    baselineExists: boolean;
    inSync: boolean;
    localHash?: string;
    baselineHash?: string;
  };
  docsMeta?: {
    version?: string;
  } | null;
};

const sha256 = async (abs: string): Promise<string> => {
  const body = await readFile(abs);
  return createHash('sha256').update(body).digest('hex');
};

const getModuleRoot = (): string | null => {
  const self = fileURLToPath(import.meta.url);
  const here = path.dirname(self);
  try {
    return packageDirectorySync({ cwd: here }) ?? null;
  } catch {
    return null;
  }
};

const readJson = async <T>(abs: string): Promise<T | null> => {
  try {
    const raw = await readFile(abs, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const getVersionInfo = async (cwd: string): Promise<VersionInfo> => {
  // Repo root and stanPath
  let repoRoot = cwd;
  try {
    const pkgRoot = packageDirectorySync({ cwd }) ?? cwd;
    repoRoot = pkgRoot;
  } catch {
    // ignore
  }

  const stanPath = (() => {
    try {
      return loadConfigSync(repoRoot).stanPath;
    } catch {
      return resolveStanPathSync(repoRoot);
    }
  })();

  const dirs = makeStanDirs(repoRoot, stanPath);
  const localSystem = path.join(dirs.systemAbs, 'stan.system.md');
  const docsMetaPath = path.join(dirs.systemAbs, '.docs.meta.json');

  // Module/package version
  let packageVersion: string | null = null;
  const moduleRoot = getModuleRoot();
  if (moduleRoot) {
    try {
      const pkg = await readJson<{ version?: string }>(
        path.join(moduleRoot, 'package.json'),
      );
      packageVersion = pkg?.version ?? null;
    } catch {
      packageVersion = null;
    }
  }

  // Baseline doc under dist/
  const baselineSystem =
    moduleRoot && existsSync(path.join(moduleRoot, 'dist', 'stan.system.md'))
      ? path.join(moduleRoot, 'dist', 'stan.system.md')
      : null;

  const localExists = existsSync(localSystem);
  const baselineExists = baselineSystem ? existsSync(baselineSystem) : false;

  const [localHash, baselineHash] = await Promise.all([
    localExists ? sha256(localSystem) : Promise.resolve(undefined),
    baselineExists && baselineSystem
      ? sha256(baselineSystem)
      : Promise.resolve(undefined),
  ]);

  const inSync =
    !!localHash && !!baselineHash ? localHash === baselineHash : false;

  const docsMeta = await readJson<{ version?: string }>(docsMetaPath);

  return {
    packageVersion,
    nodeVersion: process.version,
    repoRoot,
    stanPath,
    systemPrompt: {
      localExists,
      baselineExists,
      inSync,
      localHash,
      baselineHash,
    },
    docsMeta: docsMeta ?? null,
  };
};

export const printVersionInfo = (v: VersionInfo): void => {
  const lines = [
    `STAN version: ${v.packageVersion ?? 'unknown'} (node ${v.nodeVersion})`,
    `repo: ${v.repoRoot.replace(/\\/g, '/')}`,
    `stanPath: ${v.stanPath}`,
    `system prompt in sync: ${v.systemPrompt.inSync ? 'yes' : 'no'} (local: ${
      v.systemPrompt.localExists ? 'yes' : 'no'
    }, baseline: ${v.systemPrompt.baselineExists ? 'yes' : 'no'})`,
    `docs last installed: ${v.docsMeta?.version ?? 'unknown'}`,
  ];

  console.log(lines.join('\n'));
};
