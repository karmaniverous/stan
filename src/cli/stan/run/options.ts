import { Command, Option } from 'commander';

import { findConfigPathSync, loadConfigSync } from '@/stan/config';
import { renderAvailableScriptsHelp } from '@/stan/help';

import { applyCliSafety, tagDefault } from '../cli-utils';
import { RUN_BASE_DEFAULTS } from './defaults';

export type FlagPresence = {
  sawNoScriptsFlag: boolean;
  sawScriptsFlag: boolean;
  sawExceptFlag: boolean;
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
  const optNoScripts = new Option('-S, --no-scripts', 'do not run scripts');
  const optExcept = new Option(
    '-x, --except-scripts <keys...>',
    'script keys to exclude (reduces from --scripts or from full set)',
  );

  // Live TTY progress and hang thresholds
  const optLive = new Option(
    '-l, --live',
    'enable live progress table (TTY only)',
  );
  const optNoLive = new Option(
    '-L, --no-live',
    'disable live progress table (TTY only)',
  );
  const parsePositiveInt = (v: string): number => {
    const n = Number.parseInt(v, 10);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error('seconds must be a positive integer');
    }
    return n;
  };
  const optHangWarn = new Option(
    '--hang-warn <seconds>',
    'label “stalled” after N seconds of inactivity (TTY only)',
  ).argParser(parsePositiveInt);
  const optHangKill = new Option(
    '--hang-kill <seconds>',
    'terminate stalled scripts after N seconds (SIGTERM→grace→SIGKILL; TTY only)',
  ).argParser(parsePositiveInt);
  const optHangKillGrace = new Option(
    '--hang-kill-grace <seconds>',
    'grace period in seconds before SIGKILL after SIGTERM (TTY only)',
  ).argParser(parsePositiveInt);

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
  // Parse-time conflict: -c conflicts with -A (combine implies archives).
  optCombine.conflicts('archive');
  optNoArchive.conflicts('combine');

  // Output dir
  const optKeep = new Option(
    '-k, --keep',
    'keep (do not clear) the output directory',
  );
  const optNoKeep = new Option(
    '-K, --no-keep',
    'do not keep the output directory (negated form)',
  );

  // Plan
  const optPlan = new Option(
    '-p, --plan',
    'print run plan and exit (no side effects)',
  );

  // Register options in desired order
  cmd
    // selection first; -S directly after -s
    .addOption(optScripts)
    .addOption(optNoScripts)
    .addOption(optExcept)
    // mode
    .addOption(optSequential)
    .addOption(optNoSequential)
    // archives & outputs
    .addOption(optArchive)
    .addOption(optNoArchive)
    .addOption(optCombine)
    .addOption(optNoCombine)
    .addOption(optKeep)
    // live & thresholds
    .addOption(optLive)
    .addOption(optNoLive)
    .addOption(optHangWarn)
    .addOption(optHangKill)
    .addOption(optHangKillGrace)
    // remaining toggles & plan
    .addOption(optNoKeep)
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

  // Compute effective defaults from config (cliDefaults.run) over baseline
  const resolveRunDefaults = () => {
    try {
      const p = findConfigPathSync(process.cwd());
      const cfg = p ? loadConfigSync(process.cwd()) : null;
      const runDefs = (cfg?.cliDefaults?.run ?? {}) as {
        archive?: boolean;
        combine?: boolean;
        keep?: boolean;
        sequential?: boolean;
        scripts?: boolean | string[];
        live?: boolean;
        hangWarn?: number;
        hangKill?: number;
        hangKillGrace?: number;
      };
      return {
        archive:
          typeof runDefs.archive === 'boolean'
            ? runDefs.archive
            : RUN_BASE_DEFAULTS.archive,
        live:
          typeof runDefs.live === 'boolean'
            ? runDefs.live
            : RUN_BASE_DEFAULTS.live,
        combine:
          typeof runDefs.combine === 'boolean'
            ? runDefs.combine
            : RUN_BASE_DEFAULTS.combine,
        keep:
          typeof runDefs.keep === 'boolean'
            ? runDefs.keep
            : RUN_BASE_DEFAULTS.keep,
        sequential:
          typeof runDefs.sequential === 'boolean'
            ? runDefs.sequential
            : RUN_BASE_DEFAULTS.sequential,
        hangWarn:
          typeof runDefs.hangWarn === 'number' && runDefs.hangWarn > 0
            ? runDefs.hangWarn
            : RUN_BASE_DEFAULTS.hangWarn,
        hangKill:
          typeof runDefs.hangKill === 'number' && runDefs.hangKill > 0
            ? runDefs.hangKill
            : RUN_BASE_DEFAULTS.hangKill,
        hangKillGrace:
          typeof runDefs.hangKillGrace === 'number' && runDefs.hangKillGrace > 0
            ? runDefs.hangKillGrace
            : RUN_BASE_DEFAULTS.hangKillGrace,
      };
    } catch {
      return { ...RUN_BASE_DEFAULTS };
    }
  };
  const eff = resolveRunDefaults();

  // Tag defaulted boolean choices with (default)
  tagDefault(eff.archive ? optArchive : optNoArchive, true);
  tagDefault(eff.combine ? optCombine : optNoCombine, true);
  tagDefault(eff.keep ? optKeep : optNoKeep, true);
  tagDefault(eff.sequential ? optSequential : optNoSequential, true);
  tagDefault(eff.live ? optLive : optNoLive, true);

  // Apply Commander defaults for numeric thresholds so help shows (default: N)
  optHangWarn.default(eff.hangWarn);
  optHangKill.default(eff.hangKill);
  optHangKillGrace.default(eff.hangKillGrace);

  // Help footer
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
