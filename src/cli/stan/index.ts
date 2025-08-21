/* REQUIREMENTS (current):
 * - Export makeCli(): Command — root CLI factory for the "stan" tool.
 * - Register subcommands: run, init, snap.
 * - Vector to interactive init when no config exists (root invocation with no args).
 * - Avoid invoking process.exit during tests; call cli.exitOverride().
 * - Help for root should include available script keys from config.
 */

import { Command } from 'commander';

import { renderAvailableScriptsHelp } from '@/stan/help';
import { printVersionInfo } from '@/stan/version';

import { applyCliSafety } from './cli-utils';
import { performInit, registerInit } from './init';
import { registerPatch } from './patch';
import { registerRun } from './runner';
import { registerSnap } from './snap';

/** Build the root CLI (no side effects; safe for tests). */
export const makeCli = (): Command => {
  const cli = new Command();
  cli
    .name('stan')
    .description(
      'Generate reproducible STAN artifacts for AI-assisted development',
    )
    .option('-d, --debug', 'enable verbose debug logging')
    .option('-v, --version', 'print version and baseline-docs status');

  // Root-level help footer: show available script keys
  cli.addHelpText('after', () => renderAvailableScriptsHelp(process.cwd()));

  // Ensure tests never call process.exit() and argv normalization is consistent
  applyCliSafety(cli);

  // Propagate -d/--debug to subcommands (set before any subcommand action)
  cli.hook('preAction', (thisCommand) => {
    try {
      const root = thisCommand.parent ?? thisCommand;
      const opts = (
        root as unknown as { opts?: () => { debug?: boolean } }
      ).opts?.();
      if (opts?.debug) process.env.STAN_DEBUG = '1';
    } catch {
      // ignore
    }
  });

  // Subcommands
  registerRun(cli);
  registerInit(cli);
  registerSnap(cli);
  registerPatch(cli);

  // Root action:
  // - If -v/--version: print extended version info and return.
  // - If config is missing: run interactive init (not forced) and create a snapshot.
  // - If config exists: print help page (no exit).
  cli.action(async () => {
    const opts = cli.opts<{ debug?: boolean; version?: boolean }>();
    if (opts.debug) process.env.STAN_DEBUG = '1';

    if (opts.version) {
      const vmod = await import('@/stan/version');
      const info = await vmod.getVersionInfo(process.cwd());
      printVersionInfo(info);
      return;
    }

    const cwd = process.cwd();
    const cfgMod = await import('@/stan/config');
    const hasConfig = !!cfgMod.findConfigPathSync(cwd);

    if (!hasConfig) {
      await performInit(cli, { cwd, force: false });
      return;
    }

    // Print help information without invoking .help() (which throws on exit).
    console.log(cli.helpInformation());
  });

  return cli;
};
