/* src/cli/stan/init.ts
 * REQUIREMENTS (current + updated):
 * - "stan init" subcommand.
 * - Interactive init when --force is not provided:
 *   - Prompt for outputPath, combinedFileName, includes, excludes, scripts selection.
 * - Defaults in generated stan.config.yml should cover common needs:
 *   - outputPath: stan
 *   - combinedFileName: combined
 *   - excludes: []   <-- UPDATED: no default excludes
 * - Add "/stan" to .gitignore if missing.
 * - Ensure stan.system.md and stan.project.md exist (from dist templates).
 * - After init, create/update the diff snapshot (and log a short message).
 * - Avoid process.exit in tests via exitOverride; swallow help-related codes.
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
import { writeArchiveSnapshot } from '@/stan/diff';

/** Swallow Commander exits so tests never call process.exit. */
const installExitOverride = (cmd: Command): void => {
  cmd.exitOverride((err) => {
    if (
      err.code === 'commander.helpDisplayed' ||
      err.code === 'commander.unknownCommand' ||
      err.code === 'commander.unknownOption' ||
      err.code === 'commander.help'
    )
      return;
    // Commander has already printed any relevant message.
    throw err;
  });
};

const isStringArray = (v: unknown): v is readonly string[] =>
  Array.isArray(v) && v.every((t) => typeof t === 'string');

/** Normalize argv from unit tests like ["node","stan", ...] -\> [...] */
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

const parseCsv = (v: string): string[] =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

/** Prompt for interactive values when not forced. */
const promptForConfig = async (
  cwd: string,
  pkgScripts: Record<string, string>,
): Promise<
  Pick<
    ContextConfig,
    'outputPath' | 'combinedFileName' | 'includes' | 'excludes' | 'scripts'
  >
> => {
  // Dynamic import to avoid hard dependency at type level.
  const { default: inquirer } = (await import('inquirer')) as {
    default: { prompt: (qs: unknown[]) => Promise<Record<string, unknown>> };
  };

  const scriptKeys = Object.keys(pkgScripts);
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'outputPath',
      message: 'Output directory:',
      default: 'stan',
    },
    {
      type: 'input',
      name: 'combinedFileName',
      message: 'Base name for combined artifacts:',
      default: 'combined',
    },
    {
      type: 'input',
      name: 'includes',
      message:
        'Paths to include (CSV; optional; overrides excludes when provided):',
      default: '',
    },
    {
      type: 'input',
      name: 'excludes',
      message: 'Paths to exclude (CSV; optional):',
      default: '',
    },
    ...(scriptKeys.length
      ? [
          {
            type: 'checkbox',
            name: 'selectedScripts',
            message: 'Select scripts to include from package.json:',
            choices: scriptKeys.map((k) => ({
              name: `${k}: ${pkgScripts[k]}`,
              value: k,
            })),
            loop: false,
          },
        ]
      : []),
  ]);

  const pick = (n: string, def: string): string => {
    const v = answers[n];
    return typeof v === 'string' && v.trim().length > 0 ? v.trim() : def;
    // includes/excludes handle empty to [] below
  };

  const out = pick('outputPath', 'stan');
  const combined = pick('combinedFileName', 'combined');

  const includesCsv = (answers['includes'] as string) ?? '';
  const excludesCsv = (answers['excludes'] as string) ?? '';

  const selected = Array.isArray(answers.selectedScripts)
    ? (answers.selectedScripts as unknown[]).filter(
        (x): x is string => typeof x === 'string',
      )
    : [];

  const scripts: ScriptMap = {};
  for (const key of selected) scripts[key] = pkgScripts[key];

  return {
    outputPath: out,
    combinedFileName: combined,
    includes: includesCsv ? parseCsv(includesCsv) : [],
    excludes: excludesCsv ? parseCsv(excludesCsv) : [],
    scripts,
  };
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

  const outRelDefault = 'stan';
  await ensureOutputDir(cwd, outRelDefault, true);

  // Base config defaults
  let config: ContextConfig = {
    outputPath: outRelDefault,
    scripts: {},
    combinedFileName: 'combined',
    excludes: [], // UPDATED: no default excludes
    includes: [],
  };

  if (!force) {
    // Interactive prompts
    const scripts = await readPackageJsonScripts(cwd);
    const picked = await promptForConfig(cwd, scripts);

    config = {
      outputPath: picked.outputPath,
      combinedFileName: picked.combinedFileName,
      includes: picked.includes,
      excludes: picked.excludes,
      scripts: picked.scripts,
    };
  }

  const cfgPath = path.join(cwd, 'stan.config.yml');
  const yml = YAML.stringify(config);
  await writeFile(cfgPath, yml, 'utf8');

  // Add output dir to .gitignore if not already present.
  const giPath = path.join(cwd, '.gitignore');
  const marker = `/${config.outputPath}`;
  let gi = existsSync(giPath) ? await readFile(giPath, 'utf8') : '';
  if (!gi.split(/\r?\n/).some((line) => line.trim() === marker)) {
    if (gi.length && !gi.endsWith('\n')) gi += '\n';
    gi += `${marker}\n`;
    await writeFile(giPath, gi, 'utf8');
  }

  // Ensure docs are present.
  await ensureDocs(cwd);

  console.log(`stan: wrote stan.config.yml`);

  // Create or replace snapshot after init
  await writeArchiveSnapshot({
    cwd,
    outputPath: config.outputPath,
    includes: config.includes ?? [],
    excludes: config.excludes ?? [],
  });
  console.log('stan: snapshot updated');

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
    'Create stan.config.yml with defaults (outputPath=stan) and add it to .gitignore.',
  );

  sub.action(async (opts: { force?: boolean }) => {
    await performInit(cli, { force: Boolean(opts.force) });
  });

  return cli;
};
