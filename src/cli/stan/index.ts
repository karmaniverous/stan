#!/usr/bin/env node
/** See /requirements.md for global requirements. */
import { Command as Commander } from 'commander';
import type { Command } from '@commander-js/extra-typings';
import { registerInit } from './init';
import { registerRunner } from './runner';

export const makeCli = (): Command => {
  // Cast to the extra-typings Command type to keep generics happy.
  const cli = new Commander() as unknown as Command;
  cli.name('stan').description('Generate context artifacts (archive, logs, combined outputs).');

  registerRunner(cli);
  registerInit(cli);
  return cli;
};

// When executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await makeCli().parseAsync(process.argv);
}
