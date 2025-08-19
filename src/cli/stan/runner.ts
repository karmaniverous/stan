/* src/cli/stan/runner.ts
 * CLI adapter for "stan run".
 * Now delegates selection/mode/behavior derivation to a pure helper to make
 * tests deterministic and decouple from Commander internals.
 */
import type { Command } from 'commander';

import { renderAvailableScriptsHelp } from '@/stan/help';
import { runSelected } from '@/stan/run';

import { deriveRunInvocation } from './run-args';

export const registerRun = (cli: Command): Command => {
  const cmd = cli
    .command('run')
    .description('Run configured scripts to generate STAN artifacts')
    .argument('[scripts...]', 'script keys to run')
    .option('-e, --except <keys...>', 'script keys to exclude')
    .option('-s, --sequential', 'run sequentially in config order')
    .option('-c, --combine', 'create a combined artifact')
    .option('-k, --keep', 'keep (do not clear) the output directory')
    .option('-d, --diff', 'create archive.diff.tar when archive is included');

  // Help footer: list configured script keys
  cmd.addHelpText('after', () => renderAvailableScriptsHelp(process.cwd()));

  cmd.action(async (enumerated: unknown, opts: Record<string, unknown>) => {
    const cwd = process.cwd();

    // Dynamic import to ensure Vitest mocks are respected in tests.
    const cfgMod = await import('@/stan/config');

    let maybe: unknown;
    try {
      maybe = await cfgMod.loadConfig(cwd);
    } catch {
      maybe = undefined;
    }

    const isContextConfig = (
      v: unknown,
    ): v is {
      outputPath: string;
      scripts: Record<string, string>;
      combinedFileName?: string;
    } =>
      !!v &&
      typeof v === 'object' &&
      typeof (v as { outputPath?: unknown }).outputPath === 'string' &&
      typeof (v as { scripts?: unknown }).scripts === 'object';

    const config = isContextConfig(maybe)
      ? maybe
      : { outputPath: 'stan', scripts: {} as Record<string, string> };

    // Pure derivation of runSelected parameters
    const derived = deriveRunInvocation({
      enumerated,
      except: (opts as { except?: unknown }).except,
      sequential: (opts as { sequential?: unknown }).sequential,
      combine: (opts as { combine?: unknown }).combine,
      keep: (opts as { keep?: unknown }).keep,
      diff: (opts as { diff?: unknown }).diff,
      config,
    });

    const created = await runSelected(
      cwd,
      config,
      derived.selection,
      derived.mode,
      derived.behavior,
    );

    // Print help footer when nothing is created (empty selection or unknown keys).
    if (!Array.isArray(created) || created.length === 0) {
      console.log(renderAvailableScriptsHelp(cwd));
    }
  });

  return cli;
};
