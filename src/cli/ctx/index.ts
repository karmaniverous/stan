#!/usr/bin/env node
/**
 * REQUIREMENTS
 * - Implement a `ctx` CLI using Commander. [req-cli]
 * - If no config exists, running `ctx` should start `init` automatically. [req-auto-init]
 * - With no args: generate archive + all configured scripts concurrently. [req-generate-all]
 * - With a key: generate only that item; `archive` is allowed. [req-key-only]
 * - Show dynamic help listing available script keys. [req-help-scripts]
 */
import { Command } from '@commander-js/extra-typings';

import { renderAvailableScriptsHelp } from '../../context/help';
import { registerInit } from './init';
import { runCtx } from './runner';

const cli = new Command()
  .name('ctx')
  .description('Generate a snapshot of your project state for AI-assisted development.')
  .argument('[key]', 'Generate only this file (script key or "archive").')
  .addHelpText('after', () => renderAvailableScriptsHelp(process.cwd()))
  .action(async (key: string | undefined) => {
    try {
      await runCtx(cli, key);
    } catch (e: unknown) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exitCode = 1;
    }
  });

registerInit(cli);

cli.parse();
