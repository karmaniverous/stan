/* REQUIREMENTS (current):
 * - Export makeCli(): Command — root CLI factory for the "stan" tool.
 * - Register subcommands: run, init, snap.
 * - Vector to interactive init when no config exists (root invocation with no args).
 * - Avoid invoking process.exit during tests; call cli.exitOverride().
 * - Help for root should include available script keys from config.
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';

import { renderAvailableScriptsHelp } from '@/stan/help';
import { registerPatch } from '@/stan/patch';
import { registerSnap } from '@/stan/snap';

import { applyCliSafety } from './cli-utils';
import { performInit, registerInit } from './init';
import { registerRun } from './runner';

/** Build the root CLI (no side effects; safe for tests). */
export const makeCli = (): Command => {
  const cli = new Command();
  cli
    .name('stan')
    .description(
      'Generate reproducible STAN artifacts for AI-assisted development',
    );

  // Root-level help footer: show available script keys
  cli.addHelpText('after', () => renderAvailableScriptsHelp(process.cwd()));

  // Ensure tests never call process.exit() and argv normalization is consistent
  applyCliSafety(cli);

  // Subcommands
  registerRun(cli);
  registerInit(cli);
  registerSnap(cli);
  registerPatch(cli);

  // Root action:
  // - If config is missing: run interactive init (not forced) and create a snapshot.
  // - If config exists: print help page (no exit).
  cli.action(async () => {
    const cwd = process.cwd();
    const cfgMod = await import('@/stan/config');
    const hasConfig = !!cfgMod.findConfigPathSync(cwd);

    if (!hasConfig) {
      await performInit(cli, { cwd, force: false });
      // performInit prints its own messages and writes the snapshot.
      return;
    }

    // Print help information without invoking .help() (which throws on exit).
    console.log(cli.helpInformation());
  });

  return cli;
};

// Execute when run directly (built CLI)
const isDirect = (() => {
  try {
    const self = resolve(fileURLToPath(import.meta.url));
    const invoked = resolve(process.argv[1] ?? '');
    return self === invoked;
  } catch {
    return false;
  }
})();

if (isDirect) {
  const cli = makeCli();
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  cli.parseAsync();
}
