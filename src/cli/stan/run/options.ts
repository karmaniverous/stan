import { Command, Option } from 'commander';

import { findConfigPathSync, loadConfigSync } from '@/stan/config';
import { renderAvailableScriptsHelp } from '@/stan/help';

import { applyCliSafety } from '../cli-utils';

export type FlagPresence = {
  sawNoScriptsFlag: boolean;
  sawScriptsFlag: boolean;
  sawExceptFlag: boolean;
};

const tagDefault = (opt: Option, on: boolean): void => {
  if (on && !opt.description.includes('(DEFAULT)')) {
    opt.description = `${opt.description} (DEFAULT)`;
  }
};

/**
 * Register the `run` subcommand options and default tagging.
 * Returns the configured subcommand and a getter for raw flag presence.
 */
export const registerRunOptions = (
  cli: Command,
): {
  cmd: Command;
  getFlagPresence: () => FlagPresence;
} => {
  const cmd = cli
    .command('run')
    .description(
      'Run configured scripts to produce text outputs and archives (full + diff).',
    );

  // Selection flags
  const optScripts = new Option(
    '-s, --scripts [keys...]',
    'script keys to run (all scripts if omitted)',
  );
  const optExcept = new Option(
    '-x, --except-scripts <keys...>',
    'script keys to exclude (reduces from --scripts or from full set)',
  );

  // Mode flags
  const optSequential = new Option(
    '-q, --sequential',
    'run sequentially (with -s uses listed order; otherwise config order)',
  );
  const optNoSequential = new Option(
    '-Q, --no-sequential',
    'run concurrently (negated form)',
  );

  // Archive/outputs
  const optArchive = new Option(
    '-a, --archive',
    'create archive.tar and archive.diff.tar',
  );
  const optNoArchive = new Option('-A, --no-archive', 'do not create archives');
  const optCombine = new Option(
    '-c, --combine',
    'include script outputs inside archives and do not keep them on disk',
  )
    .implies({ archive: true })
    .conflicts(['keep']);
  const optNoCombine = new Option(
    '-C, --no-combine',
    'do not include outputs inside archives',
  );

  // Output dir & scripts suppressor
  const optKeep = new Option(
    '-k, --keep',
    'keep (do not clear) the output directory',
  );
  const optNoKeep = new Option(
    '-K, --no-keep',
    'do not keep the output directory (negated form)',
  );
  const optNoScripts = new Option('-S, --no-scripts', 'do not run scripts');

  // Plan
  const optPlan = new Option(
    '-p, --plan',
    'print run plan and exit (no side effects)',
  );

  cmd
    .addOption(optScripts)
    .addOption(optExcept)
    .addOption(optSequential)
    .addOption(optNoSequential)
    .addOption(optArchive)
    .addOption(optNoArchive)
    .addOption(optCombine)
    .addOption(optNoCombine)
    .addOption(optKeep)
    .addOption(optNoKeep)
    .addOption(optNoScripts)
    .addOption(optPlan);

  // Track raw presence of selection flags during parse to enforce -S vs -s/-x conflicts.
  let sawNoScriptsFlag = false;
  let sawScriptsFlag = false;
  let sawExceptFlag = false;
  cmd.on('option:no-scripts', () => {
    sawNoScriptsFlag = true;
  });
  cmd.on('option:scripts', () => {
    sawScriptsFlag = true;
  });
  cmd.on('option:except-scripts', () => {
    sawExceptFlag = true;
  });

  applyCliSafety(cmd);

  // Tag defaults (config overrides > built-ins)
  try {
    const p = findConfigPathSync(process.cwd());
    const cfg = p ? loadConfigSync(process.cwd()) : null;
    const runDefs = (cfg?.opts?.cliDefaults?.run ?? {}) as {
      archive?: boolean;
      combine?: boolean;
      keep?: boolean;
      sequential?: boolean;
      scripts?: boolean | string[];
    };
    const dArchive =
      typeof runDefs.archive === 'boolean' ? runDefs.archive : true;
    const dCombine =
      typeof runDefs.combine === 'boolean' ? runDefs.combine : false;
    const dKeep = typeof runDefs.keep === 'boolean' ? runDefs.keep : false;
    const dSeq =
      typeof runDefs.sequential === 'boolean' ? runDefs.sequential : false;
    tagDefault(dArchive ? optArchive : optNoArchive, true);
    tagDefault(dCombine ? optCombine : optNoCombine, true);
    tagDefault(dKeep ? optKeep : optNoKeep, true);
    tagDefault(dSeq ? optSequential : optNoSequential, true);
    if (runDefs.scripts === false) tagDefault(optNoScripts, true);
  } catch {
    tagDefault(optArchive, true);
    tagDefault(optNoCombine, true);
    tagDefault(optNoKeep, true);
    tagDefault(optNoSequential, true);
  }

  cmd.addHelpText('after', () => renderAvailableScriptsHelp(process.cwd()));

  return {
    cmd,
    getFlagPresence: () => ({
      sawNoScriptsFlag,
      sawScriptsFlag,
      sawExceptFlag,
    }),
  };
};
