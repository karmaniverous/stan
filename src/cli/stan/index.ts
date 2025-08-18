#!/usr/bin/env node
/**
 * REQUIREMENTS (current):
 * - Provide `makeCli()` factory returning a Commander `Command` with runner and init registered.
 * - When executed directly, parse process.argv.
 * - Use the `stan` binary name.
 */
import { Command } from 'commander';

import { registerInit } from './init';
import { registerRunner } from './runner';

export const makeCli = (): Command => {
  const cli = new Command();
  cli
    .name('stan')
    .description(
      'Generate context artifacts (archive, logs, combined outputs).',
    );
  registerRunner(cli);
  registerInit(cli);
  return cli;
};

// When executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await makeCli().parseAsync(process.argv);
}
