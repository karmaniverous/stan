/* src/stan/config.ts
 * REQUIREMENTS (current):
 * - Load stan configuration from YAML or JSON (stan.config.yml|yaml|json) discovered from `cwd`.
 * - Validate shape: { outputPath: string; scripts: Record<string,string>; includes?: string[]; excludes?: string[] }.
 * - Forbid reserved script keys "archive" and "init" (error must match /archive.*init.*not allowed/i).
 * - Provide sync helpers used by CLI and help: findConfigPathSync, loadConfigSync.
 * - Provide async loadConfig passthrough for convenience.
 * - Provide ensureOutputDir(cwd, outputPath, keep) which creates or clears the output directory.
 * - Keep path alias semantics and zero "any" usage.
 *
 * NEW/UPDATED REQUIREMENTS:
 * - Diff support artifacts live under `<outputPath>/.diff`:
 *   - `.diff/archive.prev.tar` (copy of previous full archive),
 *   - `.diff/.archive.snapshot.json` (sha256 snapshot),
 *   - `.diff/.stan_no_changes` (sentinel for no-change diff tar).
 * - When keep===false, clear previously generated script artifacts but PRESERVE `<outputPath>/.diff`.
 * - Before clearing (when keep===false), if `<outputPath>/archive.tar` exists, copy it to `.diff/archive.prev.tar`.
 * - Migrate legacy `<outputPath>/.archive.snapshot.json` into `<outputPath>/.diff/`.
 * - Zero "any" usage.
 *
 * UPDATED REQUIREMENTS:
 * - Add `defaultPatchFile?: string` to ContextConfig, defaulting to '/stan.patch'.
 *
 * NEW (monorepo / nearest package root with config):
 * - findConfigPathSync(cwd) must search upwards and return the nearest directory that:
 *   - is a package root (contains package.json), AND
 *   - contains a stan.config.(yml|yaml|json).
 * - Also accept a direct config in cwd (even if it is not a package root), to preserve current UX.
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { packageDirectorySync } from 'package-directory';
import YAML from 'yaml';

export type ScriptMap = Record<string, string>;

export type ContextConfig = {
  outputPath: string;
  scripts: ScriptMap;
  /** Paths to include in archiving logic (globs supported). */
  includes?: string[];
  /** Paths to exclude in archiving logic (globs supported). */
  excludes?: string[];
  /** Default patch filename for `stan patch`; default '/stan.patch' if unspecified. */
  defaultPatchFile?: string;
};

const normalizeDefaultPatchFile = (v: unknown): string =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : '/stan.patch';

const parseFile = async (abs: string): Promise<ContextConfig> => {
  const raw = await readFile(abs, 'utf8');
  const cfg = abs.endsWith('.json')
    ? (JSON.parse(raw) as unknown)
    : (YAML.parse(raw) as unknown);
  const outputPath = (cfg as { outputPath?: unknown }).outputPath;
  const scripts = (cfg as { scripts?: unknown }).scripts;
  const includes = (cfg as { includes?: unknown }).includes;
  const excludes = (cfg as { excludes?: unknown }).excludes;
  const defaultPatchFile = (cfg as { defaultPatchFile?: unknown })
    .defaultPatchFile;

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
    defaultPatchFile: normalizeDefaultPatchFile(defaultPatchFile),
  };
};

const configCandidates = [
  'stan.config.yml',
  'stan.config.yaml',
  'stan.config.json',
];
const tryConfigHere = (dir: string): string | null => {
  for (const name of configCandidates) {
    const p = resolve(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
};

/** Resolve the absolute path to the nearest stan.config.* starting from cwd.
 * Priority:
 * 1) Directly in cwd (even if not a package root).
 * 2) Nearest ancestor directory that is a package root (has package.json) AND has a stan config.
 *    Continue ascending across package roots to find the first that has a config.
 */
export const findConfigPathSync = (cwd: string): string | null => {
  // 1) Direct config in cwd (non-package directories allowed)
  const direct = tryConfigHere(cwd);
  if (direct) return direct;

  // 2) Ascend package roots until none remain; return first root with config
  const seen = new Set<string>();
  let cursor: string | null = cwd;
  while (cursor) {
    const pkgRoot = packageDirectorySync({ cwd: cursor });
    if (!pkgRoot || seen.has(pkgRoot)) break;
    seen.add(pkgRoot);

    const found = tryConfigHere(pkgRoot);
    if (found) return found;

    const parent = dirname(pkgRoot);
    if (parent === pkgRoot || seen.has(parent)) break;
    cursor = parent;
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
  const defaultPatchFile = (cfg as { defaultPatchFile?: unknown })
    .defaultPatchFile;

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
    defaultPatchFile: normalizeDefaultPatchFile(defaultPatchFile),
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
