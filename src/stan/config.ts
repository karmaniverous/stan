/* src/stan/config.ts
 * REQUIREMENTS (current):
 * - Load stan configuration from YAML or JSON (stan.config.yml|yaml|json) discovered from `cwd`.
 * - Validate shape: { outputPath: string; scripts: Record<string,string>; includes?: string[]; excludes?: string[]; combinedFileName?: string }.
 * - Forbid reserved script keys "archive" and "init" (error must match /archive.*init.*not allowed/i).
 * - Provide sync helpers used by CLI and help: findConfigPathSync, loadConfigSync.
 * - Provide async loadConfig passthrough for convenience.
 * - Provide ensureOutputDir(cwd, outputPath, keep) which creates or clears the output directory.
 * - Keep path alias semantics and zero "any" usage.
 *
 * NEW REQUIREMENTS:
 * - Diff support artifacts live under `<outputPath>/.diff`:
 *   - `.diff/archive.prev.tar` (copy of previous full archive),
 *   - `.diff/.archive.snapshot.json` (sha256 snapshot),
 *   - `.diff/.stan_no_changes` (sentinel for no-change diff tar).
 * - When keep===false, clear previously generated script artifacts but PRESERVE `<outputPath>/.diff`.
 * - Before clearing (when keep===false), if `<outputPath>/archive.tar` exists, copy it to `.diff/archive.prev.tar`.
 * - Migrate legacy `<outputPath>/.archive.snapshot.json` into `<outputPath>/.diff/`.
 * - Zero "any" usage.
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { packageDirectorySync } from 'package-directory';
import YAML from 'yaml';

export type ScriptMap = Record<string, string>;

export type ContextConfig = {
  outputPath: string;
  scripts: ScriptMap;
  /** Paths to include in archiving logic (globs not yet supported). */
  includes?: string[];
  /** Paths to exclude in archiving logic (globs not yet supported). */
  excludes?: string[];
  /** Base name for combined artifacts; defaults to "combined" when not configured. */
  combinedFileName?: string;
};

const normalizeCombinedName = (v: unknown): string =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : 'combined';

const parseFile = async (abs: string): Promise<ContextConfig> => {
  const raw = await readFile(abs, 'utf8');
  const cfg = abs.endsWith('.json')
    ? (JSON.parse(raw) as unknown)
    : (YAML.parse(raw) as unknown);
  const outputPath = (cfg as { outputPath?: unknown }).outputPath;
  const scripts = (cfg as { scripts?: unknown }).scripts;
  const includes = (cfg as { includes?: unknown }).includes;
  const excludes = (cfg as { excludes?: unknown }).excludes;
  const combinedFileName = (cfg as { combinedFileName?: unknown })
    .combinedFileName;

  if (typeof outputPath !== 'string' || outputPath.length === 0) {
    throw new Error('Invalid config: "outputPath" must be a non-empty string');
  }
  if (typeof scripts !== 'object' || scripts === null) {
    throw new Error('Invalid config: "scripts" must be an object');
  }
  const keys = Object.keys(scripts as ScriptMap);
  if (keys.includes('archive') || keys.includes('init')) {
    // Message chosen to match tests: /archive.*init.*not allowed/i
    throw new Error('Script keys "archive" and "init" are not allowed');
  }
  return {
    outputPath,
    scripts: scripts as ScriptMap,
    includes: Array.isArray(includes) ? (includes as string[]) : [],
    excludes: Array.isArray(excludes) ? (excludes as string[]) : [],
    combinedFileName: normalizeCombinedName(combinedFileName),
  };
};

/** Resolve the absolute path to the nearest stan.config.* starting from cwd (then package root). */
export const findConfigPathSync = (cwd: string): string | null => {
  const candidates = [
    'stan.config.yml',
    'stan.config.yaml',
    'stan.config.json',
  ];
  for (const name of candidates) {
    const p = resolve(cwd, name);
    if (existsSync(p)) return p;
  }
  // Try package root if different
  const root = packageDirectorySync({ cwd }) ?? cwd;
  if (root !== cwd) {
    for (const name of candidates) {
      const p = resolve(root, name);
      if (existsSync(p)) return p;
    }
  }
  return null;
};

export const loadConfigSync = (cwd: string): ContextConfig => {
  const p = findConfigPathSync(cwd);
  if (!p) throw new Error('stan config not found');
  const raw = readFileSync(p, 'utf8');
  const cfg = p.endsWith('.json')
    ? (JSON.parse(raw) as unknown)
    : (YAML.parse(raw) as unknown);
  const outputPath = (cfg as { outputPath?: unknown }).outputPath;
  const scripts = (cfg as { scripts?: unknown }).scripts;
  const includes = (cfg as { includes?: unknown }).includes;
  const excludes = (cfg as { excludes?: unknown }).excludes;
  const combinedFileName = (cfg as { combinedFileName?: unknown })
    .combinedFileName;

  if (typeof outputPath !== 'string' || outputPath.length === 0) {
    throw new Error('Invalid config: "outputPath" must be a non-empty string');
  }
  if (typeof scripts !== 'object' || scripts === null) {
    throw new Error('Invalid config: "scripts" must be an object');
  }
  const keys = Object.keys(scripts as ScriptMap);
  if (keys.includes('archive') || keys.includes('init')) {
    throw new Error('Script keys "archive" and "init" are not allowed');
  }
  return {
    outputPath,
    scripts: scripts as ScriptMap,
    includes: Array.isArray(includes) ? (includes as string[]) : [],
    excludes: Array.isArray(excludes) ? (excludes as string[]) : [],
    combinedFileName: normalizeCombinedName(combinedFileName),
  };
};

export const loadConfig = async (cwd: string): Promise<ContextConfig> => {
  const p = findConfigPathSync(cwd);
  if (!p) throw new Error('stan config not found');
  return parseFile(p);
};

/** Ensure output directory exists and optionally clear it (when keep === false).
 * NEW: preserve and maintain `<outputPath>/.diff` across clears; migrate legacy snapshot; copy `archive.tar` to `.diff/archive.prev.tar` before clearing.
 */
export const ensureOutputDir = async (
  cwd: string,
  outputPath: string,
  keep = false,
): Promise<string> => {
  const dest = resolve(cwd, outputPath);
  await mkdir(dest, { recursive: true });

  if (!keep && existsSync(dest)) {
    const diffDir = resolve(dest, '.diff');
    await mkdir(diffDir, { recursive: true });

    // Migrate legacy snapshot if present at the root of outputPath.
    const legacySnapshot = resolve(dest, '.archive.snapshot.json');
    if (existsSync(legacySnapshot)) {
      try {
        await copyFile(
          legacySnapshot,
          resolve(diffDir, '.archive.snapshot.json'),
        );
        rmSync(legacySnapshot, { force: true });
      } catch {
        // ignore migration errors
      }
    }

    // If a previous full archive exists, copy it to .diff/archive.prev.tar before clearing.
    const archiveTar = resolve(dest, 'archive.tar');
    if (existsSync(archiveTar)) {
      try {
        await copyFile(archiveTar, resolve(diffDir, 'archive.prev.tar'));
      } catch {
        // ignore copy errors
      }
    }

    // Clear everything except .diff
    const entries = await readdir(dest, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === '.diff') continue;
      rmSync(resolve(dest, e.name), { recursive: true, force: true });
    }
  }

  return dest;
};
