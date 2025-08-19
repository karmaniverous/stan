/** Shared Commander helpers for STAN CLI.
 * DRY the repeated exitOverride + parse normalization across subcommands.
 */

import type { Command } from 'commander';

const isStringArray = (v: unknown): v is readonly string[] =>
  Array.isArray(v) && v.every((t) => typeof t === 'string');

/** Normalize argv from unit tests like ["node","stan", ...] -\> [...] */
export const normalizeArgv = (
  argv?: readonly string[],
): readonly string[] | undefined => {
  if (!isStringArray(argv)) return undefined;
  if (argv.length >= 2 && argv[0] === 'node' && argv[1] === 'stan') {
    return argv.slice(2);
  }
  return argv;
};

/** Patch parse() and parseAsync() to normalize argv before Commander parses. */
export const patchParseMethods = (cli: Command): void => {
  type FromOpt = { from?: 'user' | 'node' };
  type ParseFn = (argv?: readonly string[], opts?: FromOpt) => Command;
  type ParseAsyncFn = (
    argv?: readonly string[],
    opts?: FromOpt,
  ) => Promise<Command>;

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

/** Install a Commander exit override that swallows benign exits during tests. */
export const installExitOverride = (cmd: Command): void => {
  cmd.exitOverride((err) => {
    if (
      err.code === 'commander.helpDisplayed' ||
      err.code === 'commander.unknownCommand' ||
      err.code === 'commander.unknownOption' ||
      err.code === 'commander.help'
    ) {
      // Commander already printed any relevant message. Do not call process.exit.
      return;
    }
    throw err;
  });
};

/** Apply both safety adapters to a command. */
export const applyCliSafety = (cmd: Command): void => {
  installExitOverride(cmd);
  patchParseMethods(cmd);
};
