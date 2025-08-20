/* src/cli/stan/init.ts
 * "stan init" subcommand.
 * UPDATED:
 * - Generate stan.config.yml with stanPath: stan.
 * - Create <stanPath>/system and copy docs from dist:
 *   - stan.system.md, stan.project.template.md, stan.bootloader.md
 * - Add <stanPath>/output, <stanPath>/diff, <stanPath>/dist, <stanPath>/patch to .gitignore (do NOT ignore the stanPath root).
 * - After init, create/update the diff snapshot (and log a short message).
 */
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { type Command } from 'commander';
import { packageDirectorySync } from 'package-directory';
import YAML from 'yaml';

import type { ContextConfig, ScriptMap } from '@/stan/config';
import { ensureOutputDir, findConfigPathSync, loadConfig } from '@/stan/config';
import { writeArchiveSnapshot } from '@/stan/diff';
import { makeStanDirs } from '@/stan/paths';

import { applyCliSafety } from './cli-utils';

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

const copyDoc = async (
  cwd: string,
  moduleRoot: string,
  srcName: string,
  destRel: string,
  updateIfDifferent: boolean,
): Promise<void> => {
  const src = path.join(moduleRoot, srcName);
  const dest = path.join(cwd, destRel);
  const destDir = path.dirname(dest);
  await mkdir(destDir, { recursive: true });

  if (!existsSync(src)) return;

  if (!existsSync(dest)) {
    await copyFile(src, dest);
    return;
  }

  if (!updateIfDifferent) return;

  try {
    const [a, b] = await Promise.all([
      readFile(src, 'utf8'),
      readFile(dest, 'utf8'),
    ]);
    if (a !== b) {
      await copyFile(src, dest);
    }
  } catch {
    // best effort
  }
};

const ensureDocs = async (cwd: string, stanPath: string): Promise<void> => {
  const thisFile = fileURLToPath(import.meta.url);
  const thisDir = path.dirname(thisFile);
  const moduleRoot = packageDirectorySync({ cwd: thisDir }) ?? thisDir;
  const distRoot = path.join(moduleRoot, 'dist');

  // copy into <stanPath>/system
  await copyDoc(
    cwd,
    distRoot,
    'stan.system.md',
    path.join(stanPath, 'system', 'stan.system.md'),
    true,
  );
  await copyDoc(
    cwd,
    distRoot,
    'stan.project.template.md',
    path.join(stanPath, 'system', 'stan.project.template.md'),
    false,
  );
  await copyDoc(
    cwd,
    distRoot,
    'stan.bootloader.md',
    path.join(stanPath, 'system', 'stan.bootloader.md'),
    false,
  );
};

const parseCsv = (v: string): string[] =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

/** Strongly typed prompt answers to avoid unsafe-any issues. */
type InitAnswers = {
  stanPath: string;
  includes: string;
  excludes: string;
  selectedScripts?: string[];
  resetDiff: boolean;
};

const promptForConfig = async (
  cwd: string,
  pkgScripts: Record<string, string>,
  defaults?: Partial<ContextConfig>,
): Promise<
  Pick<ContextConfig, 'stanPath' | 'includes' | 'excludes' | 'scripts'> & {
    resetDiff: boolean;
  }
> => {
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
      name: 'stanPath',
      message: 'STAN path:',
      default: defaults?.stanPath ?? '.stan',
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
    typeof answers.stanPath === 'string' && answers.stanPath
      ? answers.stanPath.trim()
      : (defaults?.stanPath ?? '.stan');

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
    stanPath: out,
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

  const defaultStanPath = '.stan';
  await ensureOutputDir(cwd, defaultStanPath, true);

  let config: ContextConfig = {
    stanPath: defaultStanPath,
    scripts: {},
    excludes: [],
    includes: [],
  };

  let resetDiffNow = true;

  if (!force) {
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
      stanPath: picked.stanPath,
      includes: picked.includes,
      excludes: picked.excludes,
      scripts: picked.scripts,
    };
    resetDiffNow = picked.resetDiff;
  }

  const cfgPath = path.join(cwd, 'stan.config.yml');
  const yml = YAML.stringify(config);
  await writeFile(cfgPath, yml, 'utf8');

  // .gitignore: ignore <stanPath>/output, <stanPath>/diff, <stanPath>/dist, <stanPath>/patch (do not ignore the stanPath root)
  const giPath = path.join(cwd, '.gitignore');
  const dirs = makeStanDirs(cwd, config.stanPath);
  const linesToEnsure = [
    `${dirs.outputRel}/`,
    `${dirs.diffRel}/`,
    `${dirs.distRel}/`,
    `${dirs.patchRel}/`,
  ];
  let gi = existsSync(giPath) ? await readFile(giPath, 'utf8') : '';
  const existingLines = new Set(gi.split(/\r?\n/).map((l) => l.trim()));
  let changed = false;
  for (const l of linesToEnsure) {
    if (!existingLines.has(l)) {
      if (gi.length && !gi.endsWith('\n')) gi += '\n';
      gi += `${l}\n`;
      changed = true;
    }
  }
  if (changed) await writeFile(giPath, gi, 'utf8');

  // Ensure docs in <stanPath>/system
  await ensureDocs(cwd, config.stanPath);

  console.log(`stan: wrote stan.config.yml`);

  if (force || resetDiffNow) {
    await writeArchiveSnapshot({
      cwd,
      stanPath: config.stanPath,
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
    'Create stan.config.yml with defaults (stanPath=stan).',
  );

  sub.action(async (opts: { force?: boolean }) => {
    await performInit(cli, { force: Boolean(opts.force) });
  });

  return cli;
};
