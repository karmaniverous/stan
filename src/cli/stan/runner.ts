// src/cli/stan/runner.ts
/**
 * REQUIREMENTS (current):
 * - Register subcommand `stan run` with:
 *   - positional `[scripts...]` (string[])
 *   - options:
 *     - `-e, --except <keys...>` to exclude keys
 *     - `-s, --sequential` to run sequentially
 *     - `-c, --combine` to create a combined artifact
 *     - `-k, --keep` to keep (not clear) the output directory
 *     - `-d, --diff` to create `archive.diff.tar` when archive is included
 *   - NOTE: `combinedFileName` is read from config only; there is no CLI option.
 * - Load config, compute final selection, call runSelected(cwd, config, selection, mode, behavior).
 * - On empty result, print renderAvailableScriptsHelp(cwd).
 * - Avoid `any`; keep imports via `@/*` alias.
 */
import type { Command } from 'commander';

import { renderAvailableScriptsHelp } from '@/stan/help';
import { type ExecutionMode, type RunBehavior, runSelected } from '@/stan/run';

const computeSelection = (
  allKeys: string[],
  enumerated?: string[] | null,
  except?: string[],
): string[] | null => {
  let selected: string[] | null =
    Array.isArray(enumerated) && enumerated.length ? [...enumerated] : null;

  if (Array.isArray(except) && except.length) {
    const base = selected ?? allKeys;
    selected = base.filter((k) => !except.includes(k));
  }

  return selected;
};

export const registerRun = (cli: Command): Command => {
  const cmd = cli
    .command('run')
    .description('Run configured scripts to generate STAN artifacts')
    .argument('[scripts...]', 'script keys to run')
    .option('-e, --except <keys...>', 'script keys to exclude')
    .option('-s, --sequential', 'run sequentially in config order')
    .option('-c, --combine', 'create a combined artifact')
    .option('-k, --keep', 'keep (do not clear) the output directory')
    .option('-d, --diff', 'create archive.diff.tar when archive is included');

  cmd.action(
    async (enumerated: string[] | undefined, opts: Record<string, unknown>) => {
      const cwd = process.cwd();

      // Dynamic import to ensure Vitest mocks are respected in tests.
      const { loadConfig } = await import('@/stan/config');

      // Guard loadConfig to avoid undefined in mocked/test scenarios.
      let config: Awaited<ReturnType<typeof loadConfig>>;
      try {
        config = await loadConfig(cwd);
      } catch {
        config = { outputPath: 'stan', scripts: {} };
      }

      const keys = Object.keys(config.scripts);

      // Sanitize enumerated args: ignore stray tokens like "node", "stan", etc.
      const known = new Set([...keys, 'archive']);
      const enumeratedClean =
        Array.isArray(enumerated) && enumerated.length
          ? enumerated.filter((k) => known.has(k))
          : undefined;

      const selection = computeSelection(
        keys,
        enumeratedClean ?? null,
        opts.except as string[] | undefined,
      );

      const mode: ExecutionMode = (opts as { sequential?: boolean }).sequential
        ? 'sequential'
        : 'concurrent';

      const behavior: RunBehavior = {
        combine: Boolean((opts as { combine?: boolean }).combine),
        keep: Boolean((opts as { keep?: boolean }).keep),
        diff: Boolean((opts as { diff?: boolean }).diff),
        // No CLI option; honor config only.
        combinedFileName: config.combinedFileName,
      };

      const created = await runSelected(cwd, config, selection, mode, behavior);

      // Print help footer when nothing is created (empty selection or unknown keys).
      if (!Array.isArray(created) || created.length === 0) {
        console.log(renderAvailableScriptsHelp(cwd));
      }
    },
  );

  return cli;
};
