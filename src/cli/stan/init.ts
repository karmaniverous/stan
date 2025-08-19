/* src/cli/stan/init.ts
 * REQUIREMENTS (current + updated):
 * - "stan init" subcommand.
 * - Interactive init when --force is not provided:
 *   - Prompt for outputPath, includes, excludes, scripts selection.
 * - Defaults in generated stan.config.yml should cover common needs:
 *   - outputPath: stan
 *   - excludes: []   <-- UPDATED: no default excludes
 * - Add "/stan" to .gitignore if missing.
 * - Ensure stan.system.md and stan.project.md exist (from dist templates).
 * - After init, create/update the diff snapshot (and log a short message).
 * - Avoid process.exit in tests via exitOverride; swallow help-related codes.
 *
 * UPDATED REQUIREMENTS:
 * - When a config already exists, "stan init" should re-run the interactive
 *   process using current config values as defaults rather than exiting.
 * - During interactive init, explicitly prompt the user to confirm resetting
 *   the diff snapshot; honor their decision.
 * - Persist `defaultPatchFile` to config (default '/stan.patch').
 */
import { existsSync } from 'node:fs';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { type Command } from 'commander';
import { packageDirectorySync } from 'package-directory';
import YAML from 'yaml';

import type { ContextConfig, ScriptMap } from '@/stan/config';
import { ensureOutputDir, findConfigPathSync, loadConfig } from '@/stan/config';
import { writeArchiveSnapshot } from '@/stan/diff';

import { applyCliSafety } from './cli-utils';

const isStringArray = (v: unknown): v is readonly string[] =>
  Array.isArray(v) && v.every((t) => typeof t === 'string');

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

/** Strongly typed prompt answers to avoid unsafe-any issues. */
type InitAnswers = {
  outputPath: string;
  includes: string;
  excludes: string;
  selectedScripts?: string[];
  resetDiff: boolean;
};

/** Prompt for interactive values when not forced. Supports defaults. */
const promptForConfig = async (
  cwd: string,
  pkgScripts: Record<string, string>,
  defaults?: Partial<ContextConfig>,
): Promise<
  Pick<ContextConfig, 'outputPath' | 'includes' | 'excludes' | 'scripts'> & {
    resetDiff: boolean;
  }
> => {
  // Dynamic import to avoid hard dependency at type level.
  const { default: inquirer } = (await import('inquirer')) as {
    default: {
      prompt: (qs: unknown[]) => Promise<unknown>;
    };
  };

  const scriptKeys = Object.keys(pkgScripts);
  const defaultSelected = defaults?.scripts
    ? Object.keys(defaults.scripts).filter((k) => scriptKeys.includes(k))
    : [];

  const answers = (await inquirer.prompt([
    {
      type: 'input',
      name: 'outputPath',
      message: 'Output directory:',
      default: defaults?.outputPath ?? 'stan',
    },
    {
      type: 'input',
      name: 'includes',
      message:
        'Paths to include (CSV; optional; overrides excludes when provided):',
      default: (defaults?.includes ?? []).join(','),
    },
    {
      type: 'input',
      name: 'excludes',
      message: 'Paths to exclude (CSV; optional):',
      default: (defaults?.excludes ?? []).join(','),
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
            default: defaultSelected,
            loop: false,
          },
        ]
      : []),
    {
      type: 'confirm',
      name: 'resetDiff',
      message: 'Reset diff snapshot now?',
      default: true,
    },
  ])) as InitAnswers;

  const out =
    typeof answers.outputPath === 'string' && answers.outputPath
      ? answers.outputPath.trim()
      : (defaults?.outputPath ?? 'stan');

  const includesCsv = answers.includes ?? '';
  const excludesCsv = answers.excludes ?? '';

  const selected =
    Array.isArray(answers.selectedScripts) && answers.selectedScripts.length
      ? answers.selectedScripts.filter(
          (x): x is string => typeof x === 'string',
        )
      : [];

  const scripts: ScriptMap = {};
  for (const key of selected) scripts[key] = 'npm run ' + key;

  return {
    outputPath: out,
    includes: includesCsv ? parseCsv(includesCsv) : [],
    excludes: excludesCsv ? parseCsv(excludesCsv) : [],
    scripts,
    resetDiff: Boolean(answers.resetDiff),
  };
};

export const performInit = async (
  _cli: Command,
  { cwd = process.cwd(), force = false }: { cwd?: string; force?: boolean },
): Promise<string | null> => {
  const existing = findConfigPathSync(cwd);

  const outRelDefault = 'stan';
  await ensureOutputDir(cwd, outRelDefault, true);

  // Base config defaults (no combined artifacts in current design)
  let config: ContextConfig = {
    outputPath: outRelDefault,
    scripts: {},
    excludes: [], // UPDATED: no default excludes
    includes: [],
    defaultPatchFile: '/stan.patch',
  };

  let resetDiffNow = true;

  if (!force) {
    // Load existing (if any) to use as interactive defaults
    let defaults: Partial<ContextConfig> | undefined;
    if (existing) {
      try {
        defaults = await loadConfig(cwd);
      } catch {
        defaults = undefined;
      }
    }

    const scripts = await readPackageJsonScripts(cwd);
    const picked = await promptForConfig(cwd, scripts, defaults);

    config = {
      outputPath: picked.outputPath,
      includes: picked.includes,
      excludes: picked.excludes,
      scripts: picked.scripts,
      defaultPatchFile: defaults?.defaultPatchFile ?? '/stan.patch',
    };
    resetDiffNow = picked.resetDiff;
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
  if (force || resetDiffNow) {
    await writeArchiveSnapshot({
      cwd,
      outputPath: config.outputPath,
      includes: config.includes ?? [],
      excludes: config.excludes ?? [],
    });
    console.log('stan: snapshot updated');
  } else {
    console.log('stan: snapshot unchanged');
  }

  return cfgPath;
};

export const registerInit = (cli: Command): Command => {
  applyCliSafety(cli);

  const sub = cli
    .command('init')
    .description(
      'Create or update stan.config.json|yml by scanning package.json scripts.',
    );

  applyCliSafety(sub);

  sub.option(
    '-f, --force',
    'Create stan.config.yml with defaults (outputPath=stan) and add it to .gitignore.',
  );

  sub.action(async (opts: { force?: boolean }) => {
    await performInit(cli, { force: Boolean(opts.force) });
  });

  return cli;
};
