// src/cli/stan/patch.ts
/* src/cli/stan/patch.ts
 * "stan patch" subcommand: syntactic sugar over `git apply`.
 * - Defaults to config.defaultPatchFile (default '/stan.patch').
 * - Treat a leading '/' path as relative to the repo root (cwd) for portability.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

import type { Command } from 'commander';

import { loadConfig } from './config';

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

const resolveRepoPatchPath = (cwd: string, file: string): string => {
  // Treat a leading '/' as repo-root anchored, not OS root.
  if (file.startsWith('/')) return path.join(cwd, file.slice(1));
  return path.isAbsolute(file) ? file : path.resolve(cwd, file);
};

const runGitApply = async (cwd: string, fileAbs: string): Promise<number> =>
  new Promise<number>((resolveP) => {
    const child = spawn('git', ['apply', '--3way', fileAbs], {
      cwd,
      shell: false,
      stdio: 'inherit',
    });
    child.on('close', (code) => resolveP(code ?? 0));
  });

export const registerPatch = (cli: Command): Command => {
  installExitOverride(cli);
  patchParseMethods(cli);

  const sub = cli
    .command('patch')
    .description('Apply a git patch (defaults to config.defaultPatchFile)')
    .argument(
      '[file]',
      'Patch file to apply (defaults to config.defaultPatchFile)',
    );

  installExitOverride(sub);

  sub.action(async (provided?: string) => {
    const cwd = process.cwd();
    let file = provided;

    if (!file) {
      try {
        const cfg = await loadConfig(cwd);
        file = cfg.defaultPatchFile ?? '/stan.patch';
      } catch {
        file = '/stan.patch';
      }
    }

    const patchPath = resolveRepoPatchPath(cwd, file);
    console.log(`stan: applying patch "${path.relative(cwd, patchPath)}"`);
    const code = await runGitApply(cwd, patchPath);
    if (code === 0) {
      console.log('stan: patch applied');
    } else {
      console.log(`stan: patch failed (exit ${code.toString()})`);
    }
  });

  return cli;
};
