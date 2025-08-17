/**
 * REQUIREMENTS
 * - If the user runs `ctx` with no config file, automatically run the init wizard. [req-auto-init]
 * - Otherwise, preserve existing behavior:
 *   - With no args: run archive + all configured scripts concurrently. [req-concurrent-all]
 *   - With a key: run only that item; `archive` is allowed. [req-key-only]
 * - Keep logs, shell execution, and error semantics unchanged. [req-stability]
 */
import { Command } from '@commander-js/extra-typings';

import { createArchive } from '../../context/archive';
import { findConfigPathSync, loadConfig } from '../../context/config';
import { generateWithConfig } from '../../context/run';
import { performInit } from './init';

/**
 * Entrypoint used by the CLI action. If no config exists, run init; else proceed.
 */
export const runCtx = async <
  A extends unknown[],
  O extends Record<string, unknown>,
  P extends Record<string, unknown>
>(
  cli: Command<A, O, P>,
  key?: string,
  cwd: string = process.cwd(),
): Promise<void> => {
  // If there is no ctx.config file, jump straight to init and then exit.
  if (!findConfigPathSync(cwd)) {
    await performInit(cli, { cwd, force: false });
    return;
  }

  const config = await loadConfig(cwd);

  if (key) {
    if (key === 'archive') {
      await createArchive({ cwd, outputPath: config.outputPath });
      return;
    }
    await generateWithConfig(config, { cwd, key });
    return;
  }

  await generateWithConfig(config, { cwd });
};
