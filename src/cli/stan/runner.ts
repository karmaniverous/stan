/* src/cli/stan/runner.ts
 * REQUIREMENTS (current):
 * - Register the main CLI command `stan` with:
 *   - positional [scripts...] (string[])
 *   - options: -e/--except, -s/--sequential, -c/--combine, -k/--keep, -d/--diff, --combined-file-name <name>
 * - Load config, compute final selection, call runSelected(cwd, config, selection, mode, behavior).
 * - If created artifacts array is empty (or undefined), print renderAvailableScriptsHelp(cwd).
 * - No "any"; use "@/..." alias for imports.
 * See /stan.project.md for global & cross‑cutting requirements.
 */
import type { Command } from 'commander';

import { loadConfig } from '@/stan/config';
import { renderAvailableScriptsHelp } from '@/stan/help';
import { type ExecutionMode, type RunBehavior, runSelected } from '@/stan/run';

/** Helper to compute final selection from positional args and -e/--except. */
const computeSelection = (
  allKeys: string[],
  enumerated: string[] | undefined,
  except: string[] | undefined,
): string[] | null => {
  if (enumerated && enumerated.length) {
    return except && except.length
      ? allKeys.filter((k) => !enumerated.includes(k))
      : enumerated;
  }
  if (except && except.length)
    return allKeys.filter((k) => !except.includes(k));
  return null;
};

export const registerRunner = (cli: Command): Command => {
  cli
    .argument('[scripts...]', 'script keys to run')
    .option('-e, --except <keys...>', 'script keys to exclude')
    .option('-s, --sequential', 'run sequentially')
    .option('-c, --combine', 'combine outputs into a single artifact')
    .option('-k, --keep', 'keep (do not clear) output directory')
    .option('-d, --diff', 'when running archive, also create archive.diff.tar')
    .option(
      '--combined-file-name <name>',
      'base name for combined artifacts (default: "combined")',
    )
    .action(
      async (
        enumerated: string[] | undefined,
        opts: {
          except?: string[];
          sequential?: boolean;
          combine?: boolean;
          keep?: boolean;
          diff?: boolean;
          combinedFileName?: string;
        },
      ) => {
        const cwd = process.cwd();
        const config = await loadConfig(cwd);
        const keys = Object.keys(config.scripts);
        const selection = computeSelection(keys, enumerated, opts.except);
        const mode: ExecutionMode = opts.sequential
          ? 'sequential'
          : 'concurrent';
        const behavior: RunBehavior = {
          combine: Boolean(opts.combine),
          keep: Boolean(opts.keep),
          diff: Boolean(opts.diff),
          combinedFileName: opts.combinedFileName ?? undefined,
        };

        const created = await runSelected(
          cwd,
          config,
          selection,
          mode,
          behavior,
        );

        if (!Array.isArray(created) || created.length === 0) {
          console.log(renderAvailableScriptsHelp(cwd));
        }
      },
    );
  return cli;
};
