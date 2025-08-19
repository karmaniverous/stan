/* REQUIREMENTS (current):
 * - Export makeCli(): Command — root CLI factory for the "stan" tool.
 * - Register subcommands:
 *   - "run" subcommand for executing configured scripts (see /stan.project.md).
 *   - "init" subcommand to scaffold config and docs.
 * - Avoid invoking process.exit during tests; call cli.exitOverride() at the root.
 *   - IMPORTANT: When displaying help, do not throw in tests; ignore "helpDisplayed".
 *   - Also ignore "unknownCommand" and "unknownOption".
 * - When executed directly (built CLI), parse argv.
 * - Help for root should include available script keys from config.
 * - Be tolerant of unit-test argv like ["node","stan", ...] -\> \[...]
 *   by normalizing argv before parsing (without polluting help output).
 * See /stan.project.md for global requirements.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';

import { renderAvailableScriptsHelp } from '@/stan/help';

import { registerInit } from './init';
import { registerRun } from './runner';

/** Install a Commander exit override that swallows benign exits during tests. */
const installExitOverride = (cmd: Command): void => {
  cmd.exitOverride((err) => {
    if (
      err.code === 'commander.helpDisplayed' ||
      err.code === 'commander.unknownCommand' ||
      err.code === 'commander.unknownOption'
    ) {
      // Commander already printed any relevant message. Do not call process.exit.
      return;
    }
    throw err;
  });
};

const isStringArray = (v: unknown): v is readonly string[] =>
  Array.isArray(v) && v.every((t) => typeof t === 'string');

/** Normalize argv from unit tests like ["node","stan", ...] -\> \[...]. */
const normalizeArgv = (
  argv?: readonly string[],
): readonly string[] | undefined => {
  if (!isStringArray(argv)) return undefined;
  if (argv.length >= 2 && argv[0] === 'node' && argv[1] === 'stan') {
    return argv.slice(2);
  }
  return argv;
};

/** Patch parse() and parseAsync() to normalize argv before Commander parses. */
const patchParseMethods = (cli: Command): void => {
  type FromOpt = { from?: 'user' | 'node' };
  type ParseFn = (argv?: readonly string[], opts?: FromOpt) => Command;
  type ParseAsyncFn = (
    argv?: readonly string[],
    opts?: FromOpt,
  ) => Promise<Command>;

  // Commander doesn't expose a typed way to override parse methods. We narrow
  // to the subset we need and return the same cli instance to keep typing safe.
  // (Dynamic method patch across library boundary; cast justified.)
  const holder = cli as unknown as {
    parse: ParseFn;
    parseAsync: ParseAsyncFn;
  };

  const origParse = holder.parse.bind(cli);
  const origParseAsync = holder.parseAsync.bind(cli);

  holder.parse = (argv?: readonly string[], opts?: FromOpt) => {
    origParse(normalizeArgv(argv), opts);
    return cli;
  };

  holder.parseAsync = async (argv?: readonly string[], opts?: FromOpt) => {
    await origParseAsync(normalizeArgv(argv), opts);
    return cli;
  };
};

/** Build the root CLI (no side effects; safe for tests). */
export const makeCli = (): Command => {
  const cli = new Command();
  cli
    .name('stan')
    .description(
      'Generate reproducible STAN artifacts for AI-assisted development',
    );

  // Root-level help footer: show available script keys (including "archive")
  cli.addHelpText('after', () => renderAvailableScriptsHelp(process.cwd()));

  // Ensure tests never call process.exit()
  installExitOverride(cli);

  // Normalize test argv like ["node","stan", ...]
  patchParseMethods(cli);

  // Subcommands
  registerRun(cli);
  registerInit(cli);

  return cli;
};

// Execute when run directly (built CLI)
const isDirect = (() => {
  try {
    const self = resolve(fileURLToPath(import.meta.url));
    const invoked = resolve(process.argv[1] ?? '');
    return self === invoked;
  } catch {
    return false;
  }
})();

if (isDirect) {
  const cli = makeCli();
  // Root override already installed inside makeCli()
  // Parse process.argv (which will be normalized by our parse patch if needed)
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  cli.parseAsync();
}
