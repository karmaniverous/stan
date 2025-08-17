#!/usr/bin/env node
/**
 * REQUIREMENTS
 * - Implement a `ctx` CLI using Commander. [req-cli]
 * - With no args: generate archive + all configured scripts concurrently. [req-generate-all]
 * - With a key: generate only that item; `archive` is allowed. [req-key-only]
 * - Automatically create the output directory. [req-output-dir]
 * - `-h/--help` should list available script keys. [req-help-scripts]
 * - Provide `ctx init` (+ `-f/--force`) for bootstrapping. [req-init]
 *
 * NOTES
 * - Lifecycle logs are printed for each task (start/done with duration).
 * - Errors set `process.exitCode = 1` but do not abort other tasks.
 */
import { Command } from '@commander-js/extra-typings';

import { createArchive } from '../../context/archive';
import { loadConfig } from '../../context/config';
import { renderAvailableScriptsHelp } from '../../context/help';
import { generateWithConfig } from '../../context/run';
import { registerInit } from './init';

const cli = new Command()
  .name('ctx')
  .description('Generate a snapshot of your project state for AI-assisted development.')
  .argument('[key]', 'Generate only this file (script key or "archive").')
  .addHelpText('after', () => renderAvailableScriptsHelp(process.cwd()))
  .action(async (key: string | undefined) => {
    try {
      const cwd = process.cwd();
      const config = await loadConfig(cwd);
      if (key) {
        if (key === 'archive') {
          await createArchive({ cwd, outputPath: config.outputPath });
        } else {
          await generateWithConfig(config, { cwd, key });
        }
      } else {
        await generateWithConfig(config, { cwd });
      }
    } catch (e: unknown) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exitCode = 1;
    }
  });

registerInit(cli);

cli.parse();
