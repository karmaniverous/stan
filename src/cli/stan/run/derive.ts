import type { Command } from 'commander';

import type { ContextConfig } from '@/stan/config';
import type { ExecutionMode, RunBehavior } from '@/stan/run';

import { deriveRunInvocation } from '../run-args';
export type DerivedRun = {
  selection: string[];
  mode: ExecutionMode;
  behavior: RunBehavior;
};
/**
 * Derive selection/mode/behavior given parsed options, the configured defaults,
 * and Commander option sources.
 */
export const deriveRunParameters = (args: {
  options: Record<string, unknown>;
  cmd: Command;
  config: ContextConfig;
}): DerivedRun => {
  const { options, config } = args;

  const scriptsOpt = (options as { scripts?: unknown }).scripts;
  const exceptOpt = (options as { exceptScripts?: unknown }).exceptScripts;
  const scriptsProvided =
    Array.isArray(scriptsOpt) || typeof scriptsOpt === 'string';
  const exceptProvided =
    Array.isArray(exceptOpt) && (exceptOpt as unknown[]).length > 0;

  // From Commander: all booleans/numerics already have defaults applied (config-aware via options.ts).
  const combine = Boolean((options as { combine?: unknown }).combine);
  const sequential = Boolean((options as { sequential?: unknown }).sequential);
  const keep = Boolean((options as { keep?: unknown }).keep);
  const ding = Boolean((options as { ding?: unknown }).ding);
  const live = Boolean((options as { live?: unknown }).live);
  const hangWarnFinal = Number((options as { hangWarn?: unknown }).hangWarn);
  const hangKillFinal = Number((options as { hangKill?: unknown }).hangKill);
  const hangKillGraceFinal = Number(
    (options as { hangKillGrace?: unknown }).hangKillGrace,
  );

  const archiveOpt = (options as { archive?: unknown }).archive as
    | boolean
    | undefined;
  const noArchiveFlag = archiveOpt === false;
  // Combine implies archive; otherwise honor CLI boolean produced by Commander defaults.
  let archive = Boolean(archiveOpt) || combine;
  if (noArchiveFlag) archive = false;

  const derivedBase = deriveRunInvocation({
    scriptsProvided,
    scriptsOpt,
    exceptProvided,
    exceptOpt,
    sequential,
    combine,
    keep,
    archive,
    config,
  });

  const noScripts = (options as { scripts?: unknown }).scripts === false;
  const allKeys = Object.keys(config.scripts);
  let selection: string[] = [];
  if (noScripts) {
    selection = [];
  } else if (scriptsProvided) {
    selection = derivedBase.selection;
  } else {
    const sdef = (
      (config.cliDefaults ?? {}) as { run?: { scripts?: boolean | string[] } }
    ).run?.scripts;
    let base: string[] = [];
    if (sdef === false) base = [];
    else if (sdef === true || typeof sdef === 'undefined') base = [...allKeys];
    else if (Array.isArray(sdef))
      base = allKeys.filter((k) => sdef.includes(k));
    const exceptList = Array.isArray(exceptOpt)
      ? (exceptOpt as string[]).filter((k) => typeof k === 'string')
      : [];
    if (exceptProvided && exceptList.length > 0) {
      const ex = new Set(exceptList);
      base = base.filter((k) => !ex.has(k));
    }
    selection = base;
  }

  const mode: ExecutionMode = sequential ? 'sequential' : 'concurrent';
  const behavior: RunBehavior = {
    combine,
    keep,
    archive,
    ding,
    live,
    hangWarn: hangWarnFinal,
    hangKill: hangKillFinal,
    hangKillGrace: hangKillGraceFinal,
  };
  return { selection, mode, behavior };
};
