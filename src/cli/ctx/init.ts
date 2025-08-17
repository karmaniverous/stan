/**
 * REQUIREMENTS
 * - `ctx init` scaffolds `ctx.config.json|yml` if none exists. [req-init]
 * - Default output directory is "ctx". [req-default-out]
 * - Interactive: asks JSON vs YML; asks output dir; offers to add to `.gitignore`. [req-init-interactive, req-gitignore]
 * - Non-interactive: `-f/--force` chooses YML, uses outputPath=ctx, adds to `.gitignore`, no prompts. [req-init-force, req-gitignore]
 * - Derive script keys from package.json titles using first \\w+ token; on duplicates keep shortest title; map to `npm run <title>`. [req-derive-scripts]
 * - Disallow `archive` and `init` keys in config.scripts. [req-no-archive-init-in-scripts]
 * - After writing config, show help. [req-init-show-help]
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';

import YAML from 'yaml';
import type { Command } from '@commander-js/extra-typings';

import { ensureOutputDir, findConfigPathSync } from '../../context/config';
import type { ContextConfig, ScriptMap } from '../../context/config';

const TOKEN = /^\w+/;

const readPackageJsonScripts = async (cwd: string): Promise<Record<string, string>> => {
  try {
    const raw = await readFile(path.join(cwd, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { scripts?: Record<string, unknown> };
    const { scripts } = parsed;
    if (!scripts || typeof scripts !== 'object') return {};
    const validated: Record<string, string> = {};
    for (const [k, v] of Object.entries(scripts)) {
      if (typeof v === 'string') validated[k] = v;
    }
    return validated;
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

type Format = 'json' | 'yml';

export const writeConfigFile = async (
  cwd: string,
  format: Format,
  config: ContextConfig,
): Promise<string> => {
  const filename = format === 'json' ? 'ctx.config.json' : 'ctx.config.yml';
  const dest = path.join(cwd, filename);
  const body = format === 'json' ? `${JSON.stringify(config, null, 2)}\n` : YAML.stringify(config);
  await writeFile(dest, body, 'utf8');
  return dest;
};

export const ensureGitignoreRule = async (cwd: string, dir: string): Promise<string> => {
  const gi = path.join(cwd, '.gitignore');
  let content = '';
  try {
    content = await readFile(gi, 'utf8');
  } catch {
    // no file yet
  }

  const lines = content.split(/\r?\n/);
  const variants = new Set([dir, `/${dir}`, `${dir}/`, `/${dir}/`]);
  const hasRule = lines.some((l) => variants.has(l.trim()));
  if (!hasRule) {
    const suffix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    const addition = `/${dir}/\n`;
    await writeFile(gi, `${content}${suffix}${addition}`, 'utf8');
  }
  return gi;
};

type InitIO = {
  ask: (q: string) => Promise<string>;
  confirm: (q: string) => Promise<boolean>;
  close?: () => void;
};

/**
 * Run the init flow (interactive by default; `force` for non-interactive).
 *
 * @returns absolute path to the written config, or null if aborted/no-op.
 */
export const performInit = async <
  A extends unknown[],
  O extends Record<string, unknown>,
  P extends Record<string, unknown>
>(
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
    await ensureOutputDir(cwd, outputPath);
    await ensureGitignoreRule(cwd, outputPath);
    const config: ContextConfig = { outputPath, scripts };
    const written = await writeConfigFile(cwd, 'yml', config);
    console.log(`ctx: wrote ${path.relative(cwd, written)}`);
    cli.outputHelp();
    return written;
  }

  // Interactive: ensure readline is always closed so the process can exit.
  const rl =
    io ??
    ((() => {
      const i = createInterface({ input: process.stdin, output: process.stdout });
      const wrapper: InitIO = {
        ask: (q: string) => i.question(q),
        confirm: async (q: string) => {
          const a = await i.question(q);
          return /^y(es)?$/i.test(a.trim());
        },
        close: () => i.close(),
      };
      return wrapper;
    })());

  try {
    const fmtRaw = (await rl.ask('Config format (json/yml)? [yml]: ')).trim().toLowerCase();
    const format: Format = fmtRaw === 'json' ? 'json' : 'yml';

    const outRaw = (await rl.ask('Output directory [ctx]: ')).trim();
    const outputPath = outRaw.length ? outRaw : 'ctx';

    const outAbs = path.join(cwd, outputPath);
    if (existsSync(outAbs)) {
      const ok = await rl.confirm(`Directory "${outputPath}" already exists. Continue? (y/N): `);
      if (!ok) {
        console.log('ctx: init aborted.');
        return null;
      }
    }

    await mkdir(outAbs, { recursive: true });

    // Offer to add output dir to .gitignore (default yes)
    const giRaw = (await rl.ask(`Add "${outputPath}" to .gitignore? (Y/n): `)).trim();
    const addGi = giRaw.length === 0 || /^y(es)?$/i.test(giRaw);
    if (addGi) {
      await ensureGitignoreRule(cwd, outputPath);
    }

    const config: ContextConfig = { outputPath, scripts };
    const written = await writeConfigFile(cwd, format, config);
    console.log(`ctx: wrote ${path.relative(cwd, written)}`);
    cli.outputHelp();

    return written;
  } finally {
    try {
      rl.close?.();
    } catch {
      /* no-op */
    }
  }
};

export const registerInit = <
  A extends unknown[],
  O extends Record<string, unknown>,
  P extends Record<string, unknown>
>(
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
