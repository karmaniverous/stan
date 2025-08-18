// src/cli/stan/init.ts
/* src/cli/stan/init.ts
 * REQUIREMENTS (current):
 * - Add "stan init" subcommand:
 *   - "--force" creates default stan.config.yml with outputPath: stan and adds "/stan" to .gitignore.
 *   - Otherwise scan package.json; copy script stubs to config (best-effort).
 * - Expose helpers performInit (used by tests) and registerInit.
 * - Avoid process.exit during parsing in tests by calling .exitOverride() on the root and subcommand.
 *   - IMPORTANT: When displaying help, do not throw in tests; ignore "helpDisplayed".
 *   - Disable default Commander help exit for this subcommand and provide a custom -h/--help that prints and returns.
 *   - Also disable the root help option and built-in help command to avoid process.exit.
 * - Use alias "@/..." for internal imports; avoid "any".
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Command } from 'commander';
import YAML from 'yaml';

import type { ContextConfig, ScriptMap } from '@/stan/config';
import { ensureOutputDir, findConfigPathSync } from '@/stan/config';

const TOKEN = /^\w+/;

const installExitOverride = (cmd: Command): void => {
  cmd.exitOverride((err) => {
    // Swallow help and unknown-* errors to avoid process.exit in tests and tolerate argv noise.
    if (
      (err as { code?: string }).code === 'commander.helpDisplayed' ||
      (err as { code?: string }).code === 'commander.unknownCommand' ||
      (err as { code?: string }).code === 'commander.unknownOption'
    )
      return;
    throw err;
  });
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

export const performInit = async (
  _cli: Command,
  { cwd = process.cwd(), force = false }: { cwd?: string; force?: boolean },
): Promise<string | null> => {
  const existing = findConfigPathSync(cwd);
  if (existing && !force) {
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

  console.log(`stan: wrote stan.config.yml`);
  return cfgPath;
};

export const registerInit = (cli: Command): Command => {
  // Prevent process.exit during tests even when showing help.
  installExitOverride(cli);

  // Disable root-level default help option and built-in "help" command
  // to avoid Commander calling process.exit(0) when help is requested.
  cli.helpOption(false);
  cli.addHelpCommand(false);

  const sub = cli
    .command('init')
    .description(
      'Create a stan.config.json|yml by scanning package.json scripts.',
    );

  // Disable Commander’s built-in help (which exits) and provide a custom one.
  sub.helpOption(false);
  sub.addHelpCommand(false);
  sub.option(
    '-h, --help',
    'Show help for the init command without exiting the process.',
  );
  sub.option(
    '-f, --force',
    'Create stan.config.yml with outputPath=stan and add it to .gitignore.',
  );

  // Also guard the subcommand itself.
  installExitOverride(sub);

  sub.action(async (opts: { force?: boolean; help?: boolean }) => {
    if (opts.help) {
      // Print help and return (do not exit)
      console.log(sub.helpInformation());
      return;
    }
    await performInit(cli, { force: Boolean(opts.force) });
  });

  return cli;
};
