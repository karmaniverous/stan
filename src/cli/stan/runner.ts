/* src/cli/stan/runner.ts
 * CLI adapter for "stan run" with the current selection model.
 */
import path from 'node:path';

import { Command, CommanderError, Option } from 'commander';

import { renderAvailableScriptsHelp } from '@/stan/help';
import { runSelected } from '@/stan/run';
import { renderRunPlan } from '@/stan/run/plan';

import { applyCliSafety } from './cli-utils';
import { deriveRunInvocation } from './run-args';

export const registerRun = (cli: Command): Command => {
  const cmd = cli
    .command('run')
    .description('Run configured scripts to generate STAN artifacts')
    .option(
      '-s, --scripts [keys...]',
      'script keys to run (all scripts if omitted)',
    )
    .option(
      '-x, --except-scripts <keys...>',
      'script keys to exclude (reduces from --scripts or from full set)',
    )
    .option('-q, --sequential', 'run sequentially in config order')
    // Legacy explicit archive flag; archiving is now ON by default.
    .option('-a, --archive', 'create archive.tar and archive.diff.tar')
    .addOption(
      new Option('-A, --no-archive', 'do not create archives').conflicts(
        'archive',
      ),
    )
    .addOption(
      new Option('-S, --no-scripts', 'do not run scripts').conflicts([
        'scripts',
        'exceptScripts',
      ]),
    )
    .option('-p, --plan', 'print run plan and exit (no side effects)')
    .option('-k, --keep', 'keep (do not clear) the output directory');

  applyCliSafety(cmd);

  const combineOpt = new Option(
    '-c, --combine',
    'include script outputs inside archives and do not keep them on disk',
  )
    .implies({ archive: true })
    .conflicts(['keep']);

  cmd.addOption(combineOpt);

  cmd.addHelpText('after', () => renderAvailableScriptsHelp(process.cwd()));

  cmd.action(async (options: Record<string, unknown>) => {
    const opts = options;

    const cwdInitial = process.cwd();
    const cfgMod = await import('@/stan/config');

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
    ): v is { stanPath: string; scripts: Record<string, string> } =>
      !!v &&
      typeof v === 'object' &&
      typeof (v as { stanPath?: unknown }).stanPath === 'string' &&
      typeof (v as { scripts?: unknown }).scripts === 'object';

    const config = isContextConfig(maybe)
      ? maybe
      : { stanPath: 'stan', scripts: {} as Record<string, string> };

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

    const archiveFlag = Boolean((opts as { archive?: unknown }).archive);
    const noArchive = Boolean((opts as { noArchive?: unknown }).noArchive);
    const combine = Boolean((opts as { combine?: unknown }).combine);
    const sequential = Boolean((opts as { sequential?: unknown }).sequential);
    const keep = Boolean((opts as { keep?: unknown }).keep);
    const noScripts = Boolean((opts as { noScripts?: unknown }).noScripts);
    const planOnly = Boolean((opts as { plan?: unknown }).plan);

    const derived = deriveRunInvocation({
      scriptsProvided,
      scriptsOpt,
      exceptProvided,
      exceptOpt,
      sequential,
      combine,
      keep,
      archive: archiveFlag,
      config,
    });

    // Explicit conflict: -c with -A (Commander does not understand booleans here by default)
    if (combine && noArchive) {
      throw new CommanderError(
        1,
        'commander.conflictingOption',
        "error: option '-c, --combine' cannot be used with option '-A, --no-archive'",
      );
    }
    const allKeys = Object.keys(config.scripts);
    let selection = derived.selection;
    if (noScripts) selection = [];
    else if (!scriptsProvided && !exceptProvided) selection = [...allKeys];

    const mode = sequential ? 'sequential' : 'concurrent';
    const behavior = {
      combine,
      keep,
      archive: !noArchive,
    };

    const planBody = renderRunPlan(runCwd, {
      selection,
      config,
      mode,
      behavior,
    });

    if (noScripts && behavior.archive === false) {
      console.log(
        'stan: nothing to do; plan only (scripts disabled, archive disabled)',
      );
      console.log(planBody);
      return;
    }

    if (planOnly) {
      console.log(planBody);
      return;
    }

    await runSelected(runCwd, config, selection, mode, behavior);
  });

  return cli;
};
