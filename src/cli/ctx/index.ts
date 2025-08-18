#!/usr/bin/env node
/**
 * @file src/cli/ctx/index.ts
 * @description Entry point for the `ctx` CLI.
 */

import { Command } from 'commander';

import { registerInit } from './init';
import { registerRunner } from './runner';

export const makeCli = (): Command => {
  const cli = new Command();
  cli.name('ctx').description('Generate project context artifacts (archive, logs, combined outputs).');

  registerRunner(cli);
  registerInit(cli);

  return cli;
};

if (require.main === module) {
  void makeCli().parseAsync(process.argv);
}
