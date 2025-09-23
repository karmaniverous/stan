// src/cli/stan/run/action.ts
import path from 'node:path';

import type { Command } from 'commander';
import { CommanderError } from 'commander';

import { findConfigPathSync, loadConfig } from '@/stan/config';
import { runSelected } from '@/stan/run';
import { renderRunPlan } from '@/stan/run/plan';

import { deriveRunParameters } from './derive';
import type { FlagPresence } from './options';

export const registerRunAction = (
  cmd: Command,
  getFlagPresence: () => FlagPresence,
): void => {
  cmd.action(async (options: Record<string, unknown>) => {
    const { sawNoScriptsFlag, sawScriptsFlag, sawExceptFlag } =
      getFlagPresence();

    // Authoritative conflict handling: -S cannot be combined with -s/-x
    if (sawNoScriptsFlag && (sawScriptsFlag || sawExceptFlag)) {
      throw new CommanderError(
        1,
        'commander.conflictingOption',
        "error: option '-S, --no-scripts' cannot be used with option '-s, --scripts' or '-x, --except-scripts'",
      );
    }

    const cwdInitial = process.cwd();
    const cfgPath = findConfigPathSync(cwdInitial);
    const runCwd = cfgPath ? path.dirname(cfgPath) : cwdInitial;

    let maybe: unknown;
    try {
      maybe = await loadConfig(runCwd);
    } catch (err) {
      if (process.env.STAN_DEBUG === '1') {
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : String(err);
        console.error('stan: failed to load config', msg);
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

    // Derive run parameters
    const derived = deriveRunParameters({ options, cmd, config });

    const planBody = renderRunPlan(runCwd, {
      selection: derived.selection,
      config,
      mode: derived.mode,
      behavior: derived.behavior,
    });

    // no-plan: execute without printing plan first
    const noPlan = Boolean((options as { noPlan?: unknown }).noPlan);

    const noScripts = (options as { scripts?: unknown }).scripts === false;
    if (noScripts && derived.behavior.archive === false) {
      console.log(
        'stan: nothing to do; plan only (scripts disabled, archive disabled)',
      );
      console.log(planBody);
      return;
    }

    const planOnly = Boolean((options as { plan?: unknown }).plan);
    if (planOnly) {
      console.log(planBody);
      return;
    }

    // Carry the no-plan flag through to the service (behavior.plan)
    try {
      (derived.behavior as { plan?: boolean }).plan = !noPlan;
    } catch {
      /* ignore */
    }

    await runSelected(
      runCwd,
      config,
      derived.selection,
      derived.mode,
      derived.behavior,
    );
  });
};
