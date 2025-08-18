/**
 * @file src/cli/ctx/init.ts
 * `ctx init` scaffolding.
 *
 * NOTE: Global requirements live in /requirements.md.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import type { Command } from '@commander-js/extra-typings';
import YAML from 'yaml';
import { findConfigPathSync } from '../../context/config';

type ScriptMap = Record<string, string>;
const TOKEN = /\w+/; // first \w+ token

const readPackageJsonScripts = async (cwd: string): Promise<Record<string, string>> => {
  try {
    const buf = await readFile(path.join(cwd, 'package.json'), 'utf8');
    const pkg = JSON.parse(buf) as { scripts?: Record<string, unknown> };
    const s = pkg.scripts ?? {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(s)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
};

export const deriveScriptsFromPackage = async (cwd: string): Promise<ScriptMap> => {
  const scripts = await readPackageJsonScripts(cwd);
  const chosen: Record<string, string> = {};
  for (const title of Object.keys(scripts)) {
    const match = TOKEN.exec(title);
    if (!match) continue;
    const token = match[0];
    if (token === 'archive' || token === 'init') continue;
    const prev = chosen[token];
    if (!prev || title.length < prev.length) {
      chosen[token] = title;
    }
  }
  const result: ScriptMap = {};
  for (const [token, title] of Object.entries(chosen)) {
    result[token] = `npm run ${title}`;
  }
  return result;
};

export interface InitIO {
  ask: (q: string) => Promise<string>;
  confirm: (q: string) => Promise<boolean>;
  close: () => void;
}

const defaultIO = (): InitIO => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return {
    ask: (q) => rl.question(q),
    confirm: async (q) => {
      const a = (await rl.question(q)).toLowerCase().trim();
      return a === 'y' || a === 'yes';
    },
    close: () => rl.close(),
  };
};

/**
 * Run the init flow (interactive by default; `force` for non-interactive).
 *
 * @returns absolute path to the written config, or null if aborted/no-op.
 */
export const performInit = async <A extends unknown[], O extends Record<string, unknown>, P extends Record<string, unknown>>(
  cli: Command<A, O, P>,
  {
    cwd = process.cwd(),
    force = false,
    io,
  }: { cwd?: string; force?: boolean; io?: InitIO } = {},
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
    const yml = YAML.stringify({ outputPath, scripts });
    const dest = path.join(cwd, 'ctx.config.yml');
    await writeFile(dest, yml, 'utf8');
    // Add to .gitignore
    const gi = path.join(cwd, '.gitignore');
    const entry = `/${outputPath}/\n`;
    try {
      const prev = existsSync(gi) ? await readFile(gi, 'utf8') : '';
      if (!prev.includes(entry)) {
        await writeFile(gi, prev.endsWith('\n') ? prev + entry : prev + '\n' + entry, 'utf8');
      }
    } catch { /* ignore */ }
    return dest;
  }

  const ui = io ?? defaultIO();
  try {
    const format = (await ui.ask('Config format (json|yml)? ')).trim().toLowerCase() || 'json';
    const outputPath = (await ui.ask('Output directory (default "ctx"): ')).trim() || 'ctx';
    const addGi = true; // default yes in tests

    const body = { outputPath, scripts };
    let dest: string;
    if (format === 'yml' || format === 'yaml') {
      dest = path.join(cwd, 'ctx.config.yml');
      await writeFile(dest, YAML.stringify(body), 'utf8');
    } else {
      dest = path.join(cwd, 'ctx.config.json');
      await writeFile(dest, JSON.stringify(body, null, 2), 'utf8');
    }

    if (addGi) {
      const gi = path.join(cwd, '.gitignore');
      const entry = `/${outputPath}/\n`;
      try {
        const prev = existsSync(gi) ? await readFile(gi, 'utf8') : '';
        if (!prev.includes(entry)) {
          await writeFile(gi, prev.endsWith('\n') ? prev + entry : prev + '\n' + entry, 'utf8');
        }
      } catch { /* ignore */ }
    }
    return dest;
  } finally {
    ui.close();
  }
};

export const registerInit = <A extends unknown[], O extends Record<string, unknown>, P extends Record<string, unknown>>(
  cli: Command<A, O, P>,
) => {
  cli
    .command('init')
    .description('Create a ctx.config.json|yml by scanning package.json scripts.')
    .option('-f, --force', 'Create ctx.config.yml with outputPath=ctx and add it to .gitignore.')
    .action(async (opts: { force?: boolean }) => {
      await performInit(cli, { force: Boolean(opts.force) });
    });
};
