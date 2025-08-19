// src/cli/stan/runner.ts
/**
 * REQUIREMENTS (current):
 * - Register subcommand `stan run` with:
 *   - positional `[scripts...]` (string[])
 *   - options:
 *     - `-e, --except <keys...>` to exclude keys
 *     - `-s, --sequential` to run sequentially
 *     - `-c, --combine` to create a combined artifact
 *     - `-k, --keep` to keep (not clear) the output directory
 *     - `-d, --diff` to create `archive.diff.tar` when archive is included
 *   - NOTE: `combinedFileName` is read from config only; there is no CLI option.
 * - Load config, compute final selection, call runSelected(cwd, config, selection, mode, behavior).
 * - On empty result, print renderAvailableScriptsHelp(cwd).
 * - Avoid `any`; keep imports via `@/*` alias.
 *
 * NEW (robust enumeration & lint-safe):
 * - Robustly recover enumerated script keys:
 *   - Accept action parameter as string | string[].
 *   - Then use command.args (non-option operands).
 *   - If no known keys found yet, aggregate tokens from command and parent
 *     (rawArgs + args) and parse them, skipping -e/--except value blocks.
 *   - Filter to known script keys (plus "archive"), dedupe, preserve order.
 */
import type { Command } from 'commander';

import { renderAvailableScriptsHelp } from '@/stan/help';
import { type ExecutionMode, type RunBehavior, runSelected } from '@/stan/run';

const computeSelection = (
  allKeys: string[],
  enumerated?: string[] | null,
  except?: string[],
): string[] | null => {
  let selected: string[] | null =
    Array.isArray(enumerated) && enumerated.length ? [...enumerated] : null;

  if (Array.isArray(except) && except.length) {
    const base = selected ?? allKeys;
    selected = base.filter((k) => !except.includes(k));
  }

  return selected;
};

/** Collect all string leaves from an unknown value (recursively handles nested arrays). */
const stringsFrom = (v: unknown): string[] => {
  const out: string[] = [];
  const walk = (x: unknown): void => {
    if (typeof x === 'string') {
      out.push(x);
    } else if (Array.isArray(x)) {
      for (const el of x) walk(el);
    }
  };
  walk(v);
  return out;
};

/** Parse tokens, skipping -e/--except value blocks, capturing non-option operands. */
const enumeratedFromTokens = (command: Command, tokens: string[]): string[] => {
  if (tokens.length === 0) return [];

  // Anchor at subcommand name if present
  const subName = command.name();
  const startIdx = tokens.indexOf(subName);
  let i = startIdx >= 0 ? startIdx + 1 : 0;

  const out: string[] = [];
  while (i < tokens.length) {
    const t = tokens[i];

    // Skip -e/--except values (variadic until next option)
    if (t === '-e' || t === '--except') {
      i += 1;
      while (i < tokens.length && !tokens[i].startsWith('-')) i += 1;
      continue;
    }

    // Skip other flags (no values)
    if (t.startsWith('-')) {
      i += 1;
      continue;
    }

    // Operand → enumerated script key candidate
    out.push(t);
    i += 1;
  }

  return out;
};

/**
 * REQUIREMENT: robustly recover enumerated script keys from Commander.
 * - Prefer action parameter (string | string[]).
 * - Else fall back to command.args (filtering out option tokens).
 * - If no known keys found yet, aggregate tokens from command/parent and parse them.
 * - Filter to known script keys (plus "archive").
 */
const recoverEnumerated = (
  command: Command,
  enumerated: unknown,
  known: Set<string>,
): string[] | undefined => {
  const out: string[] = [];

  // 1) Action parameter (may be string or string[])
  for (const s of stringsFrom(enumerated)) out.push(s);

  // 2) Fallback: command.args (non-option operands)
  const args = (command as unknown as { args?: unknown[] }).args;
  if (Array.isArray(args) && args.length) {
    for (const v of args) {
      if (typeof v === 'string' && !v.startsWith('-')) out.push(v);
      else if (Array.isArray(v)) {
        for (const s of stringsFrom(v)) out.push(s);
      }
    }
  }

  // If no known keys yet, aggregate broader tokens and parse them
  const cleanedFirst = out.filter((k) => known.has(k));
  if (cleanedFirst.length === 0) {
    const parent = (command as unknown as { parent?: unknown }).parent as
      | Command
      | undefined;

    const tokens: string[] = [
      // Prefer rawArgs where available
      ...stringsFrom(
        (command as unknown as { rawArgs?: unknown[] }).rawArgs ?? [],
      ),
      ...stringsFrom(
        (parent as unknown as { rawArgs?: unknown[] } | undefined)?.rawArgs ??
          [],
      ),
      // Then args
      ...stringsFrom((command as unknown as { args?: unknown[] }).args ?? []),
      ...stringsFrom(
        (parent as unknown as { args?: unknown[] } | undefined)?.args ?? [],
      ),
    ];

    for (const s of enumeratedFromTokens(command, tokens)) out.push(s);
  }

  // Deduplicate (preserve order) and filter to known keys
  const cleaned = out.filter((k) => known.has(k));
  const uniqueOrdered = cleaned.filter((k, i) => cleaned.indexOf(k) === i);

  return uniqueOrdered.length ? uniqueOrdered : undefined;
};

export const registerRun = (cli: Command): Command => {
  const cmd = cli
    .command('run')
    .description('Run configured scripts to generate STAN artifacts')
    .argument('[scripts...]', 'script keys to run')
    .option('-e, --except <keys...>', 'script keys to exclude')
    .option('-s, --sequential', 'run sequentially in config order')
    .option('-c, --combine', 'create a combined artifact')
    .option('-k, --keep', 'keep (do not clear) the output directory')
    .option('-d, --diff', 'create archive.diff.tar when archive is included');

  // Help footer: list configured script keys
  cmd.addHelpText('after', () => renderAvailableScriptsHelp(process.cwd()));

  cmd.action(
    async (
      enumerated: unknown,
      opts: Record<string, unknown>,
      command: Command,
    ) => {
      const cwd = process.cwd();

      // Dynamic import to ensure Vitest mocks are respected in tests.
      const cfgMod = await import('@/stan/config');

      // Guard loadConfig to avoid undefined in mocked/test scenarios.
      let maybe: unknown;
      try {
        maybe = await cfgMod.loadConfig(cwd);
      } catch {
        maybe = undefined;
      }

      const isContextConfig = (
        v: unknown,
      ): v is {
        outputPath: string;
        scripts: Record<string, string>;
        combinedFileName?: string;
      } =>
        !!v &&
        typeof v === 'object' &&
        typeof (v as { outputPath?: unknown }).outputPath === 'string' &&
        typeof (v as { scripts?: unknown }).scripts === 'object';

      const config = isContextConfig(maybe)
        ? maybe
        : { outputPath: 'stan', scripts: {} as Record<string, string> };

      const keys = Object.keys(config.scripts);

      // Determine operands robustly: param, then args, with aggregated-token fallback if needed.
      const known = new Set([...keys, 'archive']);
      const enumeratedClean = recoverEnumerated(command, enumerated, known);

      const selection = computeSelection(
        keys,
        enumeratedClean ?? null,
        (opts as { except?: string[] }).except,
      );

      const mode: ExecutionMode = (opts as { sequential?: boolean }).sequential
        ? 'sequential'
        : 'concurrent';

      const behavior: RunBehavior = {
        combine: Boolean((opts as { combine?: boolean }).combine),
        keep: Boolean((opts as { keep?: boolean }).keep),
        diff: Boolean((opts as { diff?: boolean }).diff),
        // No CLI option; honor config only.
        combinedFileName: config.combinedFileName,
      };

      const created = await runSelected(cwd, config, selection, mode, behavior);

      // Print help footer when nothing is created (empty selection or unknown keys).
      if (!Array.isArray(created) || created.length === 0) {
        console.log(renderAvailableScriptsHelp(cwd));
      }
    },
  );

  return cli;
};
