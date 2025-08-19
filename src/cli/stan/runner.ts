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
 * NEW (robust enumeration):
 * - Robustly recover enumerated script keys:
 *   - Prefer the action parameter (enumerated).
 *   - Then use command.args (non-option operands).
 *   - Also consult command.processedArgs (Commander keeps parsed values here),
 *     flattening nested arrays produced by variadic args.
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

/** Flatten nested arrays of unknown values to a string[] (dropping non-strings). */
const flattenStrings = (vals: unknown): string[] => {
  if (!Array.isArray(vals)) return [];
  const out: string[] = [];
  const stack: unknown[] = [...vals];
  while (stack.length) {
    const v = stack.shift();
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) stack.unshift(...v);
  }
  return out;
};

/**
 * REQUIREMENT: robustly recover enumerated script keys from Commander.
 * - Prefer action parameter (enumerated).
 * - Else fall back to command.args (filtering out option tokens).
 * - Also inspect command.processedArgs (Commander’s parsed argument values),
 *   flattening to strings (covers variadic args when action param is empty).
 * - Filter to known script keys (plus "archive").
 */
const recoverEnumerated = (
  command: Command,
  enumerated: string[] | undefined,
  known: Set<string>,
): string[] | undefined => {
  const out: string[] = [];

  // 1) Action parameter (preferred)
  if (Array.isArray(enumerated) && enumerated.length) {
    out.push(...enumerated);
  }

  // 2) Fallback: command.args (non-option operands)
  const args = (command as unknown as { args?: unknown[] }).args;
  if (Array.isArray(args) && args.length) {
    for (const v of args) {
      if (typeof v === 'string' && !v.startsWith('-')) out.push(v);
    }
  }

  // 3) Fallback: processedArgs (Commander keeps parsed values here)
  const processed = (command as unknown as { processedArgs?: unknown[] })
    .processedArgs;
  if (Array.isArray(processed) && processed.length) {
    out.push(...flattenStrings(processed));
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
      enumerated: string[] | undefined,
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

      // Determine operands robustly: prefer action parameter, then args, then processedArgs.
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
