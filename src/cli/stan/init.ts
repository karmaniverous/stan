/**
 * REQUIREMENTS (current):
 * - Add `stan init` subcommand:
 *   - `--force` creates a default `stan.config.yml` with `outputPath: stan` and adds `/stan` to `.gitignore`.
 *   - Otherwise, scan package.json to copy script stubs into a config file (best-effort; not covered by tests).
 * - Expose helpers `performInit` (used by tests) and `registerInit`.
 * - Avoid process.exit during parsing in tests by calling `.exitOverride()` on the subcommand.
 * - Use path alias `@/*`; avoid `any`.
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Command } from 'commander';
import YAML from 'yaml';

import type { ContextConfig, ScriptMap } from '@/stan/config';
import { ensureOutputDir, findConfigPathSync } from '@/stan/config';

const TOKEN = /node\s|npm\s|pnpm\s|bun\s|tsx\s|ts-node\s/;

/** Best-effort read of package.json scripts. */
const readPackageScripts = async (
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
  cli: Command,
  { cwd = process.cwd(), force = false }: { cwd?: string; force?: boolean },
): Promise<string | null> => {
  const existing = findConfigPathSync(cwd);
  if (existing && !force) {
    // Nothing to do
    return existing;
  }

  const outRel = 'stan';
  await ensureOutputDir(cwd, outRel, true);
  const config: ContextConfig = { outputPath: outRel, scripts: {} };

  if (!force) {
    // Try to read package.json scripts and keep only tokenized commands.
    const scripts = await readPackageScripts(cwd);
    const entries = Object.entries(scripts)
      .filter(([_, v]) => typeof v === 'string' && TOKEN.test(v))
      .map(([k, v]) => [k, (v as string).match(TOKEN)?.[0] ?? v]);
    const map: ScriptMap = {};
    for (const [k, v] of entries) map[k] = v as string;
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
  const sub = cli
    .command('init')
    .description(
      'Create a stan.config.json|yml by scanning package.json scripts.',
    )
    .option(
      '-f, --force',
      'Create stan.config.yml with outputPath=stan and add it to .gitignore.',
    );

  // Prevent process.exit during tests when showing --help etc.
  sub.exitOverride();

  sub.action(async (opts: { force?: boolean }) => {
    await performInit(cli, { force: Boolean(opts.force) });
  });

  return cli;
};
