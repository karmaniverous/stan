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
    config as { cliDefaults?: { run?: Record<string, unknown> } }
  ).cliDefaults?.run ?? {}) as {
    archive?: boolean;
    combine?: boolean;
    keep?: boolean;
    sequential?: boolean;
    scripts?: boolean | string[];
    ding?: boolean;
    live?: boolean;
    hangWarn?: number;
    hangKill?: number;
    hangKillGrace?: number;
  };

  const src = (
    cmd as unknown as {
      getOptionValueSource?: (name: string) => string | undefined;
    }
  ).getOptionValueSource?.bind(cmd);

  const toInt = (v: unknown): number | undefined => {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v);
    if (typeof v === 'string') {
      const s = v.trim();
      if (s.length) {
        const n = Number.parseInt(s, 10);
        if (Number.isFinite(n)) return Math.floor(n);
      }
    }
    return undefined;
  };
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

  const ding =
    src && src('ding') === 'cli'
      ? Boolean((options as { ding?: unknown }).ding)
      : Boolean(runDefs.ding ?? false);

  const live =
    src && src('live') === 'cli'
      ? Boolean((options as { live?: unknown }).live)
      : typeof runDefs.live === 'boolean'
        ? runDefs.live
        : true;

  const hangWarn =
    src && src('hangWarn') === 'cli'
      ? toInt((options as { hangWarn?: unknown }).hangWarn)
      : toInt((runDefs as { hangWarn?: unknown }).hangWarn);
  const hangKill =
    src && src('hangKill') === 'cli'
      ? toInt((options as { hangKill?: unknown }).hangKill)
      : toInt((runDefs as { hangKill?: unknown }).hangKill);
  const hangKillGrace =
    src && src('hangKillGrace') === 'cli'
      ? toInt((options as { hangKillGrace?: unknown }).hangKillGrace)
      : toInt((runDefs as { hangKillGrace?: unknown }).hangKillGrace);

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
  const behavior: RunBehavior = {
    combine,
    keep,
    archive,
    ding,
    live,
    hangWarn,
    hangKill,
    hangKillGrace,
  };
  return { selection, mode, behavior };
};
