/**
 * REQUIREMENTS
 * - `ctx init` scaffolds `ctx.config.json|yml` if none exists. [req-init]
 * - Default output directory is "ctx". [req-default-out]
 * - Interactive: ask JSON vs YML; ask output directory; offer to add to `.gitignore` and create it if missing. [req-init-interactive, req-gitignore]
 * - Non-interactive: `ctx init -f` chooses YML, uses outputPath=ctx, adds to `.gitignore`, no prompts. [req-init-force, req-gitignore]
 * - Scripts: derive first `\w+` token from package.json script titles; on duplicates, keep the shortest title; map to `npm run <title>`. [req-derive-scripts]
 * - Disallow `archive` and `init` keys. [req-no-archive-init-in-scripts]
 * - After writing, show help. [req-init-show-help]
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';

import { Command } from '@commander-js/extra-typings';
import YAML from 'yaml';

import { ensureOutputDir, findConfigPathSync } from '../../context/config';
import type { ContextConfig, ScriptMap } from '../../context/config';

const TOKEN = /^\w+/;

/**
 * Read the project's package.json and return a validated scripts map.
 *
 * Returns an empty object if the file doesn't exist or is malformed.
 */
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

/**
 * Derive `config.scripts` from package.json titles (keys).
 *
 * - Take the first word token from each title.
 * - If multiple titles map to the same token, keep the shortest title.
 * - Exclude reserved tokens "archive" and "init".
 * - Value is `npm run <title>`.
 */
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

/**
 * Serialize and write `ctx.config.json|yml` with the provided config.
 */
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

/**
 * Ensure `.gitignore` contains a rule to ignore the provided directory.
 *
 * - Creates `.gitignore` if it does not exist.
 * - Accepts variants like "ctx", "/ctx", "ctx/", "/ctx/" as equivalent.
 * - Appends a normalized `/<dir>/` line if not present.
 *
 * @returns absolute path of `.gitignore`.
 */
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
};

/**
 * Perform the init flow.
 *
 * - If a config already exists, prints help and exits.
 * - Interactive: asks for format, output dir, and whether to add to `.gitignore`.
 * - Force: skips prompts, picks yml + outputPath=ctx, ensures `.gitignore` includes it.
 *
 * @returns absolute path to the written config, or null if aborted/no-op.
 */
export const performInit = async (
  cli: Command<unknown[], Record<string, unknown>, Record<string, unknown>>,
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

  // Interactive prompts
  const rl =
    io ??
    ((() => {
      const i = createInterface({ input: process.stdin, output: process.stdout });
      return {
        ask: (q: string) => i.question(q),
        confirm: async (q: string) => {
          const a = await i.question(q);
          return /^y(es)?$/i.test(a.trim());
        },
      };
    })());

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

  // Ask about .gitignore (default: yes if user presses Enter)
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
};

/**
 * Register the `init` subcommand on the root CLI.
 *
 * Accepts the root Commander instance with any argument tuple type.
 */
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
      await performInit(
        cli as unknown as Command<unknown[], Record<string, unknown>, Record<string, unknown>>,
        { force: Boolean(opts.force) },
      );
    });
};
