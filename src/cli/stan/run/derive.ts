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
  const { options, cmd, config } = args;

  const scriptsOpt = (options as { scripts?: unknown }).scripts;
  const exceptOpt = (options as { exceptScripts?: unknown }).exceptScripts;
  const scriptsProvided =
    Array.isArray(scriptsOpt) || typeof scriptsOpt === 'string';
  const exceptProvided =
    Array.isArray(exceptOpt) && (exceptOpt as unknown[]).length > 0;

  const runDefs = ((
    config as {
      opts?: { cliDefaults?: { run?: Record<string, unknown> } };
    }
  ).opts?.cliDefaults?.run ?? {}) as {
    archive?: boolean;
    combine?: boolean;
    keep?: boolean;
    sequential?: boolean;
    scripts?: boolean | string[];
  };

  const src = (
    cmd as unknown as {
      getOptionValueSource?: (name: string) => string | undefined;
    }
  ).getOptionValueSource?.bind(cmd);

  const combine =
    src && src('combine') === 'cli'
      ? Boolean((options as { combine?: unknown }).combine)
      : Boolean(runDefs.combine ?? false);
  const sequential =
    src && src('sequential') === 'cli'
      ? Boolean((options as { sequential?: unknown }).sequential)
      : Boolean(runDefs.sequential ?? false);
  const keep =
    src && src('keep') === 'cli'
      ? Boolean((options as { keep?: unknown }).keep)
      : Boolean(runDefs.keep ?? false);

  const archiveOpt = (options as { archive?: unknown }).archive as
    | boolean
    | undefined;
  const archiveFlag = archiveOpt === true;
  const noArchiveFlag = archiveOpt === false;
  let archive = true;
  if (noArchiveFlag) archive = false;
  else if (archiveFlag || combine) archive = true;
  else archive = typeof runDefs.archive === 'boolean' ? runDefs.archive : true;

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
    const sdef = runDefs.scripts;
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
  const behavior: RunBehavior = { combine, keep, archive };
  return { selection, mode, behavior };
};
