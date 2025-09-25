/* src/stan/config/load.ts
 * Load/parse STAN configuration and resolve stanPath.
 */
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import YAML from 'yaml';

import { DEFAULT_OPEN_COMMAND, DEFAULT_STAN_PATH } from './defaults';
import { findConfigPathSync } from './discover';
import {
  asBool,
  asString,
  normalizeCliDefaults,
  normalizeMaxUndos,
} from './normalize';
import type { ContextConfig, ScriptMap } from './types';

const parseFile = async (abs: string): Promise<ContextConfig> => {
  const raw = await readFile(abs, 'utf8');
  const cfg = abs.endsWith('.json')
    ? (JSON.parse(raw) as unknown)
    : (YAML.parse(raw) as unknown);

  const stanPath = (cfg as { stanPath?: unknown }).stanPath;
  const scripts = (cfg as { scripts?: unknown }).scripts;
  const includes = (cfg as { includes?: unknown }).includes;
  const excludes = (cfg as { excludes?: unknown }).excludes;
  const importsRaw = (cfg as { imports?: unknown }).imports;
  const maxUndos = (cfg as { maxUndos?: unknown }).maxUndos;
  const openCmd = (cfg as { patchOpenCommand?: unknown }).patchOpenCommand;
  const devMode = (cfg as { devMode?: unknown }).devMode;
  const cliAny = (cfg as { cliDefaults?: unknown }).cliDefaults;

  if (typeof stanPath !== 'string' || stanPath.length === 0) {
    throw new Error('Invalid config: "stanPath" must be a non-empty string');
  }
  if (typeof scripts !== 'object' || scripts === null) {
    throw new Error('Invalid config: "scripts" must be an object');
  }
  const keys = Object.keys(scripts as ScriptMap);
  if (keys.includes('archive') || keys.includes('init')) {
    throw new Error('Script keys "archive" and "init" are not allowed');
  }
  return {
    stanPath,
    scripts: scripts as ScriptMap,
    includes: Array.isArray(includes) ? (includes as string[]) : [],
    excludes: Array.isArray(excludes) ? (excludes as string[]) : [],
    imports: normalizeImports(importsRaw),
    maxUndos: normalizeMaxUndos(maxUndos),
    devMode: asBool(devMode),
    patchOpenCommand: asString(openCmd) ?? DEFAULT_OPEN_COMMAND,
    cliDefaults:
      typeof cliAny === 'undefined' ? undefined : normalizeCliDefaults(cliAny),
  };
};

/** Normalize imports: string -\> [string]; arrays trimmed; invalid -\> undefined. */
const normalizeImports = (v: unknown): Record<string, string[]> | undefined => {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const out: Record<string, string[]> = {};
  for (const k of Object.keys(o)) {
    const raw = o[k];
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (s) out[k] = [s];
    } else if (Array.isArray(raw)) {
      const arr = raw
        .map((x) => (typeof x === 'string' ? x.trim() : ''))
        .filter((s) => s.length > 0);
      if (arr.length) out[k] = arr;
    }
  }
  return Object.keys(out).length ? out : undefined;
};
/**
 * Load and validate STAN configuration synchronously.
 *
 * @param cwd - Repo root or any descendant; the nearest `stan.config.*` is used.
 * @returns Parsed, validated {@link ContextConfig}.
 */
export const loadConfigSync = (cwd: string): ContextConfig => {
  const p = findConfigPathSync(cwd);
  if (!p) throw new Error('stan config not found');
  const raw = readFileSync(p, 'utf8');
  const cfg = p.endsWith('.json')
    ? (JSON.parse(raw) as unknown)
    : (YAML.parse(raw) as unknown);

  const stanPath = (cfg as { stanPath?: unknown }).stanPath;
  const scripts = (cfg as { scripts?: unknown }).scripts;
  const includes = (cfg as { includes?: unknown }).includes;
  const excludes = (cfg as { excludes?: unknown }).excludes;
  const importsRaw = (cfg as { imports?: unknown }).imports;
  const maxUndos = (cfg as { maxUndos?: unknown }).maxUndos;
  const openCmd = (cfg as { patchOpenCommand?: unknown }).patchOpenCommand;
  const devMode = (cfg as { devMode?: unknown }).devMode;
  const cliAny = (cfg as { cliDefaults?: unknown }).cliDefaults;

  if (typeof stanPath !== 'string' || stanPath.length === 0) {
    throw new Error('Invalid config: "stanPath" must be a non-empty string');
  }
  if (typeof scripts !== 'object' || scripts === null) {
    throw new Error('Invalid config: "scripts" must be an object');
  }
  const keys = Object.keys(scripts as ScriptMap);
  if (keys.includes('archive') || keys.includes('init')) {
    throw new Error('Script keys "archive" and "init" are not allowed');
  }
  return {
    stanPath,
    scripts: scripts as ScriptMap,
    includes: Array.isArray(includes) ? (includes as string[]) : [],
    excludes: Array.isArray(excludes) ? (excludes as string[]) : [],
    imports: normalizeImports(importsRaw),
    maxUndos: normalizeMaxUndos(maxUndos),
    devMode: asBool(devMode),
    patchOpenCommand: asString(openCmd) ?? DEFAULT_OPEN_COMMAND,
    cliDefaults:
      typeof cliAny === 'undefined' ? undefined : normalizeCliDefaults(cliAny),
  };
};
/**
 * Load and validate STAN configuration (async).
 *
 * @param cwd - Repo root or any descendant; the nearest `stan.config.*` is used.
 * @returns Parsed, validated {@link ContextConfig}.
 */
export const loadConfig = async (cwd: string): Promise<ContextConfig> => {
  const p = findConfigPathSync(cwd);
  if (!p) throw new Error('stan config not found');
  return parseFile(p);
};

/** Resolve stanPath from config or fall back to default (sync). */
export const resolveStanPathSync = (cwd: string): string => {
  try {
    return loadConfigSync(cwd).stanPath;
  } catch {
    return DEFAULT_STAN_PATH;
  }
};

/** Resolve stanPath from config or fall back to default (async). */
export const resolveStanPath = async (cwd: string): Promise<string> => {
  try {
    const cfg = await loadConfig(cwd);
    return cfg.stanPath;
  } catch {
    return DEFAULT_STAN_PATH;
  }
};
