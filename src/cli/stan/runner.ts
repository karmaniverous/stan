/* src/cli/stan/runner.ts
 * CLI adapter for "stan run" with the current selection model.
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
    .option(
      '-s, --scripts [keys...]',
      'script keys to run (all scripts if omitted)',
    )
    .option(
      '-x, --except-scripts <keys...>',
      'script keys to exclude (reduces from --scripts or from full set)',
    )
    .option('-q, --sequential', 'run sequentially in config order')
    .option('-a, --archive', 'create archive.tar and archive.diff.tar')
    .option('-k, --keep', 'keep (do not clear) the output directory');

  applyCliSafety(cmd);

  const combineOpt = new Option(
    '-c, --combine',
    'include script outputs inside archives and do not keep them on disk',
  )
    .implies({ archive: true })
    .conflicts('keep');

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

    const archive = Boolean((opts as { archive?: unknown }).archive);
    const combine = Boolean((opts as { combine?: unknown }).combine);
    const sequential = Boolean((opts as { sequential?: unknown }).sequential);

    const exceptKeys = Array.isArray(exceptOpt)
      ? (exceptOpt as unknown[]).flatMap((x) =>
          typeof x === 'string' ? [x] : [],
        )
      : [];

    if (!(archive || scriptsProvided || exceptProvided)) {
      console.error(
        'stan: one of -a/--archive, -s/--scripts, or -x/--except-scripts is required',
      );
      console.log(renderAvailableScriptsHelp(runCwd));
      return;
    }

    if (exceptProvided && exceptKeys.length === 0) {
      console.error('stan: -x/--except-scripts requires at least one key');
      console.log(renderAvailableScriptsHelp(runCwd));
      return;
    }

    if ((sequential || combine) && !(scriptsProvided || exceptProvided)) {
      console.error(
        'stan: -q/--sequential and -c/--combine require -s/--scripts or -x/--except-scripts',
      );
      console.log(renderAvailableScriptsHelp(runCwd));
      return;
    }

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

    await runSelected(
      runCwd,
      config,
      derived.selection,
      derived.mode,
      derived.behavior,
    );
  });

  return cli;
};
