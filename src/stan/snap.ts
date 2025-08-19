/* src/cli/stan/snap.ts
 * "stan snap" subcommand: create/replace the diff snapshot explicitly.
 */
import type { Command } from 'commander';

const installExitOverride = (cmd: Command): void => {
  cmd.exitOverride((err) => {
    if (
      err.code === 'commander.helpDisplayed' ||
      err.code === 'commander.unknownCommand' ||
      err.code === 'commander.unknownOption' ||
      err.code === 'commander.help'
    ) {
      return;
    }
    throw err;
  });
};

const isStringArray = (v: unknown): v is readonly string[] =>
  Array.isArray(v) && v.every((t) => typeof t === 'string');

const normalizeArgv = (
  argv?: readonly string[],
): readonly string[] | undefined => {
  if (!isStringArray(argv)) return undefined;
  if (argv.length >= 2 && argv[0] === 'node' && argv[1] === 'stan') {
    return argv.slice(2);
  }
  return argv;
};

const patchParseMethods = (cli: Command): void => {
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

export const registerSnap = (cli: Command): Command => {
  installExitOverride(cli);
  patchParseMethods(cli);

  const sub = cli
    .command('snap')
    .description(
      'Create/update the diff snapshot (without writing an archive)',
    );

  installExitOverride(sub);

  sub.action(async () => {
    const cwd = process.cwd();
    const cfgMod = await import('@/stan/config');
    const diffMod = await import('@/stan/diff');

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
