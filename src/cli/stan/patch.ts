/* src/cli/stan/patch.ts
 * CLI adapter for "stan patch" — Commander wiring only.
 */
import type { Command } from 'commander';

import { runPatch } from '@/stan/patch/service';

import { applyCliSafety } from './cli-utils';

/**
 * Register the `patch` subcommand on the provided root CLI.
 *
 * @param cli - Commander root command.
 * @returns The same root command for chaining.
 */
export const registerPatch = (cli: Command): Command => {
  applyCliSafety(cli);

  const sub = cli
    .command('patch')
    .description(
      'Apply a git patch from clipboard (default), a file (-f), or argument.',
    )
    .argument('[input]', 'Patch data (unified diff)')
    .option('-f, --file [filename]', 'Read patch from file as source')
    .option('-c, --check', 'Validate patch without applying any changes');

  applyCliSafety(sub);

  sub.action(
    async (
      inputMaybe?: string,
      opts?: { file?: string | boolean; check?: boolean },
    ) => {
      await runPatch(process.cwd(), inputMaybe, opts);
    },
  );

  return cli;
};
