// src/cli/stan/init.ts
/**
 * REQUIREMENTS (current):
 * - Add `stan init` subcommand:
 *   - `--force` creates a default `stan.config.yml` with `outputPath: stan` and adds `/stan` to `.gitignore`.
 *   - Otherwise, scan package.json to copy script stubs into a config file (best-effort; not covered by tests).
 * - Expose helpers `performInit` (used by tests) and `registerInit`.
 * - Avoid process.exit during parsing in tests by calling `.exitOverride()`; apply at root CLI for reliability.
 * - Use path alias @/*; avoid `any`.
 *
 * See /stan.project.md for global requirements.
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Command } from 'commander';
import YAML from 'yaml';

import type { ContextConfig, ScriptMap } from '@/stan/config';
import { ensureOutputDir, findConfigPathSync } from '@/stan/config';

const TOKEN = /^\w+/;

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

  // Add output dir to .gitignore
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
  // Prevent process.exit during tests when showing --help etc. Apply to root to catch all exits.
  cli.exitOverride();

  const sub = cli
    .command('init')
    .description(
      'Create a stan.config.json|yml by scanning package.json scripts.',
    )
    .option(
      '-f, --force',
      'Create stan.config.yml with outputPath=stan and add it to .gitignore.',
    );

  sub.exitOverride();

  sub.action(async (opts: { force?: boolean }) => {
    await performInit(cli, { force: Boolean(opts.force) });
  });

  return cli;
};
