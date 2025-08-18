/* src/cli/stan/runner.ts
 * REQUIREMENTS (current):
 * - Register the main CLI command `stan` with:
 *   - positional [scripts...] (string[])
 *   - options: -e/--except, -s/--sequential, -c/--combine, -k/--keep, -d/--diff, --combined-file-name <name>
 * - Load config, compute final selection, call runSelected(cwd, config, selection, mode, behavior).
 * - If created artifacts array is empty (or undefined), print renderAvailableScriptsHelp(cwd).
 * - Ignore non-script argv tokens (“node”, “stan”) and any values not declared in config.scripts, except the special “archive”.
 * - Be resilient in test environments: if config cannot be loaded (e.g., mocks), still compute selections from argv and call runSelected with a minimal config.
 * - IMPORTANT: When no scripts are explicitly enumerated, implicitly include the special “archive” job in addition to configured scripts.
 * - No "any"; use "@/..." alias for imports.
 * See /stan.project.md for global & cross‑cutting requirements.
 */
import type { Command } from 'commander';

import type { ContextConfig } from '@/stan/config';
import { loadConfig } from '@/stan/config';
import { renderAvailableScriptsHelp } from '@/stan/help';
import { type ExecutionMode, type RunBehavior, runSelected } from '@/stan/run';

// Tokens to ignore from user-provided argv when using { from: 'user' } in Commander.
const NOISE_TOKENS = new Set(['node', 'stan']);

/** Helper to compute final selection from positional args and -e/--except. */
const computeSelection = (
  allKeys: string[],
  enumerated: string[] | undefined,
  except: string[] | undefined,
): string[] | null => {
  const isAllowed = (k: string): boolean =>
    (k === 'archive' || allKeys.includes(k)) && !NOISE_TOKENS.has(k);

  // Sanitize enumerated list: drop argv noise like "node"/"stan" and unknown keys.
  const enumeratedClean = (enumerated ?? []).filter(isAllowed);

  if (enumeratedClean.length > 0) {
    // When both enumerated and except are present, respect order of enumerated keys and remove excepted.
    const exceptSet = new Set(except ?? []);
    return enumeratedClean.filter((k) => !exceptSet.has(k));
  }

  if (except && except.length) {
    return allKeys.filter((k) => !except.includes(k));
  }

  return null;
};

export const registerRunner = (cli: Command): Command => {
  cli
    .argument('[scripts...]', 'script keys to run')
    .option('-e, --except <keys...>', 'script keys to exclude')
    .option('-s, --sequential', 'run sequentially')
    .option('-c, --combine', 'combine outputs into a single artifact')
    .option('-k, --keep', 'keep (do not clear) output directory')
    .option('-d, --diff', 'when running archive, also create archive.diff.tar')
    .option(
      '--combined-file-name <name>',
      'base name for combined artifacts (default: "combined")',
    )
    .action(
      async (
        enumerated: string[] | undefined,
        opts: {
          except?: string[];
          sequential?: boolean;
          combine?: boolean;
          keep?: boolean;
          diff?: boolean;
          combinedFileName?: string;
        },
      ) => {
        const cwd = process.cwd();

        // Try to load config; be resilient if unavailable (e.g., in tests).
        let loaded: ContextConfig | undefined;
        try {
          loaded = await loadConfig(cwd);
        } catch {
          // swallow; we will fall back to a minimal config below
        }

        // Available keys come from config when present; otherwise from the enumerated argv.
        const allKeys = loaded
          ? Object.keys(loaded.scripts)
          : (enumerated ?? []).filter((k) => !NOISE_TOKENS.has(k));

        const computed = computeSelection(allKeys, enumerated, opts.except);

        // Default behavior: if no explicit selection then run all keys AND the special "archive"
        // unless the user explicitly excluded it.
        const selection =
          computed === null
            ? (() => {
                const exceptSet = new Set(opts.except ?? []);
                return exceptSet.has('archive')
                  ? [...allKeys]
                  : [...allKeys, 'archive'];
              })()
            : computed;

        const mode: ExecutionMode = opts.sequential
          ? 'sequential'
          : 'concurrent';

        const behavior: RunBehavior = {
          combine: Boolean(opts.combine),
          keep: Boolean(opts.keep),
          diff: Boolean(opts.diff),
          combinedFileName: opts.combinedFileName ?? undefined,
        };

        // Minimal ephemeral config if none loaded (safe for tests where runSelected is mocked)
        const effectiveConfig: ContextConfig =
          loaded ??
          ({
            outputPath: 'stan',
            scripts: Object.fromEntries(
              (enumerated ?? [])
                .filter((k) => k !== 'archive' && !NOISE_TOKENS.has(k))
                .map((k) => [k, '']),
            ),
          } satisfies ContextConfig);

        const created = await runSelected(
          cwd,
          effectiveConfig,
          selection,
          mode,
          behavior,
        );

        if (!Array.isArray(created) || created.length === 0) {
          console.log(renderAvailableScriptsHelp(cwd));
        }
      },
    );
  return cli;
};
