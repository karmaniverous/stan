#!/usr/bin/env node
/**
 * REQUIREMENTS
 * - Implement a `ctx` CLI using Commander. [req-cli]
 * - `ctx` with no args generates: `archive.tar` + all configured script outputs. [req-generate-all]
 * - `ctx [key]` generates only the specified output; `archive` is allowed. [req-key-only]
 * - The tool must create the output directory automatically. [req-output-dir]
 */
import { Command } from '@commander-js/extra-typings';

import { createArchive } from '../../context/archive';
import { loadConfig } from '../../context/config';
import { generateWithConfig } from '../../context/run';

const cli = new Command()
  .name('ctx')
  .description('Generate a complete snapshot of your project state for AI-assisted development.')
  .argument('[key]', 'Generate only this file (script key or "archive").')
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
    } catch (e) {
       
      console.error(e instanceof Error ? e.message : String(e));
      process.exitCode = 1;
    }
  });

cli.parse();
