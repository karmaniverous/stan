/* src/cli/stan/snap.ts
 * "stan snap" subcommand: create/replace the diff snapshot explicitly.
 * NEW: Operate from the nearest package root with a stan config when available.
 */
import path from 'node:path';

import type { Command } from 'commander';

import { applyCliSafety } from '@/cli/stan/cli-utils';

export const registerSnap = (cli: Command): Command => {
  applyCliSafety(cli);

  const sub = cli
    .command('snap')
    .description(
      'Create/update the diff snapshot (without writing an archive)',
    );

  applyCliSafety(sub);

  sub.action(async () => {
    const cwd0 = process.cwd();
    const cfgMod = await import('./config');
    const diffMod = await import('./diff');

    const cfgPath = cfgMod.findConfigPathSync(cwd0);
    const cwd = cfgPath ? path.dirname(cfgPath) : cwd0;

    let maybe: unknown;
    try {
      maybe = await cfgMod.loadConfig(cwd);
    } catch (e) {
      if (process.env.STAN_DEBUG === '1') {
        console.error('stan: failed to load config for snapshot', e);
      }
      maybe = undefined;
    }

    const isContextConfig = (
      v: unknown,
    ): v is {
      outputPath: string;
      scripts: Record<string, string>;
      includes?: string[];
      excludes?: string[];
    } =>
      !!v &&
      typeof v === 'object' &&
      typeof (v as { outputPath?: unknown }).outputPath === 'string' &&
      typeof (v as { scripts?: unknown }).scripts === 'object';

    const config = isContextConfig(maybe)
      ? maybe
      : { outputPath: 'stan', scripts: {} as Record<string, string> };

    await diffMod.writeArchiveSnapshot({
      cwd,
      outputPath: config.outputPath,
      includes: config.includes ?? [],
      excludes: config.excludes ?? [],
    });
    console.log('stan: snapshot updated');
  });

  return cli;
};
