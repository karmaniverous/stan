/* src/cli/stan/runner.ts
 * CLI adapter for "stan run" with the current selection model.
 */
import path from 'node:path';

import { Command, CommanderError, Option } from 'commander';

import { findConfigPathSync, loadConfigSync } from '@/stan/config';
import { renderAvailableScriptsHelp } from '@/stan/help';
import { runSelected } from '@/stan/run';
import { renderRunPlan } from '@/stan/run/plan';

import { applyCliSafety } from './cli-utils';
import { deriveRunInvocation } from './run-args';

const tagDefault = (opt: Option, on: boolean): void => {
  if (on && !opt.description.includes('(DEFAULT)')) {
    opt.description = `${opt.description} (DEFAULT)`;
  }
};

/**
 * Register the `run` subcommand on the provided root CLI.
 *
 * @param cli - Commander root command.
 * @returns The same root command for chaining.
 */
export const registerRun = (cli: Command): Command => {
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
  ); // Add all options
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
    // Built-ins already implied above; tags applied via defaults path
    tagDefault(optArchive, true); // archive defaults ON
    tagDefault(optNoCombine, true); // combine defaults OFF
    tagDefault(optNoKeep, true); // keep defaults OFF
    tagDefault(optNoSequential, true); // sequential defaults OFF
  }

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
    const cliDefs =
      config &&
      (config as { opts?: { cliDefaults?: Record<string, unknown> } }).opts
        ?.cliDefaults;
    const runDefs = (cliDefs?.run ?? {}) as {
      archive?: boolean;
      combine?: boolean;
      keep?: boolean;
      sequential?: boolean;
      scripts?: boolean | string[];
    };

    // Selection flags
    const scriptsOpt = (opts as { scripts?: unknown }).scripts;
    const exceptOpt = (opts as { exceptScripts?: unknown }).exceptScripts;
    // Presence: -s seen when scripts is array/string; -S sets scripts to false but also tracked via event.
    const scriptsProvided =
      Array.isArray(scriptsOpt) || typeof scriptsOpt === 'string';
    const exceptProvided =
      Array.isArray(exceptOpt) && (exceptOpt as unknown[]).length > 0;

    // Negated option -S/--no-scripts => scripts === false
    const noScripts = (opts as { scripts?: unknown }).scripts === false;

    // Archive flags:
    const archiveOpt = (opts as { archive?: unknown }).archive as
      | boolean
      | undefined;
    const archiveFlag = archiveOpt === true;
    const noArchiveFlag = archiveOpt === false;

    // Sources for flags — prefer CLI when present; otherwise config defaults.
    const src = (
      cmd as unknown as {
        getOptionValueSource?: (name: string) => string | undefined;
      }
    ).getOptionValueSource?.bind(cmd);

    const combine =
      src && src('combine') === 'cli'
        ? Boolean((opts as { combine?: unknown }).combine)
        : Boolean(runDefs.combine ?? false);
    const sequential =
      src && src('sequential') === 'cli'
        ? Boolean((opts as { sequential?: unknown }).sequential)
        : Boolean(runDefs.sequential ?? false);
    const keep =
      src && src('keep') === 'cli'
        ? Boolean((opts as { keep?: unknown }).keep)
        : Boolean(runDefs.keep ?? false);
    const planOnly = Boolean((opts as { plan?: unknown }).plan);

    // Manual conflict handling:
    // -S with -s or -x (detect by raw presence to handle last-wins semantics)
    // Commander parse-time conflicts removed to avoid -S self-conflicts; rely on these event guards.
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
    if (sawNoScriptsFlag && (sawScriptsFlag || sawExceptFlag)) {
      throw new CommanderError(
        1,
        'commander.conflictingOption',
        "error: option '-S, --no-scripts' cannot be used with option '-s, --scripts' or '-x, --except-scripts'",
      );
    }

    const allKeys = Object.keys(config.scripts);
    // Explicit conflict: -c with -A
    if (combine && noArchiveFlag) {
      throw new CommanderError(
        1,
        'commander.conflictingOption',
        "error: option '-c, --combine' cannot be used with option '-A, --no-archive'",
      );
    }
    // Derive selection from flags first (to preserve -s order and -x semantics)
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

    // Compute default selection when -s not present and noScripts not set.
    let selection: string[] = [];
    const exceptList = Array.isArray(exceptOpt)
      ? (exceptOpt as string[]).filter((k) => typeof k === 'string')
      : [];

    if (noScripts) {
      selection = [];
    } else if (scriptsProvided) {
      selection = derived.selection;
    } else {
      // No -s: base on config defaults (run.scripts) then apply -x.
      const sdef = runDefs.scripts;
      let base: string[] = [];
      if (sdef === false) base = [];
      else if (sdef === true || typeof sdef === 'undefined')
        base = [...allKeys];
      else if (Array.isArray(sdef)) {
        // intersection with configured keys preserving config order
        base = allKeys.filter((k) => sdef.includes(k));
      }
      if (exceptProvided && exceptList.length > 0) {
        const ex = new Set(exceptList);
        base = base.filter((k) => !ex.has(k));
      }
      selection = base;
    }

    const mode = sequential ? 'sequential' : 'concurrent';
    // Archive default:
    // - if -A -> false (error with -c handled above)
    // - else if -a present OR combine=true -> true
    // - else config default run.archive ?? true
    let archive = true;
    if (noArchiveFlag) archive = false;
    else if (archiveFlag || combine) archive = true;
    else {
      const def = runDefs.archive;
      archive = typeof def === 'boolean' ? def : true;
    }

    const behavior = {
      combine,
      keep,
      archive,
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

  // NOTE: Commander parse-time conflicts removed; using manual -S vs -s/-x guards above.
  return cli;
};
