/* src/cli/stan/init.ts
 * REQUIREMENTS (current):
 * - Add "stan init" subcommand:
 *   - "--force" creates default stan.config.yml with outputPath: stan and adds "/stan" to .gitignore.
 *   - Otherwise scan package.json; copy script stubs to config (best-effort).
 * - Expose helpers performInit (used by tests) and registerInit.
 * - Avoid process.exit during parsing in tests by calling .exitOverride() on the root and subcommand.
 *   - IMPORTANT: Swallow "helpDisplayed", "unknownCommand", and "unknownOption" so tests don't fail while native help remains enabled.
 * - Leverage native Commander help (-h/--help) instead of custom help wiring.
 * - When tests pass ["node","stan",...], tolerate stray tokens by adding a passthrough variadic argument
 *   when the program has no arguments (ignore extraneous argv).
 * - Use alias "@/..." for internal imports; avoid "any".
 * - New: During init, ensure stan.system.md and stan.project.md are present:
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
  cmd.exitOverride(() => {
    // Intentionally swallow all Commander exits during tests so no process.exit occurs.
    // Commander has already printed any relevant message.
    return;
  });
};

/** Add a catch-all variadic argument if the program currently has no arguments. */
const ensurePassthroughArg = (cli: Command): void => {
  const internal = cli as unknown as {
    _args?: unknown[];
  };
  const hasArgs = Array.isArray(internal._args) && internal._args.length > 0;
  if (!hasArgs) {
    cli.argument('[__ignore__...]', 'internal passthrough');
  }
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

  // Tolerate stray tokens in test harnesses when root has no args.
  ensurePassthroughArg(cli);

  return cli;
};
