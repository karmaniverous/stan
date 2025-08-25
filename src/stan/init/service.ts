/* src/stan/init/service.ts */
import path from 'node:path';

import YAML from 'yaml';

import type { ContextConfig, ScriptMap } from '../config';
import { ensureOutputDir, findConfigPathSync, loadConfig } from '../config';
import { writeArchiveSnapshot } from '../diff';
import { ensureDocs } from './docs';
import { ensureStanGitignore } from './gitignore';
import { promptForConfig, readPackageJsonScripts } from './prompts';

/**
 * Initialize or update STAN configuration and workspace assets.
 *
 * Behavior:
 * - Resolves defaults from an existing config when present.
 * - In interactive mode, prompts for stanPath, includes/excludes, and scripts.
 * - Writes `stan.config.yml`, ensures `.gitignore` entries, and ships docs.
 * - Optionally resets the diff snapshot.
 *
 * @param opts - Options `{ cwd, force, preserveScripts }`.
 * @returns Absolute path to the written `stan.config.yml`, or `null` on failure.
 */
export const performInitService = async ({
  cwd = process.cwd(),
  force = false,
  preserveScripts = false,
}: {
  cwd?: string;
  force?: boolean;
  preserveScripts?: boolean;
}): Promise<string | null> => {
  const existing = findConfigPathSync(cwd);

  const defaultStanPath = '.stan';
  await ensureOutputDir(cwd, defaultStanPath, true);

  let config: ContextConfig = {
    stanPath: defaultStanPath,
    scripts: {} as ScriptMap,
    excludes: [],
    includes: [],
    patchOpenCommand: 'code -g {file}',
  };

  let resetDiffNow = true;

  let defaults: Partial<ContextConfig> | undefined;
  if (existing) {
    try {
      defaults = await loadConfig(cwd);
    } catch {
      defaults = undefined;
    }
  }

  if (!force) {
    const scriptsFromPkg = await readPackageJsonScripts(cwd);
    const picked = await promptForConfig(
      cwd,
      scriptsFromPkg,
      defaults,
      preserveScripts,
    );

    config = {
      stanPath: picked.stanPath,
      includes: picked.includes,
      excludes: picked.excludes,
      scripts: picked.scripts,
      patchOpenCommand: defaults?.patchOpenCommand ?? 'code -g {file}',
    };
    resetDiffNow = picked.resetDiff;
  } else {
    if (preserveScripts && defaults?.scripts) {
      config.scripts = { ...defaults.scripts };
    }
    if (defaults?.patchOpenCommand) {
      config.patchOpenCommand = defaults.patchOpenCommand;
    }
  }

  const cfgPath = path.join(cwd, 'stan.config.yml');
  const yml = YAML.stringify(config);
  await (await import('node:fs/promises')).writeFile(cfgPath, yml, 'utf8');

  await ensureStanGitignore(cwd, config.stanPath);
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
