/** See /requirements.md for global requirements. */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import type { Command } from '@commander-js/extra-typings';
import YAML from 'yaml';

import type { ContextConfig, ScriptMap } from '@/context/config';
import { ensureOutputDir, findConfigPathSync } from '@/context/config';

const TOKEN = /^\w+/;

const readPackageJsonScripts = async (cwd: string): Promise<Record<string, string>> => {
  try {
    const raw = await readFile(path.join(cwd, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> | undefined } | undefined;
    return pkg?.scripts ?? {};
  } catch {
    return {};
  }
};

const promptScripts = async (): Promise<ScriptMap> => {
  const scripts: ScriptMap = {};
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const key = (await rl.question('script key (empty to finish): ')).trim();
      if (!key) break;
      if (!TOKEN.test(key)) {
        console.error('Invalid key. Use alphanumeric/underscore only.');
        continue;
      }
      const cmd = (await rl.question('script command: ')).trim();
      if (!cmd) {
        console.error('Command cannot be empty.');
        continue;
      }
      scripts[key] = cmd;
    }
    return scripts;
  } finally {
    rl.close();
  }
};

export const performInit = async (cli: Command, { cwd = process.cwd(), force = false } = {}) => {
  const cfgPathExisting = findConfigPathSync(cwd);
  if (cfgPathExisting && !force) {
    cli.outputHelp();
    console.log(`Config already exists at ${cfgPathExisting}`);
    return cfgPathExisting;
  }

  const pkgScripts = readPackageJsonScripts(cwd);
  const scripts = Object.keys(await pkgScripts).length ? await pkgScripts : await promptScripts();

  const cfg: ContextConfig = { outputPath: 'ctx', scripts };
  const cfgPath = path.join(cwd, 'ctx.config.yml');

  await mkdir(cwd, { recursive: true });
  await writeFile(cfgPath, YAML.stringify(cfg), 'utf8');

  // Ensure .gitignore contains the output dir
  const giPath = path.join(cwd, '.gitignore');
  const gi = existsSync(giPath) ? await readFile(giPath, 'utf8') : '';
  const line = '\n# ctx output\nctx\n';
  if (!gi.includes('\nctx\n')) await writeFile(giPath, `${gi}${line}`, 'utf8');

  console.log(`ctx: wrote ctx.config.yml`);
  return cfgPath;
};

export const registerInit = (cli: Command) => {
  cli
    .command('init')
    .description('Create a ctx.config.json|yml by scanning package.json scripts.')
    .option('-f, --force', 'Create ctx.config.yml with outputPath=ctx and add it to .gitignore.')
    .action(async (opts: { force?: boolean }) => {
      await performInit(cli, { force: Boolean(opts.force) });
    });
};
