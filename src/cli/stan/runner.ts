/* src/cli/stan/runner.ts
 * CLI adapter for "stan run".
 * Now delegates selection/mode/behavior derivation to a pure helper to make
 * tests deterministic and decouple from Commander internals.
 */
import path from 'node:path';

import { Command, Option } from 'commander';

import { renderAvailableScriptsHelp } from '@/stan/help';
import { runSelected } from '@/stan/run';

import { applyCliSafety } from './cli-utils';
import { deriveRunInvocation } from './run-args';

export const registerRun = (cli: Command): Command => {
  const cmd = cli
    .command('run')
    .description('Run configured scripts to generate STAN artifacts')
    .argument('[scripts...]', 'script keys to run')
    .option('-e, --except <keys...>', 'script keys to exclude')
    .option('-s, --sequential', 'run sequentially in config order')
    .option('-a, --archive', 'create archive.tar and archive.diff.tar')
    .option('-k, --keep', 'keep (do not clear) the output directory')
    .option('-d, --debug', 'enable verbose debug logging');

  applyCliSafety(cmd);

  // -c implies -a; -c conflicts -k
  const combineOpt = new Option(
    '-c, --combine',
    'include script outputs inside archives and do not keep them on disk',
  )
    .implies({ archive: true })
    .conflicts('keep');

  cmd.addOption(combineOpt);

  // Help footer: list configured script keys
  cmd.addHelpText('after', () => renderAvailableScriptsHelp(process.cwd()));

  cmd.action(async (enumerated: unknown, opts: Record<string, unknown>) => {
    if (opts && (opts as { debug?: unknown }).debug) {
      process.env.STAN_DEBUG = '1';
    }

    const cwdInitial = process.cwd();

    // Dynamic import to ensure Vitest mocks are respected in tests.
    const cfgMod = await import('@/stan/config');

    // Resolve config and working directory:
    // - If config exists: run from the directory that contains it (nearest package root with config).
    // - Else: run from current cwd with default config.
    const cfgPath = cfgMod.findConfigPathSync(cwdInitial);
    const runCwd = cfgPath ? path.dirname(cfgPath) : cwdInitial;

    let maybe: unknown;
    try {
      maybe = await cfgMod.loadConfig(runCwd);
    } catch (err) {
      if (process.env.STAN_DEBUG === '1') {
        console.error('stan: failed to load config', err);
      }
      maybe = undefined;
    }

    const isContextConfig = (
      v: unknown,
    ): v is {
      outputPath: string;
      scripts: Record<string, string>;
    } =>
      !!v &&
      typeof v === 'object' &&
      typeof (v as { outputPath?: unknown }).outputPath === 'string' &&
      typeof (v as { scripts?: unknown }).scripts === 'object';

    const config = isContextConfig(maybe)
      ? maybe
      : { outputPath: 'stan', scripts: {} as Record<string, string> };

    // Pure derivation of runSelected parameters
    const derived = deriveRunInvocation({
      enumerated,
      except: (opts as { except?: unknown }).except,
      sequential: (opts as { sequential?: unknown }).sequential,
      combine: (opts as { combine?: unknown }).combine,
      keep: (opts as { keep?: unknown }).keep,
      archive: (opts as { archive?: unknown }).archive,
      config,
    });

    const created = await runSelected(
      runCwd,
      config,
      derived.selection,
      derived.mode,
      derived.behavior,
    );

    // Print help footer when nothing is created (empty selection or unknown keys).
    if (!Array.isArray(created) || created.length === 0) {
      console.log(renderAvailableScriptsHelp(runCwd));
    }
  });

  return cli;
};
