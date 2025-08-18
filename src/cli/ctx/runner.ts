/** See /requirements.md for global requirements. */
import type { Command } from 'commander';
import { loadConfig } from '@/context/config';
import { renderAvailableScriptsHelp } from '@/context/help';
import { type RunBehavior, runSelected } from '@/context/run';

export const registerRunner = (cli: Command): Command =>
  cli
    .argument('[scripts...]', 'script keys to run')
    .option('-e, --except <keys...>', 'run all except these')
    .option('-s, --sequential', 'run the selected scripts sequentially')
    .option('-c, --combine', 'combine outputs')
    .option('-k, --keep', 'keep output directory (do not clear)')
    .option('-d, --diff', 'also compute archive.diff.tar (when "archive" is selected)')
    .option('--combined-file-name <name>', 'override combined base name (default: "combined")')
    .action(async (scripts: string[] | undefined, opts: Record<string, unknown>) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd);

      const behavior: RunBehavior = {
        except: (opts.except as string[] | undefined) ?? undefined,
        sequential: Boolean(opts.sequential),
        combine: Boolean(opts.combine),
        keep: Boolean(opts.keep),
        diff: Boolean(opts.diff),
        combinedFileName: (opts.combinedFileName as string | undefined) ?? undefined
      };

      const created = await runSelected(cwd, config, scripts && scripts.length ? scripts : null, behavior);
      if (created.length === 0) {
        console.log(renderAvailableScriptsHelp(cwd));
      }
    });
