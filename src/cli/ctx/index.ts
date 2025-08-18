#!/usr/bin/env node
/**
 * @file src/cli/ctx/index.ts
 * Entry point for the `ctx` CLI.
 *
 * NOTE: Global and cross‑cutting requirements live in /requirements.md.
 */
import type { Command } from '@commander-js/extra-typings';
import { Command as BaseCommand } from 'commander';
import { registerInit } from './init';
import { registerRunner } from './runner';

/**
 * Build the CLI object with all subcommands registered.
 * Exported for tests.
 */
export const buildCli = async (): Promise<Command> => {
  const cli = new BaseCommand() as unknown as Command;
  cli
    .name('ctx')
    .description('Generate project context artifacts (archive, logs, combined outputs).');

  registerRunner(cli);
  registerInit(cli);
  return cli;
};

// Backward‑compat alias some tests might use
export const makeCli = (): Command => {
  const c = new BaseCommand() as unknown as Command;
  c.name('ctx').description('Generate project context artifacts (archive, logs, combined outputs).');
  registerRunner(c as unknown as Command);
  registerInit(c as unknown as Command);
  return c as unknown as Command;
};

// If executed directly, parse process argv.
if (typeof require !== 'undefined' && require.main === module) {
  // no‑await needed; commander handles async action handlers.
  void buildCli().then((cli) => cli.parseAsync(process.argv));
}
