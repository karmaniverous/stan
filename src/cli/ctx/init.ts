/** See /requirements.md for global requirements. */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import type { Command } from 'commander';
import YAML from 'yaml';

import type { ContextConfig, ScriptMap } from '@/context/config';
import { ensureOutputDir, findConfigPathSync } from '@/context/config';

const TOKEN = /^\w+/;

const readPackageJsonScripts = async (cwd: string): Promise<Record<string, string>> => {
  try {
    const raw = await readFile(path.join(cwd, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { scripts?: Record<string, unknown> };
    const { scripts } = parsed;
    if (!scripts || typeof scripts !== 'object') return {};
    const validated: Record<string, string> = {};
    for (const [k, v] of Object.entries(scripts)) {
      if (typeof v !== 'string') continue;
      validated[k] = v;
    }
    return validated;
  } catch {
    return {};
  }
};

const deriveScriptsFromPackage = async (cwd: string): Promise<ScriptMap> => {
  const scripts = await readPackageJsonScripts(cwd);
  const keys = Object.keys(scripts);
  const map: ScriptMap = {};
  for (const k of keys) {
    const token = k.match(TOKEN)?.[0] ?? k;
    if (!map[token]) map[token] = `npm run ${k}`;
  }
  return map;
};

type InitIO = {
  prompt: (q: string) => Promise<string>;
  confirm: (q: string) => Promise<boolean>;
};

const defaultIO: InitIO = {
  prompt: async (q) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ans = await rl.question(q);
    rl.close();
    return ans;
  },
  confirm: async (q) => {
    const a = await defaultIO.prompt(`${q} (y/N) `);
    return /^y(es)?$/i.test(a.trim());
  }
};

export const performInit = async (
  cli: Command,
  { cwd = process.cwd(), force = false, io }: { cwd?: string; force?: boolean; io?: InitIO } = {}
): Promise<string | null> => {
  const existing = findConfigPathSync(cwd);
  if (existing) {
    console.log(`ctx: config already exists at ${path.relative(cwd, existing)}`);
    cli.outputHelp();
    return null;
  }

  const scripts = await deriveScriptsFromPackage(cwd);

  if (force) {
    const outputPath = 'ctx';
    const cfg: ContextConfig = { outputPath, scripts };
    const yml = YAML.stringify(cfg);
    const cfgPath = path.join(cwd, 'ctx.config.yml');
    await writeFile(cfgPath, yml, 'utf8');
    const out = await ensureOutputDir(cwd, outputPath);
    const gi = path.join(cwd, '.gitignore');
    const line = outputPath;
    if (!existsSync(gi)) await writeFile(gi, `${line}\n`, 'utf8');
    console.log(`ctx: wrote ${path.relative(cwd, cfgPath)}; output -> ${path.relative(cwd, out)}`);
    cli.outputHelp();
    return cfgPath;
  }

  const _io = io ?? defaultIO;
  const isJson = /^j/i.test((await _io.prompt('Use JSON or YML? (json/yml) ')).trim());
  const outputPath = (await _io.prompt('Output directory (default "ctx"): ')).trim() || 'ctx';
  const addGitignore = await _io.confirm(`Add "${outputPath}" to .gitignore?`);

  const cfg: ContextConfig = { outputPath, scripts };
  const cfgPath = path.join(cwd, isJson ? 'ctx.config.json' : 'ctx.config.yml');
  await writeFile(cfgPath, isJson ? JSON.stringify(cfg, null, 2) : YAML.stringify(cfg), 'utf8');
  await ensureOutputDir(cwd, outputPath);
  if (addGitignore) {
    const gi = path.join(cwd, '.gitignore');
    const line = outputPath;
    if (!existsSync(gi)) await writeFile(gi, `${line}\n`, 'utf8');
  }
  cli.outputHelp();
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
