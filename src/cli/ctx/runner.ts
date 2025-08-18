/**
 * @file src/cli/ctx/runner.ts
 * @description Registers the default (root) `ctx` command that runs scripts and manages artifacts.
 */
import type { Command } from 'commander';

import { loadConfig } from '../../context/config';
import { renderAvailableScriptsHelp } from '../../context/help';
import { type RunBehavior,runSelected } from '../../context/run';

export const registerRunner = (cli: Command): Command => {
  return cli
    .argument('[scripts...]', 'script keys to run')
    .option('-e, --except <keys...>', 'run all except these')
    .option('-s, --sequential', 'run scripts sequentially')
    .option('-c, --combine', 'combine outputs')
    .option('-k, --keep', 'keep the output directory (do not clear)')
    .option('-d, --diff', 'also compute an archive diff (when `archive` is included)')
    .option('--combined-file-name <name>', 'override the combined output base name (default: "combined")')
    .action(async (scripts: string[] | undefined, opts: Record<string, unknown>) => {
      const cwd = process.cwd();
      const config = await loadConfig(cwd, { autoInitIfMissing: true });

      const behavior: RunBehavior = {
        except: (opts.except as string[] | undefined) ?? undefined,
        sequential: Boolean(opts.sequential),
        combine: Boolean(opts.combine),
        keep: Boolean(opts.keep),
        diff: Boolean(opts.diff),
        combinedFileName: (opts.combinedFileName as string | undefined) ?? undefined,
      };

      const created = await runSelected(cwd, config, scripts ?? null, behavior);

      if (created.length === 0) {
         
        console.log(renderAvailableScriptsHelp(config));
      }
    });
};
