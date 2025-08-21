// src/stan/init/service.ts
import path from 'node:path';

import type { Command } from 'commander';
import YAML from 'yaml';

import type { ContextConfig, ScriptMap } from '../config';
import { ensureOutputDir, findConfigPathSync, loadConfig } from '../config';
import { writeArchiveSnapshot } from '../diff';
import { makeStanDirs } from '../paths';
import { ensureDocs } from './docs';
import { ensureStanGitignore } from './gitignore';
import { promptForConfig, readPackageJsonScripts } from './prompts';

export const performInitService = async (
  _cli: Command,
  {
    cwd = process.cwd(),
    force = false,
    preserveScripts = false,
  }: { cwd?: string; force?: boolean; preserveScripts?: boolean },
): Promise<string | null> => {
  const existing = findConfigPathSync(cwd);

  const defaultStanPath = '.stan';
  await ensureOutputDir(cwd, defaultStanPath, true);

  let config: ContextConfig = {
    stanPath: defaultStanPath,
    scripts: {} as ScriptMap,
    excludes: [],
    includes: [],
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
    };
    resetDiffNow = picked.resetDiff;
  } else {
    // Force path: honor --preserve-scripts if there is a prior config
    if (preserveScripts && defaults?.scripts) {
      config.scripts = { ...defaults.scripts };
    }
  }

  const cfgPath = path.join(cwd, 'stan.config.yml');
  const yml = YAML.stringify(config);
  await (await import('node:fs/promises')).writeFile(cfgPath, yml, 'utf8');

  // .gitignore: ensure stanPath subfolders are ignored (not stanPath root)
  await ensureStanGitignore(cwd, config.stanPath);

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
