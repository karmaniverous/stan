/* src/cli/stan/runner.ts
 * CLI adapter for "stan run" with the new selection model.
 */
import path from 'node:path';

import { Command, Option } from 'commander';

import { renderAvailableScriptsHelp } from '@/stan/help';
import { runSelected } from '@/stan/run';

import { applyCliSafety } from './cli-utils';
import { deriveRunInvocation } from './run-args';

const stringsFrom = (v: unknown): string[] =>
  Array.isArray(v) ? v.flatMap((x) => (typeof x === 'string' ? [x] : [])) : [];

export const registerRun = (cli: Command): Command => {
  const cmd = cli
    .command('run')
    .description('Run configured scripts to generate STAN artifacts')
    // NEW selection flags
    .option(
      '-s, --scripts [keys...]',
      'script keys to run (all scripts if omitted)',
    )
    .option(
      '-x, --except-scripts <keys...>',
      'script keys to exclude (reduces from --scripts or from full set)',
    )
    // NEW sequential flag (moved from -s to -q)
    .option('-q, --sequential', 'run sequentially in config order')
    // Existing behavior flags
    .option('-a, --archive', 'create archive.tar and archive.diff.tar')
    .option('-k, --keep', 'keep (do not clear) the output directory');

  applyCliSafety(cmd);

  // -c implies -a; -c conflicts -k; requires -s or -x (validated manually)
  const combineOpt = new Option(
    '-c, --combine',
    'include script outputs inside archives and do not keep them on disk',
  )
    .implies({ archive: true })
    .conflicts('keep');

  cmd.addOption(combineOpt);

  // Help footer: list configured script keys
  cmd.addHelpText('after', () => renderAvailableScriptsHelp(process.cwd()));

  // Commander passes (options, command) to action when there are no positional args.
  cmd.action(async (options: Record<string, unknown>) => {
    const opts = options;

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
    ): v is { outputPath: string; scripts: Record<string, string> } =>
      !!v &&
      typeof v === 'object' &&
      typeof (v as { outputPath?: unknown }).outputPath === 'string' &&
      typeof (v as { scripts?: unknown }).scripts === 'object';

    const config = isContextConfig(maybe)
      ? maybe
      : { outputPath: 'stan', scripts: {} as Record<string, string> };

    // Validate flags per new rules
    const scriptsProvided = Object.prototype.hasOwnProperty.call(
      opts,
      'scripts',
    );
    const scriptsOpt = (opts as { scripts?: unknown }).scripts;
    const exceptProvided = Object.prototype.hasOwnProperty.call(
      opts,
      'exceptScripts',
    );
    const exceptOpt = (opts as { exceptScripts?: unknown }).exceptScripts;

    const archive = Boolean((opts as { archive?: unknown }).archive);
    const combine = Boolean((opts as { combine?: unknown }).combine);
    const sequential = Boolean((opts as { sequential?: unknown }).sequential);

    const exceptKeys = stringsFrom(exceptOpt);

    // One of -a, -s, -x must be present
    if (!(archive || scriptsProvided || exceptProvided)) {
      console.error(
        'stan: one of -a/--archive, -s/--scripts, or -x/--except-scripts is required',
      );
      console.log(renderAvailableScriptsHelp(runCwd));
      return;
    }

    // -x requires at least one key
    if (exceptProvided && exceptKeys.length === 0) {
      console.error('stan: -x/--except-scripts requires at least one key');
      console.log(renderAvailableScriptsHelp(runCwd));
      return;
    }

    // -q and -c require either -s or -x
    if ((sequential || combine) && !(scriptsProvided || exceptProvided)) {
      console.error(
        'stan: -q/--sequential and -c/--combine require -s/--scripts or -x/--except-scripts',
      );
      console.log(renderAvailableScriptsHelp(runCwd));
      return;
    }

    // Pure derivation of runSelected parameters
    const derived = deriveRunInvocation({
      scriptsProvided,
      scriptsOpt,
      exceptProvided,
      exceptOpt,
      sequential,
      combine,
      keep: (opts as { keep?: unknown }).keep,
      archive,
      config,
    });

    const created = await runSelected(
      runCwd,
      config,
      // selection is explicit list under new model
      derived.selection,
      derived.mode,
      derived.behavior,
    );

    // Print help footer when nothing is created (empty selection and no archives)
    if (!Array.isArray(created) || created.length === 0) {
      console.log(renderAvailableScriptsHelp(runCwd));
    }
  });

  return cli;
};
