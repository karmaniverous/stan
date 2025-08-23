// src/stan/run/plan.ts
import { bold } from '@/stan/util/color';

import type { ContextConfig } from '../config';
import { makeStanDirs } from '../paths';
import type { ExecutionMode, RunBehavior, Selection } from './types';

/** Render a readable, multi-line summary of the run plan (pure). */
export const renderRunPlan = (
  cwd: string,
  args: {
    selection: Selection;
    config: ContextConfig;
    mode: ExecutionMode;
    behavior: RunBehavior;
  },
): string => {
  const { selection, config, mode, behavior } = args;

  const keys = selection == null ? Object.keys(config.scripts) : selection;
  const scripts = keys ?? [];

  const dirs = makeStanDirs(cwd, config.stanPath);

  const lines = [
    bold('STAN run plan'),
    `mode: ${mode === 'sequential' ? 'sequential' : 'concurrent'}`,
    `output: ${dirs.outputRel}/`,
    `scripts: ${scripts.length ? scripts.join(', ') : 'none'}`,
    `archive: ${behavior.archive ? 'yes' : 'no'}`,
    `combine: ${behavior.combine ? 'yes' : 'no'}`,
    `keep output dir: ${behavior.keep ? 'yes' : 'no'}`,
  ];
  return `stan:\n  ${lines.join('\n  ')}`;
};
