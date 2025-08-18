#!/usr/bin/env node
/** See /requirements.md for global requirements. */
import { Command } from 'commander';
import { registerInit } from './init';
import { registerRunner } from './runner';

export const makeCli = (): Command => {
  const cli = new Command()
    .name('ctx')
    .description('Generate context artifacts (archive, logs, combined outputs).');

  registerRunner(cli);
  registerInit(cli);
  return cli;
};

// When executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await makeCli().parseAsync(process.argv);
}
