/** See /requirements.md for global requirements. */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path, { join, resolve } from 'node:path';
import YAML from 'yaml';
import { packageDirectory, packageDirectorySync } from 'package-directory';

export type ScriptMap = Record<string, string>;

export type ContextConfig = {
  outputPath: string;
  scripts: ScriptMap;
  includes?: string[];
  excludes?: string[];
};

const isNonEmptyStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string' && x.trim().length > 0);

const validateConfig = (raw: unknown): ContextConfig => {
  if (typeof raw !== 'object' || !raw) throw new Error('ctx: config must be an object');
  const { outputPath, scripts, includes, excludes } = raw as Record<string, unknown>;

  if (typeof outputPath !== 'string' || !outputPath.trim()) throw new Error('ctx: outputPath required');
  if (typeof scripts !== 'object' || !scripts) throw new Error('ctx: scripts required');
  const entries = Object.entries(scripts as Record<string, unknown>).filter(
    ([, v]) => typeof v === 'string'
  ) as [string, string][];

  const map: ScriptMap = {};
  for (const [k, v] of entries) {
    if (k === 'archive' || k === 'init') {
      throw new Error('ctx: "archive" and "init" keys are not allowed in scripts');
    }
    map[k] = v;
  }

  const normalized: ContextConfig = { outputPath, scripts: map };
  if (isNonEmptyStringArray(includes)) normalized.includes = includes.slice();
  if (isNonEmptyStringArray(excludes)) normalized.excludes = excludes.slice();
  return normalized;
};

export const getPackageRoot = async (cwd: string): Promise<string> =>
  (await packageDirectory({ cwd })) ?? cwd;

export const getPackageRootSync = (cwd: string): string =>
  packageDirectorySync({ cwd }) ?? cwd;

const CONFIG_FILES = ['ctx.config.json', 'ctx.config.yml', 'ctx.config.yaml'] as const;

export const findConfigPath = async (cwd: string): Promise<string | null> => {
  const root = await getPackageRoot(cwd);
  for (const name of CONFIG_FILES) {
    const abs = path.join(root, name);
    if (existsSync(abs)) return abs;
  }
  return null;
};

export const findConfigPathSync = (cwd: string): string | null => {
  const root = getPackageRootSync(cwd);
  for (const name of CONFIG_FILES) {
    const abs = path.join(root, name);
    if (existsSync(abs)) return abs;
  }
  return null;
};

export const loadConfig = async (cwd: string): Promise<ContextConfig> => {
  const p = (await findConfigPath(cwd)) ?? join(cwd, 'ctx.config.yml');
  const raw = await readFile(p, 'utf8');
  const obj = p.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw);
  return validateConfig(obj);
};

export const loadConfigSync = (cwd: string): ContextConfig => {
  const p = findConfigPathSync(cwd) ?? join(cwd, 'ctx.config.yml');
  const raw = require('node:fs').readFileSync(p, 'utf8');
  const obj = p.endsWith('.json') ? JSON.parse(raw) : YAML.parse(raw);
  return validateConfig(obj);
};

export const ensureOutputDir = async (cwd: string, outputPath: string): Promise<string> => {
  const root = await getPackageRoot(cwd);
  const abs = resolve(root, outputPath);
  await require('node:fs/promises').mkdir(abs, { recursive: true });
  return abs;
};

export const ensureOutputDirSync = (cwd: string, outputPath: string): string => {
  const root = getPackageRootSync(cwd);
  const abs = resolve(root, outputPath);
  if (!existsSync(abs)) require('node:fs').mkdirSync(abs, { recursive: true });
  return abs;
};

export const renderAvailableScriptsHelp = (cwd: string): string => {
  const { scripts } = loadConfigSync(cwd);
  const keys = Object.keys(scripts);
  if (!keys.length) return 'No scripts configured.';
  return [
    'Available script keys:',
    ...keys.map((k) => `  - ${k}`),
    '',
    'Examples:',
    '  ctx lint test',
    '  ctx -s -e test'
  ].join('\n');
};
