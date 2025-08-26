/* src/stan/config/types.ts
 * Shared types for STAN configuration and CLI defaults.
 */

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
  /** Maximum retained snapshot "undos" (history depth for snap undo/redo). */
  maxUndos?: number;
  /** Optional developer-mode switch to treat the current repo as the STAN dev module. */
  devMode?: boolean;
  /**
   * Command template to open modified files after a successful patch.
   * Tokens: `{file}` expands to a repo‑relative file path.
   * Default: `code -g {file}`.
   */
  patchOpenCommand?: string;
  /** Optional bag for phase-scoped CLI defaults and future options. */
  opts?: ContextOpts;
};
