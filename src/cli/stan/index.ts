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
 * - Help for root should include available script keys from config.
 * - Be tolerant of argv coming from test harnesses: ["node","stan", ...].
 *   - Implement hidden shim commands `node -> stan` and register run/init beneath to
 *     recognize both "stan run" and "node stan run" without polluting help output.
 * See /stan.project.md for global requirements.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';

import { renderAvailableScriptsHelp } from '@/stan/help';

import { registerInit } from './init';
import { registerRun } from './runner';

const installExitOverride = (cmd: Command): void => {
  cmd.exitOverride((err) => {
    // Avoid process.exit in tests; swallow routine Commander exits.
    if (
      err.code === 'commander.helpDisplayed' ||
      err.code === 'commander.unknownCommand' ||
      err.code === 'commander.unknownOption'
    )
      return;
    throw err;
  });
};

/** Hidden shims so tests can pass ["node", "stan", ...] and still reach real subcommands. */
const registerTestHarnessShims = (cli: Command): void => {
  // Hidden "node" command
  const nodeShim = new Command('node');
  nodeShim.hideHelp();
  installExitOverride(nodeShim);

  // Hidden "stan" beneath "node"
  const stanShim = new Command('stan');
  stanShim.hideHelp();
  installExitOverride(stanShim);

  // Register real subcommands under hidden chain
  registerRun(stanShim);
  registerInit(stanShim);

  nodeShim.addCommand(stanShim);
  cli.addCommand(nodeShim);
};

export const makeCli = (): Command => {
  const cli = new Command('stan');
  cli.description('Generate STAN snapshots (archive + consistent outputs)');

  // Avoid process.exit in tests or consumers expecting to manage errors themselves.
  installExitOverride(cli);

  // Subcommands (top-level)
  registerRun(cli);
  registerInit(cli);

  // Hidden shims for argv like ["node","stan",...]
  registerTestHarnessShims(cli);

  // Help footer: list configured script keys
  cli.addHelpText('after', () => renderAvailableScriptsHelp(process.cwd()));

  return cli;
};

// Execute when invoked directly (not during unit tests which import makeCli()).
const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked && resolve(thisFile) === invoked) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  makeCli().parseAsync(process.argv);
}
