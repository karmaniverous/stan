/* src/cli/stan/snap.ts
 * CLI adapter for "stan snap" — Commander wiring only.
 */
import type { Command } from 'commander';
import { Command as Commander } from 'commander';

import {
  handleInfo,
  handleRedo,
  handleSet,
  handleSnap,
  handleUndo,
} from '@/stan/snap/handlers';

import { applyCliSafety } from './cli-utils';

/**
 * Register the `snap` subcommand on the provided root CLI.
 *
 * @param cli - Commander root command.
 * @returns The same root command for chaining.
 */
export const registerSnap = (cli: Commander): Command => {
  applyCliSafety(cli);
  const sub = cli
    .command('snap')
    .description(
      'Create/update the diff snapshot (without writing an archive)',
    );

  applyCliSafety(sub);

  sub
    .command('undo')
    .description('Revert to the previous snapshot in the history stack')
    .action(async () => {
      await handleUndo();
    });

  sub
    .command('redo')
    .description('Advance to the next snapshot in the history stack')
    .action(async () => {
      await handleRedo();
    });

  sub
    .command('set')
    .argument('<index>', 'snapshot index to activate (0-based)')
    .description('Jump to a specific snapshot index and restore it')
    .action(async (indexArg: string) => {
      await handleSet(indexArg);
    });

  sub
    .command('info')
    .description('Print the snapshot stack and current position')
    .action(async () => {
      await handleInfo();
    });

  sub
    .option(
      '-s, --stash',
      'stash changes (git stash -u) before snap and pop after',
    )
    .action(async (opts?: { stash?: boolean }) => {
      await handleSnap(opts);
    });

  return cli;
};
