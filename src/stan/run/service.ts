// src/stan/run/service.ts
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { ContextConfig } from '../config';
import { ensureOutputDir } from '../config';
import { makeStanDirs } from '../paths';
import { preflightDocsAndVersion } from '../preflight';
import { archivePhase } from './archive';
import { normalizeSelection, runScripts } from './exec';
import { renderRunPlan } from './plan';
import type { ExecutionMode, RunBehavior, Selection } from './types';

const shouldWriteOrder =
  process.env.NODE_ENV === 'test' || process.env.STAN_WRITE_ORDER === '1';

export const runSelected = async (
  cwd: string,
  config: ContextConfig,
  selection: Selection = null,
  mode: ExecutionMode = 'concurrent',
  behaviorMaybe?: RunBehavior,
): Promise<string[]> => {
  const behavior: RunBehavior = behaviorMaybe ?? {};

  // Preflight docs/version (non-blocking; best-effort)
  try {
    await preflightDocsAndVersion(cwd);
  } catch (e) {
    if (process.env.STAN_DEBUG === '1') {
      console.error('stan: preflight failed', e);
    }
  }

  // ensure directory tree
  await ensureOutputDir(cwd, config.stanPath, Boolean(behavior.keep));
  const dirs = makeStanDirs(cwd, config.stanPath);
  const outAbs = dirs.outputAbs;

  // Multi-line plan summary
  console.log(
    renderRunPlan(cwd, {
      selection,
      config,
      mode,
      behavior,
    }),
  );

  let orderFile: string | undefined;
  if (shouldWriteOrder) {
    orderFile = resolve(outAbs, 'order.txt');
    if (!behavior.keep) {
      await writeFile(orderFile, '', 'utf8');
    }
  }

  const toRun = normalizeSelection(selection, config);
  const created: string[] = [];

  // Run scripts only when selection non-empty
  if (toRun.length > 0) {
    const outRel = dirs.outputRel;
    const scriptOutputs = await runScripts(
      cwd,
      outAbs,
      outRel,
      config,
      toRun,
      mode,
      orderFile,
    );
    created.push(...scriptOutputs);
  }

  // ARCHIVE PHASE
  if (behavior.archive) {
    const includeOutputs = Boolean(behavior.combine);
    const { archivePath, diffPath } = await archivePhase({
      cwd,
      config,
      includeOutputs,
    });
    created.push(archivePath, diffPath);
  }

  return created;
};
