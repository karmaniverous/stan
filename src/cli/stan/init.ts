/* src/cli/stan/init.ts
 * REQUIREMENTS (current):
 * - Add "stan init" subcommand:
 *   - "--force" creates default stan.config.yml with outputPath: stan and adds "/stan" to .gitignore.
 *   - Otherwise scan package.json; copy script stubs to config (best-effort).
 * - Expose helpers performInit (used by tests) and registerInit.
 * - Avoid process.exit during parsing in tests by calling .exitOverride() on the root and subcommand.
 *   - IMPORTANT: Swallow "helpDisplayed", "unknownCommand", and "unknownOption" so tests don't fail while native help remains enabled.
 * - Leverage native Commander help (-h/--help) instead of custom help wiring.
 * - Use alias "@/..." for internal imports; avoid "any".
 * - During init, ensure stan.system.md and stan.project.md are present:
 *   - If not present in the project root, copy stan.system.md from the package dist.
 *   - If stan.project.md is not present, copy stan.project.template.md from the package dist as stan.project.md.
 */
import { existsSync } from 'node:fs';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { type Command } from 'commander';
import { packageDirectorySync } from 'package-directory';
import YAML from 'yaml';

import type { ContextConfig, ScriptMap } from '@/stan/config';
import { ensureOutputDir, findConfigPathSync } from '@/stan/config';

const TOKEN = /^\w+/;

/** Swallow Commander exits so tests never call process.exit. */
const installExitOverride = (cmd: Command): void => {
  cmd.exitOverride((err) => {
    if (
      err.code === 'commander.helpDisplayed' ||
      err.code === 'commander.unknownCommand' ||
      err.code === 'commander.unknownOption'
    )
      return;
    // Commander has already printed any relevant message.
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

/** Patch parse()/parseAsync() on an arbitrary Command instance (used in tests). */
const patchParseMethods = (cli: Command): void => {
  type FromOpt = { from?: 'user' | 'node' };
  type ParseFn = (argv?: readonly string[], opts?: FromOpt) => Command;
  type ParseAsyncFn = (
    argv?: readonly string[],
    opts?: FromOpt,
  ) => Promise<Command>;

  // Commander does not type expose these overrides; cast limited to the
  // specific surface we patch and return the same cli instance. (Dynamic
  // method patch across library boundary; cast justified.)
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

const readPackageJsonScripts = async (
  cwd: string,
): Promise<Record<string, string>> => {
  try {
    const raw = await readFile(path.join(cwd, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
    return pkg.scripts ?? {};
  } catch {
    return {};
  }
};

const copyDocIfMissing = async (
  cwd: string,
  moduleRoot: string,
  srcName: string,
  destName: string,
): Promise<void> => {
  const src = path.join(moduleRoot, srcName);
  const dest = path.join(cwd, destName);
  if (!existsSync(dest) && existsSync(src)) {
    await copyFile(src, dest);
  }
};

const ensureDocs = async (cwd: string): Promise<void> => {
  // Locate package root from the current module file (works for dev and built CLI)
  const thisFile = fileURLToPath(import.meta.url);
  const thisDir = path.dirname(thisFile);
  const moduleRoot = packageDirectorySync({ cwd: thisDir }) ?? thisDir;

  // Both files are delivered in dist/ (rollup copies them to moduleRoot/dist).
  const distRoot = path.join(moduleRoot, 'dist');

  await copyDocIfMissing(cwd, distRoot, 'stan.system.md', 'stan.system.md');
  await copyDocIfMissing(
    cwd,
    distRoot,
    'stan.project.template.md',
    'stan.project.md',
  );
};

export const performInit = async (
  _cli: Command,
  { cwd = process.cwd(), force = false }: { cwd?: string; force?: boolean },
): Promise<string | null> => {
  const existing = findConfigPathSync(cwd);
  if (existing && !force) {
    // Ensure docs are present even if config already exists.
    await ensureDocs(cwd);
    return existing;
  }

  const outRel = 'stan';
  await ensureOutputDir(cwd, outRel, true);
  const config: ContextConfig = { outputPath: outRel, scripts: {} };

  if (!force) {
    // Try to read package.json scripts and keep only tokenized commands.
    const scripts = await readPackageJsonScripts(cwd);
    const entries = Object.entries(scripts)
      .filter(([, v]) => typeof v === 'string' && TOKEN.test(v))
      .map(([k, v]) => [k, v.match(TOKEN)?.[0] ?? v]);
    const map: ScriptMap = {};
    for (const [k, v] of entries) map[k] = v;
    config.scripts = map;
  }

  const cfgPath = path.join(cwd, 'stan.config.yml');
  const yml = YAML.stringify(config);
  await writeFile(cfgPath, yml, 'utf8');

  // Add output dir to .gitignore if not already present.
  const giPath = path.join(cwd, '.gitignore');
  const marker = `/${outRel}`;
  let gi = existsSync(giPath) ? await readFile(giPath, 'utf8') : '';
  if (!gi.split(/\r?\n/).some((line) => line.trim() === marker)) {
    if (gi.length && !gi.endsWith('\n')) gi += '\n';
    gi += `${marker}\n`;
    await writeFile(giPath, gi, 'utf8');
  }

  // Ensure docs are present.
  await ensureDocs(cwd);

  console.log(`stan: wrote stan.config.yml`);
  return cfgPath;
};

export const registerInit = (cli: Command): Command => {
  installExitOverride(cli);
  patchParseMethods(cli);

  const sub = cli
    .command('init')
    .description(
      'Create a stan.config.json|yml by scanning package.json scripts.',
    );

  installExitOverride(sub);

  sub.option(
    '-f, --force',
    'Create stan.config.yml with outputPath=stan and add it to .gitignore.',
  );

  sub.action(async (opts: { force?: boolean }) => {
    await performInit(cli, { force: Boolean(opts.force) });
  });

  return cli;
};
