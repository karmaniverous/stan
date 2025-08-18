/** See /requirements.md for global requirements. */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import YAML from 'yaml';
import { packageDirectory, packageDirectorySync } from 'package-directory';

export type ScriptMap = Record<string, string>;

export type ContextConfig = {
  outputPath: string;
  scripts: ScriptMap;
  /** Paths to include in archiving logic (globs not yet supported). */
  includes?: string[];
  /** Paths to exclude in archiving logic (globs not yet supported). */
  excludes?: string[];
};

/** Resolve the package root robustly from an arbitrary CWD. */
export const resolvePackageRootSync = (cwd: string): string =>
  packageDirectorySync({ cwd }) ?? resolve(cwd);

/** Resolve the package root robustly from an arbitrary CWD (async). */
export const resolvePackageRoot = async (cwd: string): Promise<string> =>
  (await packageDirectory({ cwd })) ?? resolve(cwd);

/** Candidate config file names at repo root. */
const CONFIG_NAMES = ['stan.config.json', 'stan.config.yml', 'stan.config.yaml'] as const;

export const findConfigPathSync = (cwd: string): string | null => {
  const root = resolvePackageRootSync(cwd);
  for (const name of CONFIG_NAMES) {
    const p = join(root, name);
    if (existsSync(p)) return p;
  }
  return null;
};

export const loadConfigSync = (cwd: string): ContextConfig => {
  const p = findConfigPathSync(cwd);
  if (!p) return { outputPath: 'stan', scripts: {} };
  const raw = readFileSync(p, 'utf8');
  const data = p.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw);
  const cfg = data as Partial<ContextConfig> | null | undefined;
  const outputPath =
    typeof cfg?.outputPath === 'string' && cfg.outputPath.trim() ? cfg.outputPath.trim() : 'stan';
  const scripts = (cfg?.scripts ?? {}) as ScriptMap;
  if (typeof scripts !== 'object') throw new Error('Invalid config: "scripts" must be an object');
  if ('archive' in scripts || 'init' in scripts)
    throw new Error('Reserved script keys "archive" or "init" present');
  return { outputPath, scripts, includes: cfg?.includes ?? [], excludes: cfg?.excludes ?? [] };
};

export const loadConfig = async (cwd: string): Promise<ContextConfig> => loadConfigSync(cwd);

/** Ensure output directory exists. */
export const ensureOutputDir = async (cwd: string, outputPath: string): Promise<string> => {
  const dest = resolve(cwd, outputPath);
  await mkdir(dest, { recursive: true });
  return dest;
};
