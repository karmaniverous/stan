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
  const maxUndos = (cfg as { maxUndos?: unknown }).maxUndos;
  const openCmd = (cfg as { patchOpenCommand?: unknown }).patchOpenCommand;
  const devMode = (cfg as { devMode?: unknown }).devMode;
  const optsAny = (cfg as { opts?: unknown }).opts as
    | { cliDefaults?: unknown }
    | undefined;

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
    maxUndos: normalizeMaxUndos(maxUndos),
    devMode: asBool(devMode),
    patchOpenCommand: asString(openCmd) ?? DEFAULT_OPEN_COMMAND,
    opts:
      optsAny && typeof optsAny === 'object'
        ? {
            cliDefaults: normalizeCliDefaults(optsAny.cliDefaults),
          }
        : undefined,
  };
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
  const maxUndos = (cfg as { maxUndos?: unknown }).maxUndos;
  const openCmd = (cfg as { patchOpenCommand?: unknown }).patchOpenCommand;
  const devMode = (cfg as { devMode?: unknown }).devMode;
  const optsAny = (cfg as { opts?: unknown }).opts as
    | { cliDefaults?: unknown }
    | undefined;

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
    maxUndos: normalizeMaxUndos(maxUndos),
    devMode: asBool(devMode),
    patchOpenCommand: asString(openCmd) ?? DEFAULT_OPEN_COMMAND,
    opts:
      optsAny && typeof optsAny === 'object'
        ? {
            cliDefaults: normalizeCliDefaults(optsAny.cliDefaults),
          }
        : undefined,
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
