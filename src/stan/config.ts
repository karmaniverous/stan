/* src/stan/config.ts
 * REQUIREMENTS (updated):
 * - Load stan configuration from YAML or JSON (stan.config.yml|yaml|json) discovered from `cwd`.
 * - Validate shape: { stanPath: string; scripts: Record<string,string>; includes?: string[]; excludes?: string[] }.
 * - Forbid reserved script keys "archive" and "init".
 * - Provide sync helpers used by CLI and help: findConfigPathSync, loadConfigSync.
 * - Provide async loadConfig passthrough for convenience.
 * - Provide ensureOutputDir(cwd, stanPath, keep) which creates the stanPath tree and manages output/diff as follows:
 *   - ensure <stanPath>/output and <stanPath>/diff exist.
 *   - when keep===false, copy <stanPath>/output/archive.tar -> <stanPath>/diff/archive.prev.tar if it exists.
 *   - when keep===false, clear ONLY <stanPath>/output (preserve <stanPath>/diff).
 * - NEW: stanPath replaces outputPath (default '.stan').
 * - NEW: maxUndos?: number (default 10) for snapshot undo/redo retention.
 * - NEW: patchOpenCommand?: string (default "code -g {file}") to open modified files after patch apply.
 * - NEW: opts.cliDefaults: phase-scoped CLI defaults (flags > opts.cliDefaults > built-ins).
 *   - root: { debug?: boolean; boring?: boolean }
 *   - patch: { file?: string }
 *   - run: { archive?: boolean; combine?: boolean; keep?: boolean; sequential?: boolean; scripts?: boolean | string[] }
 *   - snap: { stash?: boolean }
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { packageDirectorySync } from 'package-directory';
import YAML from 'yaml';

import { makeStanDirs } from './paths';

/** Map of script keys to shell commands invoked by `stan run`. */
export type ScriptMap = Record<string, string>;

export type CliDefaultsRun = {
  archive?: boolean;
  combine?: boolean;
  keep?: boolean;
  sequential?: boolean;
  scripts?: boolean | string[];
};
export type CliDefaultsPatch = { file?: string | null | undefined };
export type CliDefaultsSnap = { stash?: boolean };
export type CliDefaultsRoot = { debug?: boolean; boring?: boolean };
export type CliDefaults = {
  debug?: boolean;
  boring?: boolean;
  patch?: CliDefaultsPatch;
  run?: CliDefaultsRun;
  snap?: CliDefaultsSnap;
};
export type ContextOpts = {
  /** Phase-scoped CLI defaults used by adapters when flags are omitted. */
  cliDefaults?: CliDefaults;
};

/**
 * Resolved STAN configuration.
 * - Paths like stanPath/output and stanPath/diff are referred to without angle
 *   brackets to avoid confusion with HTML-like tags in TSDoc.
 */
export type ContextConfig = {
  stanPath: string;
  scripts: ScriptMap;
  /**
   * Additive allow‑list globs for archiving/snapshot logic.
   * - Augments the base selection (which applies .gitignore, default denials, and user excludes).
   * - Overrides user `excludes`, `.gitignore`, and default denials.
   * - Reserved exclusions still apply: `<stanPath>/diff` is always excluded; `<stanPath>/output`
   *   is excluded unless explicitly included by combine behavior at archive time.
   */
  includes?: string[];
  /** Paths to exclude in archiving logic (globs supported). */
  excludes?: string[];
  /** Maximum retained snapshot "undos" (history depth for snap undo/redo); default 10. */
  maxUndos?: number /**
   * Optional developer-mode switch to treat the current repo as the STAN dev module.
   */;

  devMode?: boolean;
  /**
   * Command template to open modified files after a successful patch.
   * Tokens: `\{file\}` expands to a repo‑relative file path.
   * Default: `code -g \{file\}`.
   */
  patchOpenCommand?: string;
  /** Optional bag for phase-scoped CLI defaults and future options. */
  opts?: ContextOpts;
};

/** Public default stan path for consumers and internal use. */
export const DEFAULT_STAN_PATH = '.stan';
const DEFAULT_OPEN_COMMAND = 'code -g {file}';

const normalizeMaxUndos = (v: unknown): number => {
  const n =
    typeof v === 'number'
      ? Math.floor(v)
      : Number.isFinite(Number.parseInt(String(v), 10))
        ? Math.floor(Number.parseInt(String(v), 10))
        : NaN;
  if (!Number.isFinite(n) || n < 1) return 10;
  return n;
};

const asString = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim().length ? v : undefined;

const asBool = (v: unknown): boolean | undefined => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
  }
  if (typeof v === 'number') {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  return undefined;
};

const asStringArray = (v: unknown): string[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .map((x) => (typeof x === 'string' ? x : undefined))
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
  return out.length ? out : [];
};

const normalizeCliDefaults = (v: unknown): CliDefaults | undefined => {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const runIn = (o.run ?? {}) as Record<string, unknown>;
  const patchIn = (o.patch ?? {}) as Record<string, unknown>;
  const snapIn = (o.snap ?? {}) as Record<string, unknown>;
  const out: CliDefaults = {};
  const dbg = asBool(o.debug);
  const bor = asBool(o.boring);
  if (typeof dbg === 'boolean') out.debug = dbg;
  if (typeof bor === 'boolean') out.boring = bor;
  const run: CliDefaultsRun = {};
  const ra = asBool(runIn.archive);
  const rc = asBool(runIn.combine);
  const rk = asBool(runIn.keep);
  const rq = asBool(runIn.sequential);
  if (typeof ra === 'boolean') run.archive = ra;
  if (typeof rc === 'boolean') run.combine = rc;
  if (typeof rk === 'boolean') run.keep = rk;
  if (typeof rq === 'boolean') run.sequential = rq;
  if (typeof runIn.scripts === 'boolean') {
    run.scripts = runIn.scripts;
  } else {
    const arr = asStringArray(runIn.scripts);
    if (arr) run.scripts = arr;
  }
  if (Object.keys(run).length) out.run = run;
  const patch: CliDefaultsPatch = {};
  const pf = asString(patchIn.file);
  if (pf !== undefined) patch.file = pf;
  if (Object.keys(patch).length) out.patch = patch;
  const snap: CliDefaultsSnap = {};
  const st = asBool(snapIn.stash);
  if (typeof st === 'boolean') snap.stash = st;
  if (Object.keys(snap).length) out.snap = snap;
  return Object.keys(out).length ? out : undefined;
};

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

/**
 * Resolve the absolute path to the nearest `stan.config.*` starting from `cwd`.
 *
 * @param cwd - Directory to start searching from.
 * @returns Absolute path to the config file, or `null` if none found.
 */
export const findConfigPathSync = (cwd: string): string | null => {
  // direct in cwd
  const direct = tryConfigHere(cwd);
  if (direct) return direct;

  // ascend package roots
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

/**
 * Resolve `stanPath` for a given `cwd`.
 * Falls back to {@link DEFAULT_STAN_PATH} when no config is present.
 *
 * @param cwd - Directory to search from.
 */
export const resolveStanPathSync = (cwd: string): string => {
  try {
    return loadConfigSync(cwd).stanPath;
  } catch {
    return DEFAULT_STAN_PATH;
  }
};

/**
 * Async variant of {@link resolveStanPathSync}.
 *
 * @param cwd - Directory to search from.
 * @returns Resolved stanPath or the default when no config exists.
 */
export const resolveStanPath = async (cwd: string): Promise<string> => {
  try {
    const cfg = await loadConfig(cwd);
    return cfg.stanPath;
  } catch {
    return DEFAULT_STAN_PATH;
  }
};

/**
 * Ensure the STAN workspace exists and manage output/diff subdirectories.
 *
 * Behavior:
 * - Always ensure `stanPath/output` and `stanPath/diff` exist.
 * - Also ensure `stanPath/patch` exists so archives can include it.
 * - When `keep === false`, copy `output/archive.tar` to `diff/archive.prev.tar`
 *   if present, then clear only the `output` directory.
 *
 * @param cwd - Repo root.
 * @param stanPath - Workspace folder (e.g., `.stan`).
 * @param keep - When `true`, do not clear the output directory.
 * @returns Absolute path to the workspace root (`stanPath`).
 */
export const ensureOutputDir = async (
  cwd: string,
  stanPath: string,
  keep = false,
): Promise<string> => {
  const dirs = makeStanDirs(cwd, stanPath);

  await mkdir(dirs.rootAbs, { recursive: true });
  await mkdir(dirs.outputAbs, { recursive: true });
  await mkdir(dirs.diffAbs, { recursive: true });
  // Also ensure the patch workspace exists for diff/archives that include it
  await mkdir(dirs.patchAbs, { recursive: true });

  if (!keep) {
    const archiveTar = resolve(dirs.outputAbs, 'archive.tar');
    if (existsSync(archiveTar)) {
      try {
        await copyFile(archiveTar, resolve(dirs.diffAbs, 'archive.prev.tar'));
      } catch {
        // ignore copy errors
      }
    }

    const entries = await readdir(dirs.outputAbs, { withFileTypes: true });
    for (const e of entries) {
      rmSync(resolve(dirs.outputAbs, e.name), { recursive: true, force: true });
    }
  }

  return dirs.rootAbs;
};
