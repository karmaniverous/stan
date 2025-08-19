/**
 * REQUIREMENTS (current):
 * - Register the main CLI command `stan` with:
 *   - positional `[scripts...]` (string[])
 *   - options:
 *     - `-e, --except <keys...>` to exclude keys
 *     - `-s, --sequential` to run sequentially
 *     - `-c, --combine` to create a combined artifact
 *     - `-k, --keep` to keep (not clear) the output directory
 *     - `-d, --diff` to create `archive.diff.tar` when archive is included
 *     - `--combined-file-name <name>` to override base name of combined artifacts
 * - Load config, compute final selection, call runSelected(cwd, config, selection, mode, behavior).
 * - On empty result, print renderAvailableScriptsHelp(cwd).
 * - Avoid `any`; keep imports via `@/*` alias.
 */
import type { Command } from 'commander';

import { renderAvailableScriptsHelp } from '@/stan/help';
import { type ExecutionMode, type RunBehavior, runSelected } from '@/stan/run';

/**
 * Compute the final selection list based on enumeration and --except.
 * Rules:
 * - If enumerated has entries, start with those; otherwise, start with null (meaning all).
 * - If --except is provided, remove excluded keys from the base (enumerated or all keys).
 * - Return null when no explicit selection and no excludes are present.
 */
const computeSelection = (
  allKeys: string[],
  enumerated?: string[],
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

export const registerRunner = (cli: Command): Command => {
  cli
    .argument('[scripts...]', 'script keys to run')
    .option('-e, --except <keys...>', 'script keys to exclude')
    .option('-s, --sequential', 'run sequentially in config order')
    .option('-c, --combine', 'create a combined artifact')
    .option('-k, --keep', 'keep (do not clear) the output directory')
    .option('-d, --diff', 'create archive.diff.tar when archive is included')
    .option(
      '--combined-file-name <name>',
      'override base name of combined artifacts',
    )
    .action(
      async (
        enumerated: string[] | undefined,
        opts: Record<string, unknown>,
      ) => {
        const cwd = process.cwd();

        // Dynamic import to ensure Vitest mocks are respected in tests.
        const { loadConfig } = await import('@/stan/config');
        const config = await loadConfig(cwd);
        const keys = Object.keys(config.scripts);

        // Sanitize enumerated args: ignore stray tokens like "node", "stan" etc.
        const known = new Set([...keys, 'archive']);
        const enumeratedClean =
          Array.isArray(enumerated) && enumerated.length
            ? enumerated.filter((k) => known.has(k))
            : undefined;

        const selection = computeSelection(
          keys,
          enumeratedClean,
          opts.except as string[] | undefined,
        );

        const mode: ExecutionMode = (opts as { sequential?: boolean })
          .sequential
          ? 'sequential'
          : 'concurrent';

        const behavior: RunBehavior = {
          combine: Boolean((opts as { combine?: boolean }).combine),
          keep: Boolean((opts as { keep?: boolean }).keep),
          diff: Boolean((opts as { diff?: boolean }).diff),
          combinedFileName: (opts as { combinedFileName?: string })
            .combinedFileName,
        };

        const created = await runSelected(
          cwd,
          config,
          selection,
          mode,
          behavior,
        );

        // Print help footer when nothing is created (empty selection or unknown keys).
        if (!Array.isArray(created) || created.length === 0) {
          console.log(renderAvailableScriptsHelp(cwd));
        }
      },
    );
  return cli;
};
