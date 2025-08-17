/**
 * REQUIREMENTS
 * - Load configuration from `ctx.config.json` or `ctx.config.yml|yaml` at repo root. [req-config-load]
 * - Validate shape: has `outputPath` (string) and `scripts` (map). [req-validate]
 * - Disallow `archive` and `init` keys in scripts. [req-no-archive-init-in-scripts]
 * - Ensure the output directory exists. [req-output-dir]
 * - Provide synchronous and asynchronous loaders (help rendering needs sync). [req-sync-load]
 */
import { existsSync, readFileSync } from 'node:fs';
import { access, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import YAML from 'yaml';

export type ScriptMap = Record<string, string>;

/**
 * Parsed configuration model for the CLI.
 */
export type ContextConfig = {
  /**
   * Destination directory for generated files, relative to the repository root.
   * Example: "ctx"
   */
  outputPath: string;
  /**
   * Mapping from script key to shell command.
   * Example: { test: "npm run test" }
   */
  scripts: ScriptMap;
};

const CONFIG_CANDIDATES = ['ctx.config.json', 'ctx.config.yml', 'ctx.config.yaml'] as const;

/**
 * Resolve the absolute path to the config file (async).
 * Throws if not found.
 */
export const findConfigPath = async (cwd: string): Promise<string> => {
  for (const name of CONFIG_CANDIDATES) {
    const abs = path.join(cwd, name);
    try {
      await access(abs);
      return abs;
    } catch {
      /* continue */
    }
  }
  throw new Error(`ctx: no config found. Create one of: ${CONFIG_CANDIDATES.join(', ')}`);
};

/**
 * Resolve the absolute path to the config file (sync).
 * Returns null if not found.
 */
export const findConfigPathSync = (cwd: string): string | null => {
  for (const name of CONFIG_CANDIDATES) {
    const abs = path.join(cwd, name);
    if (existsSync(abs)) return abs;
  }
  return null;
};

/**
 * Validate and normalize a parsed config object.
 */
const validateConfig = (parsed: unknown): ContextConfig => {
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('outputPath' in parsed) ||
    !('scripts' in parsed)
  ) {
    throw new Error('ctx: config must define both `outputPath` (string) and `scripts` (object).');
  }

  const { outputPath, scripts } = parsed as { outputPath: unknown; scripts: unknown };

  if (typeof outputPath !== 'string' || outputPath.trim().length === 0) {
    throw new Error('ctx: `outputPath` must be a non-empty string.');
  }

  if (typeof scripts !== 'object' || scripts === null || Array.isArray(scripts)) {
    throw new Error('ctx: `scripts` must be an object map of string commands.');
  }

  const validated: ScriptMap = {};
  for (const [k, v] of Object.entries(scripts as Record<string, unknown>)) {
    if (k === 'archive' || k === 'init') {
      throw new Error('ctx: `archive` and `init` are not allowed under `scripts`.');
    }
    if (typeof v !== 'string' || v.trim().length === 0) {
      throw new Error(`ctx: scripts.${k} must be a non-empty string command.`);
    }
    validated[k] = v;
  }

  return { outputPath, scripts: validated };
};

/**
 * Parse and validate the configuration file (async).
 */
export const loadConfig = async (cwd: string): Promise<ContextConfig> => {
  const configPath = await findConfigPath(cwd);
  const raw = await readFile(configPath, 'utf8');
  const parsed: unknown = configPath.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw);
  return validateConfig(parsed);
};

/**
 * Parse and validate the configuration file (sync).
 * Used for rendering help text without async.
 */
export const loadConfigSync = (cwd: string): ContextConfig | null => {
  const configPath = findConfigPathSync(cwd);
  if (!configPath) return null;
  const raw = readFileSync(configPath, 'utf8');
  const parsed: unknown = configPath.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw);
  return validateConfig(parsed);
};

/**
 * Ensure the destination directory exists and return its absolute path.
 */
export const ensureOutputDir = async (cwd: string, outputPath: string) => {
  const abs = path.join(cwd, outputPath);
  if (!existsSync(abs)) {
    await mkdir(abs, { recursive: true });
  }
  return abs;
};
