/**
 * REQUIREMENTS
 * - Load configuration from `context.config.json` or `context.config.yml|yaml` at repo root. [req-config-load]
 * - Validate shape: `{ outputPath: string, scripts: Record<string,string> }`. [req-validate]
 * - Disallow `archive` as a key under `scripts`. [req-no-archive-in-scripts]
 * - Ensure the output directory exists. [req-output-dir]
 */
import { existsSync } from 'node:fs';
import { access, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import YAML from 'yaml';

export type ScriptMap = Record<string, string>;

export type ContextConfig = {
  /** Destination directory for generated files (relative to repo root). */
  outputPath: string;
  /** Map of script keys to shell commands (e.g., `{ test: "npm run test" }`). */
  scripts: ScriptMap;
};

const CONFIG_CANDIDATES = [
  'context.config.json',
  'context.config.yml',
  'context.config.yaml',
] as const;

/** Resolve the absolute path to the config file in the provided cwd. */
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
  throw new Error(
    `context: no config found. Create one of: ${CONFIG_CANDIDATES.join(', ')}`,
  );
};

/** Parse and validate config. */
export const loadConfig = async (cwd: string): Promise<ContextConfig> => {
  const configPath = await findConfigPath(cwd);
  const raw = await readFile(configPath, 'utf8');

  const parsed: unknown = configPath.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw);

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('outputPath' in parsed) ||
    !('scripts' in parsed)
  ) {
    throw new Error(
      'context: config must define both `outputPath` (string) and `scripts` (object).',
    );
  }

  const { outputPath, scripts } = parsed as { outputPath: unknown; scripts: unknown };

  if (typeof outputPath !== 'string' || outputPath.trim().length === 0) {
    throw new Error('context: `outputPath` must be a non-empty string.');
  }

  if (typeof scripts !== 'object' || scripts === null || Array.isArray(scripts)) {
    throw new Error('context: `scripts` must be an object map of string commands.');
  }

  const validated: ScriptMap = {};
  for (const [k, v] of Object.entries(scripts as Record<string, unknown>)) {
    if (k === 'archive') {
      throw new Error('context: `archive` is not allowed under `scripts`.');
    }
    if (typeof v !== 'string' || v.trim().length === 0) {
      throw new Error(`context: scripts.${k} must be a non-empty string command.`);
    }
    validated[k] = v;
  }

  return { outputPath, scripts: validated };
};

/** Ensure the destination directory exists. [req-output-dir] */
export const ensureOutputDir = async (cwd: string, outputPath: string) => {
  const abs = path.join(cwd, outputPath);
  if (!existsSync(abs)) {
    await mkdir(abs, { recursive: true });
  }
  return abs;
};
