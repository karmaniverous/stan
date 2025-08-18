// src/stan/config.ts
/* src/stan/config.ts
 * REQUIREMENTS (current):
 * - Load stan configuration from YAML or JSON (stan.config.yml|yaml|json) discovered from `cwd`.
 * - Validate shape: { outputPath: string; scripts: Record<string,string>; includes?: string[]; excludes?: string[]; combinedFileName?: string }.
 * - Forbid reserved script keys "archive" and "init" (error must match /archive.*init.*not allowed/i).
 * - Provide sync helpers used by CLI and help: findConfigPathSync, loadConfigSync.
 * - Provide async loadConfig passthrough for convenience.
 * - Provide ensureOutputDir(cwd, outputPath, keep) which creates or clears the output directory.
 * - Keep path alias semantics and zero "any" usage.
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
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

/** Ensure output directory exists and optionally clear it (when keep === false). */
export const ensureOutputDir = async (
  cwd: string,
  outputPath: string,
  keep = false,
): Promise<string> => {
  const dest = resolve(cwd, outputPath);
  if (!keep && existsSync(dest)) {
    // Best effort clear
    rmSync(dest, { recursive: true, force: true });
  }
  await mkdir(dest, { recursive: true });
  return dest;
};
