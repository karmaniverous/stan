/* src/cli/stan/index.ts
 * REQUIREMENTS (current):
 * - Export makeCli(): Command — root CLI factory for the "stan" tool.
 * - Register subcommands:
 *   - "run" subcommand for executing configured scripts (see /stan.project.md).
 *   - "init" subcommand to scaffold config and docs.
 * - Avoid invoking process.exit during tests; call cli.exitOverride() at the root.
 *   - IMPORTANT: When displaying help, do not throw in tests; ignore "helpDisplayed".
 *   - Also ignore "unknownCommand" and "unknownOption".
 * - When executed directly (built CLI), parse argv.
 * - Help for root should include available script keys from config.
 * - Be tolerant of unit-test argv like ["node","stan", ...] by normalizing argv
 *   before parsing (without polluting help output).
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
    if (
      err.code === 'commander.helpDisplayed' ||
      err.code === 'commander.unknownCommand' ||
      err.code === 'commander.unknownOption'
    )
      return;
    throw err;
  });
};

/** Normalize argv from unit tests like ["node","stan", ...] -> [...]. */
const normalizeArgv = (
  argv?: readonly string[],
): readonly string[] | undefined => {
  if (!Array.isArray(argv)) return argv;
  if (argv.length >= 2 && argv[0] === 'node' && argv[1] === 'stan') {
    return argv.slice(2);
  }
  return argv;
};

/** Patch parse() and parseAsync() to normalize argv before Commander parses. */
const patchParseMethods = (cli: Command): void => {
  const self = cli as unknown as {
    parse: (argv?: readonly string[], opts?: unknown) => unknown;
    parseAsync: (argv?: readonly string[], opts?: unknown) => Promise<unknown>;
  };
 
