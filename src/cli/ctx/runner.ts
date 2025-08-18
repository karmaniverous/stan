/**
 * @file src/cli/ctx/runner.ts
 * Registers the default (root) `ctx` command that runs scripts and manages artifacts.
 *
 * NOTE: Global requirements are defined in /requirements.md.
 */
import type { Command } from '@commander-js/extra-typings';
import path from 'node:path';
import { findConfigPathSync, loadConfig } from '../../context/config';
import { renderAvailableScriptsHelp } from '../../context/help';
import { runSelected, type ExecutionMode, type RunBehavior } from '../../context/run';

type Selection =
  | undefined
  | null
  | string[]
  | { include: string[]; except?: boolean };

const coerceSelection = (
  args: string[],
  exceptFlag?: boolean,
): Selection => {
  if (!args || args.length === 0) return undefined;
  if (exceptFlag) return { include: args, except: true };
  return { include: args };
};

export const registerRunner = (cli: Command): Command => {
  return cli
    .argument('[scripts...]', 'script keys to run')
    .option('-e, --except', 'treat listed scripts as an exclusion set')
    .option('-s, --sequential', 'run scripts sequentially')
    .option('-c, --combine', 'combine outputs')
    .option('-k, --keep', 'keep output directory contents (no clear)')
    .option('-d, --diff', 'write archive.diff.tar when archive is included')
    .option('-n, --name <base>', 'base name for combined artifacts (e.g. "combined")')
    .action(async (scripts: string[] | undefined, opts: {
      except?: boolean;
      sequential?: boolean;
      combine?: boolean;
      keep?: boolean;
      diff?: boolean;
      name?: string;
    }) => {
      const cwd = process.cwd();
      // Autodetect config in CWD
      const configPath = findConfigPathSync(cwd);
      if (!configPath) {
        // Helpful message and exit early.
        console.log(renderAvailableScriptsHelp(cwd));
        return;
      }
      const config = await loadConfig(cwd);

      const selection = coerceSelection(scripts ?? [], Boolean(opts.except));
      const mode: ExecutionMode = opts.sequential ? 'sequential' : 'concurrent';
      const behavior: RunBehavior = {
        combine: Boolean(opts.combine),
        keep: Boolean(opts.keep),
        diff: Boolean(opts.diff),
        combinedFileName: opts.name,
      };

      const created = await runSelected(cwd, config, selection, mode, behavior);
      if (created.length === 0) {
        // Show contextual help if nothing was produced.
        console.log(renderAvailableScriptsHelp(cwd));
      } else {
        // Nicety for humans running the CLI: show relative paths.
        const rel = (p: string) => path.relative(cwd, p) || '.';
        for (const p of created) console.log(`ctx: wrote ${rel(p)}`);
      }
    });
};
