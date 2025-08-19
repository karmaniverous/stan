// src/cli/stan/index.ts
/* src/cli/stan/index.ts
 * REQUIREMENTS (current):
 * - Export makeCli(): Command — root CLI factory for the "stan" tool.
 * - Register subcommands:
 *   - "run" subcommand for executing configured scripts (see /stan.project.md).
 *   - "init" subcommand to scaffold config and docs.
 * - Avoid invoking process.exit during tests; call cli.exitOverride() at the root.
 *   - IMPORTANT: When displaying help, do not throw in tests; ignore "helpDisplayed".
 *   - Also ignore "unknownCommand" and "unknownOption" to tolerate argv noise in test harnesses.
 * - When executed directly (built CLI), parse argv.
 * See /stan.project.md for global requirements.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';

import { registerInit } from './init';
import { registerRun } from './runner';

const installExitOverride = (cmd: Command): void => {
  cmd.exitOverride((err) => {
    // Requirement: avoid process.exit in tests; do not throw for help output
    // Also ignore unknownCommand/unknownOption to tolerate argv noise like ["node","stan",...].
    if (
      err.code === 'commander.helpDisplayed' ||
      err.code === 'commander.unknownCommand' ||
      err.code === 'commander.unknownOption'
    )
      return;
    throw err;
  });
};

export const makeCli = (): Command => {
  const cli = new Command('stan');
  cli.description('Generate STAN snapshots (archive + consistent outputs)');

  // Avoid process.exit in tests or consumers expecting to manage errors themselves.
  installExitOverride(cli);

  // Subcommands
  registerRun(cli);
  registerInit(cli);

  return cli;
};

// Execute when invoked directly (not during unit tests which import makeCli()).
const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked && resolve(thisFile) === invoked) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  makeCli().parseAsync(process.argv);
}
