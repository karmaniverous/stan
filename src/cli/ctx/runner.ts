/** See /requirements.md for global requirements. */
import type { Command } from '@commander-js/extra-typings';
import { loadConfig } from '@/context/config';
import { renderAvailableScriptsHelp } from '@/context/help';
import { type ExecutionMode, type RunBehavior, runSelected } from '@/context/run';

/** Helper to compute final selection from positional args and -e/--except. */
const computeSelection = (
  allKeys: string[],
  enumerated: string[] | undefined,
  except: string[] | undefined
): string[] | null => {
  if (enumerated && enumerated.length) {
    return except && except.length ? allKeys.filter((k) => !enumerated.includes(k)) : enumerated;
  }
  if (except && except.length) return allKeys.filter((k) => !except.includes(k));
  return null; // null means "all"
};

export const registerRunner = <C extends Command>(cli: C): C =>
  cli
    .argument('[scripts...]', 'script keys to run')
    .option('-e, --except <keys...>', 'run all except these')
    .option('-s, --sequential', 'run the selected scripts sequentially')
    .option('-c, --combine', 'combine outputs')
    .option('-k, --keep', 'keep output directory (do not clear)')
    .option('-d, --diff', 'also compute archive.diff.tar (when "archive" is selected)')
    .option('--combined-file-name <name>', 'override combined base name (default: "combined")')
    .action(async (enumerated: string[] | undefined, opts: Record<string, unknown>) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd);
      const keys = Object.keys(config.scripts);

      const selection = computeSelection(keys, enumerated, opts.except as string[] | undefined);
      const mode: ExecutionMode = opts.sequential ? 'sequential' : 'concurrent';

      const behavior: RunBehavior = {
        combine: Boolean(opts.combine),
        keep: Boolean(opts.keep),
        diff: Boolean(opts.diff),
        combinedFileName: (opts.combinedFileName as string | undefined) ?? undefined
      };

      const created = await runSelected(cwd, config, selection, mode, behavior);
      if (created.length === 0) {
        console.log(renderAvailableScriptsHelp(cwd));
      }
    });
